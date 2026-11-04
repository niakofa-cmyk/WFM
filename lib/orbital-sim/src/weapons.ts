import { detAcos, detHypot } from "./detmath";
import { LOCK_SECONDS, MISSILE_RANGE, PROJECTILE_LIMIT, rotate, type Rock, type SpatialBullet, type SpatialCraft } from "./flight";

const hypot3 = (x: number, y: number, z: number) => detHypot(detHypot(x, y), z);

export function distance3(a: { x: number; z: number; space?: { y: number } }, b: { x: number; z: number; space?: { y: number } }) {
  return hypot3(a.x - b.x, (a.space?.y ?? 0) - (b.space?.y ?? 0), a.z - b.z);
}
export function segmentHit(x: number, y: number, z: number, b: { x: number; y?: number; z: number }, px: number, py: number, pz: number, radius: number) {
  const dx = b.x - px; const dy = (b.y ?? 0) - py; const dz = b.z - pz;
  const length = dx * dx + dy * dy + dz * dz;
  const t = length > 0 ? Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / length)) : 0;
  return hypot3(x - px - t * dx, y - py - t * dy, z - pz - t * dz) < radius;
}
export function targetSolution(pilot: SpatialCraft, target: SpatialCraft, rocks: readonly Rock[] = []) {
  const s = pilot.space;
  if (!s) return { distance: Infinity, angle: Math.PI, available: false };
  const distance = distance3(pilot, target);
  const f = rotate(s.q, 0, 0, -1);
  const dot = (f.x * (target.x - pilot.x) + f.y * ((target.space?.y ?? 0) - s.y) + f.z * (target.z - pilot.z)) / Math.max(.001, distance);
  const angle = detAcos(Math.max(-1, Math.min(1, dot)));
  const endpoint = { x: target.x, y: target.space?.y ?? 0, z: target.z };
  const blocked = rocks.some((rock) => segmentHit(rock.x, rock.y ?? 0, rock.z, endpoint, pilot.x, s.y, pilot.z, rock.r));
  return { distance, angle, available: pilot.alive && target.alive && target.id !== pilot.id && target.cloak <= 0 && target.untargetable <= 0 && pilot.jam <= 0 && distance <= MISSILE_RANGE && angle <= .3 && !blocked };
}
export function acquireTarget(pilot: SpatialCraft, target: SpatialCraft | undefined, dt: number, rocks: readonly Rock[] = []) {
  const s = pilot.space;
  if (!s) throw new Error("Acquisition requires orbital state.");
  s.missileCd = Math.max(0, s.missileCd - dt);
  if (s.lockTargetId !== pilot.lockTargetId) {
    s.lockProgress = 0;
    s.lockTargetId = pilot.lockTargetId;
  }
  s.lockProgress = target && targetSolution(pilot, target, rocks).available ? Math.min(1, s.lockProgress + dt / LOCK_SECONDS) : 0;
}
export function spawnMissile(pilot: SpatialCraft, target: SpatialCraft | undefined, count: number, damage: number, rocks: readonly Rock[] = []): SpatialBullet | null {
  const s = pilot.space;
  if (!s || !pilot.alive || pilot.root > 0 || s.ammo <= 0 || s.missileCd > 0 || s.lockProgress < 1 || s.lockTargetId !== pilot.lockTargetId || count >= PROJECTILE_LIMIT) return null;
  if (!target || target.id !== pilot.lockTargetId || !targetSolution(pilot, target, rocks).available) return null;
  const f = rotate(s.q, 0, 0, -1);
  s.ammo--; s.missileCd = 3.5;
  return { x: pilot.x + f.x * 2.5, y: s.y + f.y * 2.5, z: pilot.z + f.z * 2.5,
    vx: f.x * 38, vy: f.y * 38, vz: f.z * 38, life: 4, dmg: damage, r: .5, homeId: target.id, missile: true };
}
export function spawnPrimary(pilot: SpatialCraft, target: SpatialCraft | undefined, speed: number, damage: number, rocks: readonly Rock[] = []): SpatialBullet {
  const s = pilot.space;
  if (!s) throw new Error("Spatial primary requires orbital state.");
  let direction = rotate(s.q, 0, 0, -1);
  const solution = target && targetSolution(pilot, target, rocks);
  if (s.aimAssist && target && solution?.available && solution.angle < .22) {
    const t = distance3(pilot, target) / speed;
    const dx = target.x + (target.space?.vx ?? 0) * t - pilot.x;
    const dy = (target.space?.y ?? 0) + (target.space?.vy ?? 0) * t - s.y;
    const dz = target.z + (target.space?.vz ?? 0) * t - pilot.z;
    const length = Math.max(.001, hypot3(dx, dy, dz));
    direction = { x: dx / length, y: dy / length, z: dz / length };
  }
  return { x: pilot.x + direction.x * 2, y: s.y + direction.y * 2, z: pilot.z + direction.z * 2,
    vx: direction.x * speed, vy: direction.y * speed, vz: direction.z * speed, life: 1.6, dmg: damage, r: .3, homeId: null };
}
export function guideMissile(b: SpatialBullet, target: SpatialCraft, dt: number) {
  const dx = target.x - b.x; const dy = (target.space?.y ?? 0) - (b.y ?? 0); const dz = target.z - b.z;
  const distance = Math.max(.001, hypot3(dx, dy, dz));
  const speed = hypot3(b.vx, b.vy ?? 0, b.vz);
  if (speed <= 0) throw new Error("Guided projectile must have positive speed.");
  const dot = (b.vx * dx + (b.vy ?? 0) * dy + b.vz * dz) / Math.max(.001, speed * distance);
  const angle = detAcos(Math.max(-1, Math.min(1, dot)));
  const mix = angle < 1e-5 ? 1 : Math.min(1, 2.5 * dt / angle);
  let vx = b.vx / speed * (1 - mix) + dx / distance * mix;
  let vy = (b.vy ?? 0) / speed * (1 - mix) + dy / distance * mix;
  let vz = b.vz / speed * (1 - mix) + dz / distance * mix;
  const length = Math.max(.001, hypot3(vx, vy, vz));
  vx /= length; vy /= length; vz /= length;
  b.vx = vx * speed; b.vy = vy * speed; b.vz = vz * speed;
}
export function absorbArmor(state: { armor: number }, incoming: number) {
  const absorbed = Math.min(state.armor, Math.max(0, incoming) * .6);
  state.armor -= absorbed;
  return incoming - absorbed;
}
