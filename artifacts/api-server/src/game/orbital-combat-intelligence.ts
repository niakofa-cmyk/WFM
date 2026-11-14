import { orbitalCombatPursuit, rotate, type SpatialCraft, type SpatialBullet } from "@workspace/orbital-sim";
import { detAtan2, detHypot } from "@workspace/orbital-sim/detmath";

export type TacticalMemory = { evadeUntil: number; readyAt: number; strafe: number; vertical: number };
const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const length = (x: number, y: number, z: number) => detHypot(detHypot(x, y), z);

/** Server-only decisions, never pose mutations or damage permissions. */
export function tacticalFlight(
  craft: SpatialCraft, target: SpatialCraft, role: string, tick: number,
  threats: readonly (SpatialBullet & { faction: string })[], faction: string,
  memory: TacticalMemory,
) {
  const s = craft.space!, t = target.space!;
  const inverse = [-s.q[0], -s.q[1], -s.q[2], s.q[3]] as typeof s.q;
  const dx = target.x - craft.x, dy = t.y - s.y, dz = target.z - craft.z;
  const distance = length(dx, dy, dz);
  const forward = rotate(t.q, 0, 0, -1);
  const right = rotate(t.q, 1, 0, 0);
  const rear = (craft.x - target.x) * forward.x + (s.y - t.y) * forward.y +
    (craft.z - target.z) * forward.z;
  const direct = rotate(inverse, dx, dy, dz);
  const aligned = Math.abs(detAtan2(-direct.x, -direct.z)) < .18 &&
    Math.abs(detAtan2(direct.y, detHypot(direct.x, direct.z))) < .18;
  const heavy = /heavy|siege/i.test(role);
  const slot = craft.id % 3;
  const lead = Math.min(1.2, distance / 100);
  const flank = slot === 0 ? -12 : slot === 1 ? 12 : 0;
  const point = {
    x: target.x + t.vx * lead - forward.x * 28 + right.x * flank,
    y: t.y + t.vy * lead - forward.y * 28 + right.y * flank + (slot === 2 ? 12 : 0),
    z: target.z + t.vz * lead - forward.z * 28 + right.z * flank,
  };
  const base = orbitalCombatPursuit(craft, target, role).controls;
  const attack = rear < -distance * .35 || aligned && distance < 85;
  const local = rotate(inverse, point.x - craft.x, point.y - s.y, point.z - craft.z);
  const controls = {
    ...base,
    yaw: attack ? base.yaw : clamp(detAtan2(-local.x, -local.z) * 1.7),
    pitch: attack ? base.pitch : clamp(detAtan2(local.y, detHypot(local.x, local.z)) * 1.7),
    throttle: attack ? base.throttle : distance > 45 ? .55 : .2,
    vertical: attack ? 0 : clamp(local.y * .015),
    roll: 0, boost: false,
    fire: aligned && distance < 170,
    // Stagger launch opportunities so a squad does not unload every missile
    // the instant locks complete. Weapon simulation still checks the lock.
    missile: tick >= 180 && (tick + craft.id * 17) % 180 === 0 &&
      aligned && s.lockProgress >= 1 && s.ammo > 0 && s.missileCd <= 0,
  };
  let mode: "attack" | "rear-intercept" | "evade" | "withdraw" = attack ? "attack" : "rear-intercept";
  // Read only actual incoming trajectories. Friendly and receding fire is not a threat.
  if (tick >= memory.readyAt && s.energy >= 18 && !heavy) {
    let bestTime = Infinity;
    for (const shot of threats) {
      if (shot.faction === faction || shot.life <= 0) continue;
      const px = shot.x - craft.x, py = (shot.y ?? 0) - s.y, pz = shot.z - craft.z;
      const vx = shot.vx - s.vx, vy = (shot.vy ?? 0) - s.vy, vz = shot.vz - s.vz;
      const speedSquared = vx * vx + vy * vy + vz * vz;
      if (speedSquared < .001) continue;
      const time = -(px * vx + py * vy + pz * vz) / speedSquared;
      if (time < .12 || time > Math.min(1.25, shot.life) || time >= bestTime) continue;
      const miss = length(px + vx * time, py + vy * time, pz + vz * time);
      if (miss > craft.radius + shot.r + (shot.missile ? 9 : 4)) continue;
      // Evade away from the projected closest approach, not the launch point.
      // A round crossing from the left may impact on our right. Central threats
      // use stable squad slots so an entire formation does not dodge identically.
      const impact = rotate(inverse, px + vx * time, py + vy * time, pz + vz * time);
      const lateral = Math.abs(impact.x) > .1 ? (impact.x > 0 ? -1 : 1) : craft.id % 2 === 0 ? 1 : -1;
      const vertical = Math.abs(impact.y) > .1 ? (impact.y > 0 ? -.7 : .7) : slot === 2 ? -.7 : .7;
      const magnitude = detHypot(lateral, vertical);
      memory.strafe = lateral / magnitude;
      memory.vertical = vertical / magnitude;
      bestTime = time;
    }
    if (bestTime !== Infinity) {
      memory.evadeUntil = tick + 12;
      memory.readyAt = tick + 90;
    }
  }
  if (craft.hull < craft.hullMax * .2) {
    mode = "withdraw";
    // Actually turn away from the threat through ordinary flight integration.
    // Merely increasing throttle while still aiming at it is not a retreat.
    const away = rotate(inverse, -dx, -dy, -dz);
    controls.yaw = clamp(detAtan2(-away.x, -away.z) * 1.7);
    controls.pitch = clamp(detAtan2(away.y, detHypot(away.x, away.z)) * 1.7);
    controls.throttle = .65;
    controls.strafe = (craft.id % 2 === 0 ? 1 : -1) * .45;
    controls.vertical = slot === 2 ? -.35 : .35;
    controls.fire = false;
    controls.missile = false;
  }
  if (tick < memory.evadeUntil) {
    mode = "evade";
    controls.strafe = memory.strafe;
    controls.vertical = memory.vertical;
    controls.roll = memory.strafe * .45;
    controls.boost = s.energy >= 18;
    controls.missile = false;
  }
  return { mode, controls, intercept: point };
}
