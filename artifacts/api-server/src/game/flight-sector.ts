import { SHIPS, type ShipId } from "./ships";
import { detSin, detCos, detExp } from "./detmath";

// Deliberately separate from reward-eligible sim.ts. No network, storage or rewards.
export type Vector3 = { x: number; y: number; z: number };
export type Rotation = Vector3 & { w: number };
export type FlightInput = {
  throttle: number; pitch: number; yaw: number; roll: number;
  boost: boolean; brake: boolean; fire: boolean; lock: boolean;
  missile: boolean; countermeasure: boolean;
  drift?: boolean;
};
export const NEUTRAL_FLIGHT_INPUT: FlightInput = {
  throttle: 0, pitch: 0, yaw: 0, roll: 0,
  boost: false, brake: false, fire: false, lock: false, missile: false, countermeasure: false,
};
export type SectorRock = { id: string; position: Vector3; radius: number };
export type FlightSector = {
  id: string; version: number; radius: number; relay: Vector3; extraction: Vector3;
  rocks: SectorRock[]; drone?: Vector3; droneHull?: number;
  planet?: { position: Vector3; radius: number };
  hostileFireDisabled?: boolean;
};
export const RUST_DISC_SECTOR: FlightSector = {
  id: "rust-disc-flight-v1", version: 1, radius: 460,
  relay: { x: 0, y: 32, z: -110 },
  extraction: { x: 100, y: 20, z: -160 },
  rocks: [
    [-42, 3, -20, 16], [35, 12, -60, 12], [-32, 48, -130, 15],
    [45, -15, -155, 19], [-65, 22, -195, 24], [58, 65, -240, 18],
    [115, -28, -85, 26], [-115, -30, -90, 30], [10, 85, -100, 13],
    [130, 70, -260, 34], [-145, 50, -240, 28], [18, -80, -210, 25],
    [170, 0, 30, 28], [-160, 90, 45, 32], [35, 125, -330, 35],
  ].map(([x, y, z, radius], i) => ({
    id: `rock-${i}`, position: { x: x!, y: y!, z: z! }, radius: radius!,
  })) as SectorRock[],
};
export type FlightProjectile = {
  id: number; position: Vector3; velocity: Vector3; ttl: number;
  hostile: boolean; guided: boolean;
};
export type FlightState = {
  shipId: ShipId; position: Vector3; velocity: Vector3; orientation: Rotation;
  elapsed: number; hull: number; energy: number; missiles: number; lock: number;
  fireCooldown: number; missileCooldown: number; flareCooldown: number;
  collisionCooldown: number; droneCooldown: number; nextProjectile: number;
  drone: { position: Vector3; hull: number };
  projectiles: FlightProjectile[];
  stage: "relay" | "drone" | "extract" | "complete" | "destroyed";
  discoveries: number; hits: number; collisions: number;
};
export function removeHostileProjectilesInPlace(projectiles: FlightProjectile[]): void {
  let write = 0;
  for (let read = 0; read < projectiles.length; read++) {
    const projectile = projectiles[read]!;
    if (!projectile.hostile) projectiles[write++] = projectile;
  }
  projectiles.length = write;
}
const v = (x = 0, y = 0, z = 0): Vector3 => ({ x, y, z });
const add = (a: Vector3, b: Vector3): Vector3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vector3, b: Vector3): Vector3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vector3, k: number): Vector3 => v(a.x * k, a.y * k, a.z * k);
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vectorLength = (a: Vector3) => Math.sqrt(dot(a, a));
const unit = (a: Vector3): Vector3 => mul(a, 1 / (vectorLength(a) || 1));
const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(x) ? x : 0));
function product(a: Rotation, b: Rotation): Rotation {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}
export function flightForward(q: Rotation): Vector3 {
  return v(-2 * (q.x * q.z + q.w * q.y), -2 * (q.y * q.z - q.w * q.x), -(1 - 2 * (q.x * q.x + q.y * q.y)));
}
/** First normalized segment intersection, including start-inside; null means no hit. */
export function sphereHit(a: Vector3, b: Vector3, center: Vector3, radius: number): number | null {
  // Keep the hot collision path allocation-free: this runs for each live
  // projectile/rock pair on every simulation tick, including server rooms.
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const mx = a.x - center.x, my = a.y - center.y, mz = a.z - center.z;
  const c = mx * mx + my * my + mz * mz - radius * radius;
  if (c <= 0) return 0;
  const dd = dx * dx + dy * dy + dz * dz;
  const md = mx * dx + my * dy + mz * dz;
  const discriminant = md * md - dd * c;
  if (dd < 1e-12 || discriminant < 0) return null;
  const t = (-md - Math.sqrt(discriminant)) / dd;
  return t >= 0 && t <= 1 ? t : null;
}
export function createFlight(shipId: ShipId = "glide", sector: FlightSector = RUST_DISC_SECTOR): FlightState {
  return {
    shipId, position: v(0, 0, 70), velocity: v(), orientation: { ...v(), w: 1 },
    elapsed: 0, hull: 100, energy: 100, missiles: 3, lock: 0,
    fireCooldown: 0, missileCooldown: 0, flareCooldown: 0, collisionCooldown: 0,
    droneCooldown: 4, nextProjectile: 0,
    drone: { position: sector.drone ? { ...sector.drone } : v(0, 48, -210), hull: sector.droneHull ?? 60 }, projectiles: [],
    stage: "relay", discoveries: 0, hits: 0, collisions: 0,
  };
}
export function flightObjective(state: FlightState, sector: FlightSector = RUST_DISC_SECTOR): { label: string; position: Vector3 } {
  if (state.stage === "relay") return { label: "Investigate damaged relay", position: sector.relay };
  if (state.stage === "drone") return { label: "Disable the training drone", position: state.drone.position };
  return { label: "Return to extraction beacon", position: sector.extraction };
}
export function canLock(state: FlightState, sector: FlightSector = RUST_DISC_SECTOR): boolean {
  if (state.stage !== "drone" || state.drone.hull <= 0) return false;
  const toward = sub(state.drone.position, state.position);
  if (vectorLength(toward) >= 350 || dot(flightForward(state.orientation), unit(toward)) <= 0.94) return false;
  for (const rock of collisionBodies(sector)) {
    if (sphereHit(state.position, state.drone.position, rock.position, rock.radius) !== null) return false;
  }
  return true;
}
const collisionBodyCache = new WeakMap<FlightSector, readonly SectorRock[]>();
function collisionBodies(sector: FlightSector): readonly SectorRock[] {
  if (!sector.planet) return sector.rocks;
  const cached = collisionBodyCache.get(sector);
  if (cached) return cached;
  // Sector collision geometry is immutable after construction; only mission
  // flags such as hostileFireDisabled change during a flight.
  const bodies = [...sector.rocks, { id: "mars", ...sector.planet }];
  collisionBodyCache.set(sector, bodies);
  return bodies;
}
/** Fixed-tick, mutable local trainer. Caller owns pause/accumulator; no catch-up on restore. */
export function stepFlight(state: FlightState, input: FlightInput, seconds: number, sector: FlightSector = RUST_DISC_SECTOR): void {
  if (state.stage === "complete" || state.stage === "destroyed" || !Number.isFinite(seconds) || seconds <= 0) return;
  const dt = Math.min(seconds, 1 / 30);
  const def = SHIPS[state.shipId];
  state.elapsed += dt;
  for (const key of ["fireCooldown", "missileCooldown", "flareCooldown", "collisionCooldown", "droneCooldown"] as const) {
    state[key] = Math.max(0, state[key] - dt);
  }
  const turn = def.turnRate * (0.45 + def.handling * 0.25);
  const angular = v(clamp(input.pitch, -1, 1), -clamp(input.yaw, -1, 1), -clamp(input.roll, -1, 1));
  const angle = vectorLength(angular) * turn * dt;
  if (angle > 0) {
    const axis = unit(angular), half = angle * 0.5;
    const q = product(state.orientation, { ...mul(axis, detSin(half)), w: detCos(half) });
    const norm = Math.sqrt(dot(q, q) + q.w * q.w);
    state.orientation = { ...mul(q, 1 / norm), w: q.w / norm };
  }
  const boosting = input.boost && state.energy > 2 && !input.brake;
  state.energy = clamp(state.energy + (boosting ? -28 : 13) * dt, 0, 100);
  const acceleration = def.accel * (boosting ? 2.6 : 1.4) * clamp(input.throttle, 0, 1);
  state.velocity = add(state.velocity, mul(flightForward(state.orientation), acceleration * dt));
  const drag = input.brake ? 5 : input.drift ? 0.04 : 0.32;
  state.velocity = mul(state.velocity, detExp(-drag * dt));
  const speed = vectorLength(state.velocity), max = def.maxSpeed * (boosting ? 4 : 2.5);
  if (speed > max) state.velocity = mul(state.velocity, max / speed);
  const previous = state.position;
  let next = add(previous, mul(state.velocity, dt));
  let nearest: { rock: SectorRock; t: number } | null = null;
  const bodies = collisionBodies(sector);
  for (const rock of bodies) {
    const t = sphereHit(previous, next, rock.position, rock.radius + 2);
    if (t !== null && (!nearest || t < nearest.t)) nearest = { rock, t };
  }
  if (nearest) {
    const hit = add(previous, mul(sub(next, previous), nearest.t));
    const normal = unit(sub(hit, nearest.rock.position));
    next = add(nearest.rock.position, mul(vectorLength(normal) ? normal : v(0, 1, 0), nearest.rock.radius + 2.05));
    state.velocity = mul(sub(state.velocity, mul(normal, 2 * dot(state.velocity, normal))), 0.25);
    if (!state.collisionCooldown && speed > 2) {
      state.hull = Math.max(0, state.hull - Math.min(18, speed * 0.2));
      state.collisions++; state.collisionCooldown = 0.7;
    }
  }
  if (vectorLength(next) > sector.radius) {
    next = mul(unit(next), sector.radius); state.velocity = mul(state.velocity, -0.2);
  }
  state.position = next;
  if (state.stage === "relay" && vectorLength(sub(next, sector.relay)) < 24) {
    state.stage = "drone"; state.discoveries = 1;
  }
  if (state.stage === "drone" && state.drone.hull <= 0) state.stage = "extract";
  if (state.stage === "extract" && vectorLength(sub(next, sector.extraction)) < 26) state.stage = "complete";
  state.lock = clamp(state.lock + ((input.lock && canLock(state, sector)) ? dt / 1.2 : -dt * 2), 0, 1);
  const launch = (hostile: boolean, guided: boolean) => {
    const origin = hostile ? state.drone.position : state.position;
    const direction = hostile ? unit(sub(state.position, origin)) : flightForward(state.orientation);
    const projectileSpeed = guided ? 85 : 190;
    if (state.projectiles.length < 64) state.projectiles.push({
      id: state.nextProjectile++, position: add(origin, mul(direction, 4)),
      velocity: mul(direction, projectileSpeed), ttl: guided ? 7 : 2.5, hostile, guided,
    });
  };
  if (input.fire && !state.fireCooldown) { launch(false, false); state.fireCooldown = Math.max(0.12, def.fireInterval); }
  if (input.missile && state.lock >= 1 && !state.missileCooldown && state.missiles > 0) {
    launch(false, true); state.missiles--; state.missileCooldown = 2; state.lock = 0;
  }
  if (state.stage === "drone" && !sector.hostileFireDisabled && !state.droneCooldown) { launch(true, true); state.droneCooldown = 5; }
  if (input.countermeasure && !state.flareCooldown) {
    let write = 0;
    for (let read = 0; read < state.projectiles.length; read++) {
      const projectile = state.projectiles[read]!;
      if (!projectile.hostile || !projectile.guided) state.projectiles[write++] = projectile;
    }
    state.projectiles.length = write;
    state.flareCooldown = 8;
  }
  // Compact in place instead of allocating a new array on every fixed tick.
  // This substantially reduces garbage collection during multi-pilot combat.
  let liveProjectiles = 0;
  for (let read = 0; read < state.projectiles.length; read++) {
    const projectile = state.projectiles[read]!;
    projectile.ttl -= dt;
    if (projectile.ttl <= 0) continue;
    const target = projectile.hostile ? state.position : state.drone.position;
    if (projectile.guided) {
      const desired = mul(unit(sub(target, projectile.position)), 85);
      projectile.velocity = mul(unit(add(mul(projectile.velocity, 1 - dt * 3), mul(desired, dt * 3))), 85);
    }
    const end = add(projectile.position, mul(projectile.velocity, dt));
    const targetHit = sphereHit(projectile.position, end, target, projectile.hostile ? 3 : 7);
    let coverHit: number | null = null;
    for (const rock of bodies) {
      const t = sphereHit(projectile.position, end, rock.position, rock.radius);
      if (t !== null && (coverHit === null || t < coverHit)) coverHit = t;
    }
    if (coverHit !== null && (targetHit === null || coverHit <= targetHit)) continue;
    if (targetHit !== null) {
      if (projectile.hostile) state.hull = Math.max(0, state.hull - 12);
      else if (state.stage === "drone") {
        state.drone.hull = Math.max(0, state.drone.hull - (projectile.guided ? 40 : 12)); state.hits++;
      }
      continue;
    }
    projectile.position = end;
    state.projectiles[liveProjectiles++] = projectile;
  }
  state.projectiles.length = liveProjectiles;
  if (state.hull <= 0) state.stage = "destroyed";
}
