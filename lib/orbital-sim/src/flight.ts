import { detAtan2, detCos, detExp, detHypot, detSin } from "./detmath";

export const ORBITAL_RULES_VERSION = 1 as const;
export const ORBITAL_TICK_RATE = 30;
export const ORBITAL_DT = 1 / ORBITAL_TICK_RATE;
export const MISSILE_RANGE = 65;
export const LOCK_SECONDS = 1.25;
export const PROJECTILE_LIMIT = 110;
export type Quaternion = [number, number, number, number];
export type OrbitalFlight = {
  y: number; vx: number; vy: number; vz: number; q: Quaternion;
  energy: number; assist: boolean; armor: number; armorMax: number;
  lockProgress: number; lockTargetId: number | null; missileCd: number; ammo: number; aimAssist: boolean;
};
export type FlightInput = { vertical?: number; roll?: number; boost?: boolean; brake?: boolean; inertial?: boolean; missile?: boolean; aimAssist?: boolean };
export type FlightControls = FlightInput & { throttle: number; yaw: number; strafe: number; pitch: number };
export type Rock = { x: number; z: number; r: number; y?: number };
export type FlightTuning = { turnRate: number; handling: number; accel: number; maxSpeed: number };
export type SpatialCraft = {
  id: number; x: number; z: number; yaw: number; pitch: number; speed: number; steer: number;
  hull: number; hullMax: number; alive: boolean; root: number; jam: number; boost: number;
  cloak: number; untargetable: number; radius: number; lockTargetId: number | null;
  space?: OrbitalFlight;
};
export type SpatialBullet = {
  x: number; y?: number; z: number; vx: number; vy?: number; vz: number;
  life: number; dmg: number; r: number; homeId: number | null; missile?: boolean;
};
export function newFlight(yaw = 0): OrbitalFlight {
  return { y: 0, vx: 0, vy: 0, vz: 0, q: [0, detSin(yaw / 2), 0, detCos(yaw / 2)], energy: 100, assist: true, armor: 40, armorMax: 40, lockProgress: 0, lockTargetId: null, missileCd: 0, ammo: 8, aimAssist: true };
}
export function rotate(q: Quaternion, x: number, y: number, z: number) {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * z - qz * y); const ty = 2 * (qz * x - qx * z); const tz = 2 * (qx * y - qy * x);
  return { x: x + qw * tx + qy * tz - qz * ty, y: y + qw * ty + qz * tx - qx * tz, z: z + qw * tz + qx * ty - qy * tx };
}
function turn(q: Quaternion, x: number, y: number, z: number, angle: number): Quaternion {
  const s = detSin(angle / 2); const c = detCos(angle / 2); const [a,b,d,w] = q;
  const result: Quaternion = [w*x*s+a*c+b*z*s-d*y*s, w*y*s-a*z*s+b*c+d*x*s, w*z*s+a*y*s-b*x*s+d*c, w*c-a*x*s-b*y*s-d*z*s];
  const length = detHypot(detHypot(result[0], result[1]), detHypot(result[2], result[3]));
  return result.map((n) => n / length) as Quaternion;
}
const clamp = (n: number) => Math.max(-1, Math.min(1, n));
export function integrateSpatialFlight(craft: SpatialCraft, input: FlightControls, dt: number, speedMul: number, rocks: readonly Rock[], def: FlightTuning) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw new Error("Orbital step must be finite and at most 100 ms.");
  const s = craft.space;
  if (!s) throw new Error("Orbital flight requires initialized spatial state.");
  if (input.inertial) s.assist = !s.assist;
  if (input.aimAssist) s.aimAssist = !s.aimAssist;
  const disrupted = craft.root > 0 || craft.jam > 0;
  const rate = def.turnRate * def.handling * (disrupted ? .35 : 1);
  s.q = turn(s.q, 0, 1, 0, clamp(input.yaw) * rate * dt);
  s.q = turn(s.q, 1, 0, 0, clamp(input.pitch) * rate * dt);
  s.q = turn(s.q, 0, 0, 1, clamp(input.roll ?? 0) * rate * dt);
  const f = rotate(s.q, 0, 0, -1);
  craft.yaw = detAtan2(-f.x, -f.z); craft.pitch = detAtan2(f.y, detHypot(f.x, f.z)); craft.steer = input.yaw;
  const boosting = !disrupted && (input.boost || craft.boost > 0) && s.energy > .1;
  s.energy = Math.max(0, Math.min(100, s.energy + (boosting ? -28 : 15) * dt));
  const thrust = rotate(s.q, -clamp(input.strafe), clamp(input.vertical ?? 0), -clamp(input.throttle));
  const engineCondition = .55 + .45 * Math.max(0, craft.hull / craft.hullMax);
  const acceleration = disrupted ? 0 : def.accel * speedMul * engineCondition * (boosting ? 2 : 1);
  const length = Math.max(1, detHypot(detHypot(thrust.x, thrust.y), thrust.z));
  s.vx += thrust.x / length * acceleration * dt; s.vy += thrust.y / length * acceleration * dt; s.vz += thrust.z / length * acceleration * dt;
  const damping = input.brake ? 7 : s.assist ? 1.65 : 0;
  const drag = detExp(-damping * dt);
  s.vx *= drag; s.vy *= drag; s.vz *= drag;
  const speed = detHypot(detHypot(s.vx, s.vy), s.vz);
  const maximum = def.maxSpeed * speedMul * (boosting ? 1.9 : 1.15);
  if (speed > maximum) {
    const factor = Math.max(maximum / speed, detExp(-2 * dt));
    s.vx *= factor; s.vy *= factor; s.vz *= factor;
  }
  craft.x += s.vx * dt; s.y += s.vy * dt; craft.z += s.vz * dt;
  const boundary = detHypot(detHypot(craft.x, s.y), craft.z);
  if (boundary > 78) {
    const normal = { x: craft.x / boundary, y: s.y / boundary, z: craft.z / boundary };
    craft.x = normal.x * 78; s.y = normal.y * 78; craft.z = normal.z * 78;
    const outward = Math.max(0, s.vx * normal.x + s.vy * normal.y + s.vz * normal.z);
    s.vx -= outward * normal.x; s.vy -= outward * normal.y; s.vz -= outward * normal.z;
  }
  for (const rock of rocks) {
    const dx = craft.x - rock.x; const dy = s.y - (rock.y ?? 0); const dz = craft.z - rock.z;
    const distance = detHypot(detHypot(dx, dy), dz); const minimum = rock.r + craft.radius;
    if (distance < minimum && distance > .001) {
      craft.x = rock.x + dx / distance * minimum; s.y = (rock.y ?? 0) + dy / distance * minimum; craft.z = rock.z + dz / distance * minimum;
      const inward = Math.min(0, (s.vx * dx + s.vy * dy + s.vz * dz) / distance);
      s.vx -= inward * dx / distance; s.vy -= inward * dy / distance; s.vz -= inward * dz / distance;
    }
  }
  craft.speed = s.vx * f.x + s.vy * f.y + s.vz * f.z;
}
