import * as THREE from "./three-flight-runtime";

type Point = { x: number; y: number; z: number };
export type SharedFlightImpact = {
  eventId: string;
  targetActorId?: string;
  point: Point;
  kind: "shield" | "hull" | "world" | "subsystem" | "destruction";
};
const point = (p: unknown): p is Point => !!p && typeof p === "object" &&
  ["x", "y", "z"].every(k => typeof (p as Record<string, unknown>)[k] === "number" &&
    Number.isFinite((p as Record<string, unknown>)[k]));
const identity = (v: unknown): v is string => typeof v === "string" &&
  /^[a-zA-Z0-9:_-]{1,160}$/.test(v);

/** Presentation only: no client damage, destruction, or reward claims. */
export function readSharedFlightImpact(packet: Record<string, unknown>): SharedFlightImpact | null {
  if (!identity(packet.eventId) || !point(packet.to)) return null;
  if (packet.type === "freeflight_world_impact")
    return { eventId: packet.eventId, point: { ...packet.to }, kind: "world" };
  if (packet.type !== "freeflight_weapon_event" || !identity(packet.targetActorId) ||
      typeof packet.destroyed !== "boolean" ||
      ![packet.shieldDamage, packet.hullDamage].every(n => typeof n === "number" &&
        Number.isFinite(n) && n >= 0 && n <= 1_000_000)) return null;
  if (!packet.destroyed && packet.shieldDamage === 0 && packet.hullDamage === 0) return null;
  return {
    eventId: packet.eventId, targetActorId: packet.targetActorId,
    point: { ...packet.to },
    kind: packet.destroyed ? "destruction" : packet.subsystemDisabled === true &&
      Number(packet.hullDamage) > 0 ? "subsystem" : Number(packet.hullDamage) > 0 ? "hull" : "shield",
  };
}

/** Late impact packets still render even if their launch tracer was dropped. */
export function createSharedFlightImpactQueue() {
  const pending: Array<SharedFlightImpact & { at: number }> = [];
  const seen = new Set<string>();
  const destroyed = new Set<string>();
  return {
    push(packet: Record<string, unknown>, now: number): boolean {
      const impact = readSharedFlightImpact(packet);
      if (!impact || !Number.isFinite(now) || seen.has(impact.eventId)) return false;
      seen.add(impact.eventId);
      if (seen.size > 512) seen.delete(seen.values().next().value!);
      if (impact.kind === "destruction" && impact.targetActorId) {
        if (destroyed.has(impact.targetActorId)) return false;
        destroyed.add(impact.targetActorId);
        if (destroyed.size > 512) destroyed.delete(destroyed.values().next().value!);
      }
      pending.push({ ...impact, at: now });
      if (pending.length > 48) {
        const ordinary = pending.findIndex(p => p.kind !== "destruction");
        pending.splice(ordinary >= 0 ? ordinary : 0, 1);
      }
      return true;
    },
    drain(now: number) {
      return pending.splice(0).filter(e => now >= e.at && now - e.at <= 1_000);
    },
    clear() { pending.length = 0; seen.clear(); destroyed.clear(); },
  };
}

/**
 * Fixed-size Three.js effects pool: Combat Lab-style expanding shock rings,
 * luminous blast cores and radial sparks/debris. Shared effects outlive the
 * destroyed ship's mesh and never alter the authoritative collision model.
 */
export function createSharedFlightImpactEffects(scene: THREE.Scene) {
  const coreGeometry = new THREE.IcosahedronGeometry(1, 1);
  const ringGeometry = new THREE.RingGeometry(.76, 1, 28);
  const slots = Array.from({ length: 12 }, () => {
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb44d, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd18b, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const sparkMaterial = new THREE.PointsMaterial({
      color: 0xffe2a6, size: .5, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    const group = new THREE.Group();
    group.name = "shared-flight-impact";
    group.userData.presentationOnly = true;
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
    group.add(core, ring, sparks);
    group.visible = false;
    scene.add(group);
    return { group, core, ring, sparks, coreMaterial, ringMaterial, sparkMaterial,
      sparkGeometry, started: -Infinity, life: 0, point: { x: 0, y: 0, z: 0 },
      kind: "world" as SharedFlightImpact["kind"] };
  });
  return {
    emit(impact: SharedFlightImpact, local: Point, now: number) {
      let slot = slots.find(s => now >= s.started + s.life * 1_000);
      if (!slot) {
        const ordinary = slots.filter(s => s.kind !== "destruction");
        // Ordinary gunfire must not erase a still-visible destruction blast.
        if (!ordinary.length && impact.kind !== "destruction") return;
        slot = (ordinary.length ? ordinary : slots)
          .reduce((oldest, s) => s.started < oldest.started ? s : oldest);
      }
      slot.started = now;
      slot.kind = impact.kind;
      slot.point = { ...impact.point };
      slot.life = impact.kind === "destruction" ? 1.25 : impact.kind === "subsystem" ? .8 : .4;
      slot.group.position.set(local.x, local.y, local.z);
      slot.group.userData.kind = impact.kind;
      slot.group.visible = true;
      const color = impact.kind === "shield" ? 0x71cfff :
        impact.kind === "world" ? 0xffe3a1 : impact.kind === "destruction" ? 0xffad3d :
          impact.kind === "subsystem" ? 0xffde59 : 0xff6940;
      slot.coreMaterial.color.setHex(color);
      slot.ringMaterial.color.setHex(color);
      slot.sparkMaterial.color.setHex(color);
    },
    update(now: number, camera: THREE.PerspectiveCamera, project?: (point: Point) => Point | null) {
      for (const slot of slots) {
        const age = (now - slot.started) / 1_000;
        slot.group.visible = age >= 0 && age < slot.life;
        if (!slot.group.visible) continue;
        if (project) {
          const local = project(slot.point);
          if (!local) { slot.group.visible = false; continue; }
          slot.group.position.set(local.x, local.y, local.z);
        }
        const u = age / slot.life;
        const blast = slot.kind === "destruction";
        const radius = blast ? 2 + 11 * u : .35 + 2.5 * u;
        slot.core.scale.setScalar(blast ? (1 + 5 * Math.sin(Math.PI * u)) : radius * .45);
        slot.coreMaterial.opacity = (1 - u) * (blast ? .85 : .65);
        slot.ring.quaternion.copy(camera.quaternion);
        slot.ring.scale.setScalar(radius);
        slot.ringMaterial.opacity = (1 - u) * .9;
        slot.sparkMaterial.opacity = 1 - u;
        const position = slot.sparkGeometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < 24; i++) {
          const y = 1 - (i + .5) / 12;
          const r = Math.sqrt(Math.max(0, 1 - y * y));
          const a = i * 2.399963;
          const spread = radius * (blast ? 1.5 : 1);
          position.setXYZ(i, Math.cos(a) * r * spread, y * spread, Math.sin(a) * r * spread);
        }
        position.needsUpdate = true;
        slot.sparkGeometry.computeBoundingSphere();
      }
    },
    clear() { for (const slot of slots) { slot.started = -Infinity; slot.group.visible = false; } },
    dispose() {
      for (const slot of slots) {
        scene.remove(slot.group);
        slot.coreMaterial.dispose(); slot.ringMaterial.dispose(); slot.sparkMaterial.dispose();
        slot.sparkGeometry.dispose();
      }
      coreGeometry.dispose(); ringGeometry.dispose();
    },
  };
}
