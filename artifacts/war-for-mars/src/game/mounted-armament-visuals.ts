import * as THREE from "./three-flight-runtime";
import { equipmentDefinition, isVisibleArmamentActor, type VisibleArmamentActor } from "@workspace/orbital-sim";

export const MAX_ARMAMENT_MESHES_PER_SHIP = 24;
export const ARMAMENT_DETAIL_DISTANCE = 250;
type Point = readonly [number, number, number];

/** Original, low-poly military fittings. Never changes physics or inventory. */
export function createMountedArmamentVisuals(model: THREE.Group, shipId: string) {
  const stock = model.children.filter(c => c.name.startsWith("primary-cannon-") ||
    c.name.startsWith("missile-round-") || c.name.startsWith("missile-nose-"))
    .map(object => ({ object, visible: object.visible }));
  const gun = model.getObjectByName("primary-cannon-1")?.position.clone() ?? new THREE.Vector3(0, -.3, .55);
  const missile = model.getObjectByName("missile-rail-1")?.position.clone() ?? new THREE.Vector3(-.8, -.25, -.1);
  let root: THREE.Group | null = null;
  let last: VisibleArmamentActor | null = null;
  let signature = "";
  let disposed = false;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials: THREE.MeshStandardMaterial[] = [];
  const flashMaterials = new Map<string, THREE.MeshBasicMaterial>();
  const firing = new Map<string, {
    parts: THREE.Group; flash: THREE.Mesh; material: THREE.MeshBasicMaterial;
    tips: Point[]; nextTip: number; firedAt: number; recoil: number; duration: number;
  }>();
  function resetFiring() {
    for (const state of firing.values()) {
      state.parts.position.z = 0;
      state.flash.visible = false;
      state.material.opacity = 0;
      state.firedAt = -Infinity;
    }
  }
  function shown() {
    if (!root) return false;
    for (let object: THREE.Object3D | null = root; object; object = object.parent)
      if (!object.visible) return false;
    return true;
  }
  function animate(now: number) {
    if (disposed || !shown() || !Number.isFinite(now)) { resetFiring(); return; }
    for (const state of firing.values()) {
      const age = now - state.firedAt;
      const remaining = age >= 0 ? Math.max(0, 1 - age / state.duration) : 0;
      state.parts.position.z = -state.recoil * remaining * remaining;
      const flash = age >= 0 ? Math.max(0, 1 - age / 90) : 0;
      state.flash.visible = flash > 0;
      state.material.opacity = flash * .95;
      state.flash.scale.set(.7 + flash * .6, .7 + flash * .6, 1.3 + flash * 2);
    }
  }
  const palette = () => {
    if (!materials.length) {
      const color = model.userData.faction === "accord" ? 0xf1ac56 : 0x7bbde2;
      materials.push(
        new THREE.MeshStandardMaterial({ color: 0x26303a, metalness: .8, roughness: .48 }),
        new THREE.MeshStandardMaterial({ color: 0xa3afb6, metalness: .85, roughness: .35 }),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .4, metalness: .5, roughness: .4 }),
      );
    }
    return materials;
  };
  function clear() {
    resetFiring(); firing.clear();
    if (root) model.remove(root);
    root = null;
    for (const geometry of geometries) geometry.dispose();
    geometries.clear();
    for (const entry of stock) entry.object.visible = entry.visible;
    last = null; signature = "";
  }
  function update(record: VisibleArmamentActor | null, visible = true) {
    if (disposed) return;
    if (!record || record.shipId !== shipId) { if (root || last) clear(); return; }
    if (record === last) { if (root) root.visible = visible; if (!visible) resetFiring(); return; }
    if (!isVisibleArmamentActor(record)) { clear(); return; }
    const key = JSON.stringify(record.mounts.slice().sort((a, b) => a.hardpointId.localeCompare(b.hardpointId)));
    if (key === signature) { last = record; if (root) root.visible = visible; if (!visible) resetFiring(); return; }
    clear();
    last = record; signature = key;
    if (!record.mounts.length) return;
    root = new THREE.Group();
    root.name = "server-issued-armament";
    root.userData.presentationOnly = true;
    root.visible = visible;
    model.add(root);
    const [body, steel, accent] = palette();
    let meshCount = 0;
    for (const item of record.mounts) {
      const def = equipmentDefinition(item.equipmentId)!;
      const mount = new THREE.Group();
      mount.name = `hardpoint:${item.hardpointId}`;
      mount.userData.equipmentId = def.id;
      mount.userData.hardpointId = item.hardpointId;
      const scale = 1 + (def.size - 1) * .3;
      mount.scale.setScalar(scale);
      let assembly = mount;
      const movingParts = () => {
        assembly = new THREE.Group();
        assembly.name = "recoiling-weapon";
        mount.add(assembly);
      };
      const add = (geometry: THREE.BufferGeometry, material: THREE.Material, point: Point) => {
        if (++meshCount > MAX_ARMAMENT_MESHES_PER_SHIP)
          throw new Error("Mounted armament template exceeded its render budget.");
        geometries.add(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...point);
        assembly.add(mesh);
        return mesh;
      };
      const box = (dimensions: Point, point: Point, material = body!) =>
        add(new THREE.BoxGeometry(...dimensions), material, point);
      const tube = (radius: number, length: number, point: Point) => {
        const mesh = add(new THREE.CylinderGeometry(radius, radius * 1.15, length, 6), steel!, point);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
      };
      if (def.kind === "primary") {
        mount.position.copy(gun);
        box([.19, .17, .3], [0, 0, -.12]);
        movingParts();
        if (def.id === "railgun") {
          box([.045, .07, .85], [-.075, 0, .35], steel);
          box([.045, .07, .85], [.075, 0, .35], steel);
        } else if (def.id === "rotary-gun") {
          for (const [x, y] of [[-.06, -.035], [.06, -.035], [0, .065]])
            tube(.027, .62, [x!, y!, .27]);
        } else tube(.047, .58, [0, 0, .25]);
      } else if (def.kind === "secondary") {
        mount.position.copy(missile);
        box([.2, .09, .44], [0, .04, -.08]);
        movingParts();
        if (def.id === "rocket") {
          tube(.065, .55, [-.075, -.07, .1]);
          tube(.065, .55, [.075, -.07, .1]);
        } else {
          tube(def.id === "torpedo" ? .12 : .075, .65, [0, -.09, .1]);
          const nose = add(new THREE.ConeGeometry(def.id === "torpedo" ? .12 : .075, .22, 6), accent!, [0, -.09, .53]);
          nose.rotation.x = Math.PI / 2;
        }
      } else if (def.kind === "special") {
        mount.position.set(0, .36, -.4);
        box([.25, .17, .34], [0, 0, 0]);
        add(new THREE.TorusGeometry(.13, .025, 5, 10), accent!, [0, .1, .05]);
      } else if (def.kind === "defensive") {
        mount.position.set(-missile.x, missile.y, missile.z - .25);
        box([.26, .15, .3], [0, 0, 0]);
        box([.21, .035, .22], [0, .09, 0], def.id === "hardened-decoys" ? steel : accent);
      } else {
        const index = Number(item.hardpointId.split("-")[1]) - 1;
        mount.position.set(index % 2 ? .32 : -.32, .32, index < 2 ? -.12 : -.68);
        box(def.id === "armor" ? [.3, .05, .4] : [.22, .12, .24], [0, 0, 0]);
        if (def.id === "sensors" || def.id === "comms")
          box([.035, .24, .16], [0, .16, 0], steel);
        else if (def.id !== "armor") box([.16, .025, .14], [0, .08, 0], accent);
      }
      if (def.kind === "primary" || def.kind === "secondary") {
        let material = flashMaterials.get(def.kind);
        if (!material) {
          material = new THREE.MeshBasicMaterial({
            color: model.userData.faction === "accord" ? 0xffcf8a : 0xb2edff,
            transparent: true, opacity: 0, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false,
          });
          flashMaterials.set(def.kind, material);
        }
        const tips: Point[] = def.id === "railgun" ? [[0, 0, .805]]
          : def.id === "rotary-gun" ? [[-.06, -.035, .61], [.06, -.035, .61], [0, .065, .61]]
          : def.kind === "primary" ? [[0, 0, .57]]
          : def.id === "rocket" ? [[-.075, -.07, .405], [.075, -.07, .405]]
          : [[0, -.09, .67]];
        const flash = add(new THREE.SphereGeometry(.065, 6, 4), material, tips[0]!);
        flash.name = "mounted-muzzle-flash";
        flash.userData.presentationOnly = true;
        flash.visible = false;
        firing.set(def.id, { parts: assembly, flash, material, tips, nextTip: 0, firedAt: -Infinity,
          recoil: def.kind === "secondary" ? .025 : def.id === "railgun" ? .14 : def.id === "rotary-gun" ? .045 : .08,
          duration: def.kind === "secondary" ? 140 : 220 });
      }
      root.add(mount);
    }
    const primary = record.mounts.some(item => equipmentDefinition(item.equipmentId)?.kind === "primary");
    const secondary = record.mounts.some(item => equipmentDefinition(item.equipmentId)?.kind === "secondary");
    for (const entry of stock) {
      if (entry.object.name.startsWith("primary-cannon-") ? primary : secondary) entry.object.visible = false;
    }
    root.userData.meshCount = meshCount;
  }
  return {
    update, clear, animate,
    fire(weaponId: string, now: number) {
      if (disposed || !shown() || !Number.isFinite(now) || now < 0) return false;
      const state = firing.get(weaponId);
      if (!state) return false;
      state.flash.position.set(...state.tips[state.nextTip++ % state.tips.length]!);
      state.firedAt = now;
      return true;
    },
    hide() { if (root) root.visible = false; resetFiring(); },
    dispose() {
      if (disposed) return;
      clear(); materials.forEach(material => material.dispose()); materials.length = 0;
      flashMaterials.forEach(material => material.dispose()); flashMaterials.clear(); disposed = true;
    },
    get root() { return root; },
  };
}
