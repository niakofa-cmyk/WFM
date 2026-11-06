import { detCos, detExp, detSin } from "./detmath";
import { integrateSpatialFlight, type FlightControls, type FlightTuning, type Rock, type SpatialCraft } from "./flight";
import { isOrbitalRuntimeId, ORBITAL_RUNTIME_ID, type OrbitalRuntimeId } from "./runtime";
import { applyHullDamage, sphereSweepTime, steerProjectileToward, targetSolution3d } from "./weapons";

export type SectorVector3 = { x: number; y: number; z: number };
export type SectorRotation = SectorVector3 & { w: number };
export type SectorFlightInput = {
  throttle: number; pitch: number; yaw: number; roll: number;
  boost: boolean; brake: boolean; fire: boolean; lock: boolean;
  missile: boolean; countermeasure: boolean;
  strafe?: number; vertical?: number; drift?: boolean;
};
export const NEUTRAL_SECTOR_FLIGHT_INPUT: SectorFlightInput = {
  throttle: 0, pitch: 0, yaw: 0, roll: 0, strafe: 0, vertical: 0,
  boost: false, brake: false, fire: false, lock: false, missile: false, countermeasure: false,
};
export type SectorRock = { id: string; position: SectorVector3; radius: number };
export type SectorFlightWorld = {
  id: string; version: number; radius: number; relay: SectorVector3; extraction: SectorVector3;
  rocks: SectorRock[]; drone?: SectorVector3; droneHull?: number;
  planet?: { position: SectorVector3; radius: number };
  hostileFireDisabled?: boolean;
};
export type SectorProjectile = {
  id: number; position: SectorVector3; velocity: SectorVector3; ttl: number;
  hostile: boolean; guided: boolean;
};
export type SectorFlightStage = "relay" | "drone" | "extract" | "complete" | "destroyed";
export type SectorFlightState<TShip extends string = string> = {
  shipId: TShip; position: SectorVector3; velocity: SectorVector3; orientation: SectorRotation;
  elapsed: number; hull: number; energy: number; missiles: number; lock: number;
  fireCooldown: number; missileCooldown: number; flareCooldown: number;
  collisionCooldown: number; droneCooldown: number; nextProjectile: number;
  drone: { position: SectorVector3; hull: number };
  projectiles: SectorProjectile[];
  stage: SectorFlightStage;
  discoveries: number; hits: number; collisions: number;
};
export type SectorFlightRuntime = "sector-motion-v1" | OrbitalRuntimeId;
export type SectorShipTuning = FlightTuning & { fireInterval: number };

const v = (x = 0, y = 0, z = 0): SectorVector3 => ({ x, y, z });
const add = (a: SectorVector3, b: SectorVector3) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: SectorVector3, b: SectorVector3) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: SectorVector3, k: number) => v(a.x * k, a.y * k, a.z * k);
const dot = (a: SectorVector3, b: SectorVector3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const sectorVectorLength = (a: SectorVector3) => Math.sqrt(dot(a, a));
const unit = (a: SectorVector3): SectorVector3 => mul(a, 1 / (sectorVectorLength(a) || 1));
const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(x) ? x : 0));

function product(a: SectorRotation, b: SectorRotation): SectorRotation {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}
export function sectorFlightForward(q: SectorRotation): SectorVector3 {
  return v(-2 * (q.x * q.z + q.w * q.y), -2 * (q.y * q.z - q.w * q.x), -(1 - 2 * (q.x * q.x + q.y * q.y)));
}
function rotateVector(q: SectorRotation, x: number, y: number, z: number): SectorVector3 {
  const tx = 2 * (q.y * z - q.z * y);
  const ty = 2 * (q.z * x - q.x * z);
  const tz = 2 * (q.x * y - q.y * x);
  return v(
    x + q.w * tx + q.y * tz - q.z * ty,
    y + q.w * ty + q.z * tx - q.x * tz,
    z + q.w * tz + q.x * ty - q.y * tx,
  );
}

const motionAdapters = new WeakMap<object, SpatialCraft>();
const collisionBodyCache = new WeakMap<SectorFlightWorld, readonly SectorRock[]>();
const targetingRockCache = new WeakMap<SectorFlightWorld, readonly Rock[]>();
function collisionBodies(world: SectorFlightWorld): readonly SectorRock[] {
  if (!world.planet) return world.rocks;
  const cached = collisionBodyCache.get(world);
  if (cached) return cached;
  const bodies = [...world.rocks, { id: "planet", ...world.planet }];
  collisionBodyCache.set(world, bodies);
  return bodies;
}
function targetingRocks(world: SectorFlightWorld): readonly Rock[] {
  const cached = targetingRockCache.get(world);
  if (cached) return cached;
  const rocks = collisionBodies(world).map((body) => ({
    x: body.position.x, y: body.position.y, z: body.position.z, r: body.radius,
  }));
  targetingRockCache.set(world, rocks);
  return rocks;
}

function orbitalMotion(state: SectorFlightState, input: SectorFlightInput, dt: number, tuning: SectorShipTuning) {
  let craft = motionAdapters.get(state);
  if (!craft) {
    craft = {
      id: 0, x: 0, z: 0, yaw: 0, pitch: 0, speed: 0, steer: 0,
      hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
      cloak: 0, untargetable: 0, radius: 2, lockTargetId: null,
      space: {
        y: 0, vx: 0, vy: 0, vz: 0, q: [0, 0, 0, 1], energy: 100,
        assist: true, armor: 0, armorMax: 0, lockProgress: 0,
        lockTargetId: null, missileCd: 0, ammo: 0, aimAssist: false,
      },
    };
    motionAdapters.set(state, craft);
  }
  const space = craft.space!;
  craft.x = state.position.x; craft.z = state.position.z;
  craft.hull = state.hull; craft.alive = state.hull > 0;
  space.y = state.position.y;
  space.vx = state.velocity.x; space.vy = state.velocity.y; space.vz = state.velocity.z;
  space.q[0] = state.orientation.x; space.q[1] = state.orientation.y;
  space.q[2] = state.orientation.z; space.q[3] = state.orientation.w;
  space.energy = state.energy;
  const controls: FlightControls = {
    throttle: clamp(input.throttle, 0, 1),
    yaw: -clamp(input.yaw, -1, 1),
    pitch: clamp(input.pitch, -1, 1),
    roll: -clamp(input.roll, -1, 1),
    strafe: -clamp(input.strafe ?? 0, -1, 1),
    vertical: clamp(input.vertical ?? 0, -1, 1),
    boost: input.boost, brake: input.brake, drift: input.drift,
  };
  integrateSpatialFlight(craft, controls, dt, 2, [], tuning, { boundaryRadius: null });
  state.position.x = craft.x; state.position.y = space.y; state.position.z = craft.z;
  state.velocity.x = space.vx; state.velocity.y = space.vy; state.velocity.z = space.vz;
  state.orientation.x = space.q[0]; state.orientation.y = space.q[1];
  state.orientation.z = space.q[2]; state.orientation.w = space.q[3];
  state.energy = space.energy;
  return sectorVectorLength(state.velocity);
}

export function removeHostileSectorProjectilesInPlace(projectiles: SectorProjectile[]): void {
  let write = 0;
  for (let read = 0; read < projectiles.length; read++) {
    const projectile = projectiles[read]!;
    if (!projectile.hostile) projectiles[write++] = projectile;
  }
  projectiles.length = write;
}

export function createSectorFlight<TShip extends string>(
  shipId: TShip,
  world: SectorFlightWorld,
): SectorFlightState<TShip> {
  return {
    shipId, position: v(0, 0, 70), velocity: v(), orientation: { ...v(), w: 1 },
    elapsed: 0, hull: 100, energy: 100, missiles: 3, lock: 0,
    fireCooldown: 0, missileCooldown: 0, flareCooldown: 0, collisionCooldown: 0,
    droneCooldown: 4, nextProjectile: 0,
    drone: { position: world.drone ? { ...world.drone } : v(0, 48, -210), hull: world.droneHull ?? 60 },
    projectiles: [], stage: "relay", discoveries: 0, hits: 0, collisions: 0,
  };
}
export function sectorFlightObjective(
  state: SectorFlightState,
  world: SectorFlightWorld,
): { label: string; position: SectorVector3 } {
  if (state.stage === "relay") return { label: "Investigate damaged relay", position: world.relay };
  if (state.stage === "drone") return { label: "Disable the training drone", position: state.drone.position };
  return { label: "Return to extraction beacon", position: world.extraction };
}
export function canAcquireSectorTarget(state: SectorFlightState, world: SectorFlightWorld): boolean {
  if (state.stage !== "drone" || state.drone.hull <= 0) return false;
  const forward = sectorFlightForward(state.orientation);
  return targetSolution3d(
    {
      id: 0, x: state.position.x, y: state.position.y, z: state.position.z,
      fx: forward.x, fy: forward.y, fz: forward.z, alive: state.hull > 0,
    },
    {
      id: 1, x: state.drone.position.x, y: state.drone.position.y, z: state.drone.position.z,
      alive: state.drone.hull > 0,
    },
    targetingRocks(world),
    { maxRange: 350, minForwardDot: .94 },
  ).available;
}

/** Canonical local operation simulation. Server-run co-op never calls this function. */
export function stepSectorFlight(
  state: SectorFlightState,
  input: SectorFlightInput,
  seconds: number,
  world: SectorFlightWorld,
  tuning: SectorShipTuning,
  runtime: SectorFlightRuntime = ORBITAL_RUNTIME_ID,
): void {
  if (state.stage === "complete" || state.stage === "destroyed" || !Number.isFinite(seconds) || seconds <= 0) return;
  const dt = Math.min(seconds, 1 / 30);
  state.elapsed += dt;
  for (const key of ["fireCooldown", "missileCooldown", "flareCooldown", "collisionCooldown", "droneCooldown"] as const) {
    state[key] = Math.max(0, state[key] - dt);
  }
  const previous = { ...state.position };
  let speed: number, next: SectorVector3;
  if (isOrbitalRuntimeId(runtime)) {
    speed = orbitalMotion(state, input, dt, tuning);
    next = state.position;
  } else {
    const turn = tuning.turnRate * (.45 + tuning.handling * .25);
    const angular = v(clamp(input.pitch, -1, 1), -clamp(input.yaw, -1, 1), -clamp(input.roll, -1, 1));
    const angle = sectorVectorLength(angular) * turn * dt;
    if (angle > 0) {
      const axis = unit(angular), half = angle * .5;
      const q = product(state.orientation, { ...mul(axis, detSin(half)), w: detCos(half) });
      const norm = Math.sqrt(dot(q, q) + q.w * q.w);
      state.orientation = { ...mul(q, 1 / norm), w: q.w / norm };
    }
    const boosting = input.boost && state.energy > 2 && !input.brake;
    state.energy = clamp(state.energy + (boosting ? -28 : 13) * dt, 0, 100);
    const forward = sectorFlightForward(state.orientation);
    const right = rotateVector(state.orientation, 1, 0, 0);
    const up = rotateVector(state.orientation, 0, 1, 0);
    const thrust = add(add(mul(forward, clamp(input.throttle, 0, 1)), mul(right, clamp(input.strafe ?? 0, -1, 1))), mul(up, clamp(input.vertical ?? 0, -1, 1)));
    const thrustLength = sectorVectorLength(thrust);
    const thrustScale = thrustLength > 1 ? 1 / thrustLength : 1;
    const acceleration = tuning.accel * (boosting ? 2.6 : 1.4) * dt * thrustScale;
    state.velocity = add(state.velocity, mul(thrust, acceleration));
    state.velocity = mul(state.velocity, detExp(-(input.brake ? 5 : input.drift ? .04 : .32) * dt));
    speed = sectorVectorLength(state.velocity);
    const max = tuning.maxSpeed * (boosting ? 4 : 2.5);
    if (speed > max) state.velocity = mul(state.velocity, max / speed);
    next = add(previous, mul(state.velocity, dt));
  }
  let nearest: { rock: SectorRock; t: number } | null = null;
  const bodies = collisionBodies(world);
  for (const rock of bodies) {
    const t = sphereSweepTime(previous, next, rock.position, rock.radius + 2);
    if (t !== null && (!nearest || t < nearest.t)) nearest = { rock, t };
  }
  if (nearest) {
    const hit = add(previous, mul(sub(next, previous), nearest.t));
    const normal = unit(sub(hit, nearest.rock.position));
    next = add(nearest.rock.position, mul(sectorVectorLength(normal) ? normal : v(0, 1, 0), nearest.rock.radius + 2.05));
    state.velocity = mul(sub(state.velocity, mul(normal, 2 * dot(state.velocity, normal))), .25);
    if (!state.collisionCooldown && speed > 2) {
      applyHullDamage(state, Math.min(18, speed * .2));
      state.collisions++;
      state.collisionCooldown = .7;
    }
  }
  if (sectorVectorLength(next) > world.radius) {
    next = mul(unit(next), world.radius);
    state.velocity = mul(state.velocity, -.2);
  }
  state.position.x = next.x; state.position.y = next.y; state.position.z = next.z;

  // This operation adapter supplies the relay, hostile drone, and extraction gates.
  if (state.stage === "relay" && sectorVectorLength(sub(next, world.relay)) < 24) {
    state.stage = "drone";
    state.discoveries = 1;
  }
  if (state.stage === "drone" && state.drone.hull <= 0) state.stage = "extract";
  if (state.stage === "extract" && sectorVectorLength(sub(next, world.extraction)) < 26) state.stage = "complete";

  state.lock = clamp(state.lock + ((input.lock && canAcquireSectorTarget(state, world)) ? dt / 1.2 : -dt * 2), 0, 1);
  const launch = (hostile: boolean, guided: boolean) => {
    const origin = hostile ? state.drone.position : state.position;
    const direction = hostile ? unit(sub(state.position, origin)) : sectorFlightForward(state.orientation);
    const projectileSpeed = guided ? 85 : 190;
    if (state.projectiles.length < 64) state.projectiles.push({
      id: state.nextProjectile++, position: add(origin, mul(direction, 4)),
      velocity: mul(direction, projectileSpeed), ttl: guided ? 7 : 2.5, hostile, guided,
    });
  };
  if (input.fire && !state.fireCooldown) {
    launch(false, false);
    state.fireCooldown = Math.max(.12, tuning.fireInterval);
  }
  if (input.missile && state.lock >= 1 && !state.missileCooldown && state.missiles > 0) {
    launch(false, true);
    state.missiles--;
    state.missileCooldown = 2;
    state.lock = 0;
  }
  if (state.stage === "drone" && !world.hostileFireDisabled && !state.droneCooldown) {
    launch(true, true);
    state.droneCooldown = 5;
  }
  if (input.countermeasure && !state.flareCooldown) {
    let write = 0;
    for (let read = 0; read < state.projectiles.length; read++) {
      const projectile = state.projectiles[read]!;
      if (!projectile.hostile || !projectile.guided) state.projectiles[write++] = projectile;
    }
    state.projectiles.length = write;
    state.flareCooldown = 8;
  }
  let liveProjectiles = 0;
  for (let read = 0; read < state.projectiles.length; read++) {
    const projectile = state.projectiles[read]!;
    projectile.ttl -= dt;
    if (projectile.ttl <= 0) continue;
    const target = projectile.hostile ? state.position : state.drone.position;
    if (projectile.guided) {
      if (isOrbitalRuntimeId(runtime)) {
        const guided = {
          ...projectile.position,
          vx: projectile.velocity.x, vy: projectile.velocity.y, vz: projectile.velocity.z,
        };
        steerProjectileToward(guided, target, dt, 3);
        projectile.velocity.x = guided.vx;
        projectile.velocity.y = guided.vy ?? 0;
        projectile.velocity.z = guided.vz;
      } else {
        // Keep the authoritative co-op compatibility curve unchanged until its
        // client/server runtime is migrated and replay-certified together.
        const desired = mul(unit(sub(target, projectile.position)), 85);
        projectile.velocity = mul(unit(add(
          mul(projectile.velocity, 1 - dt * 3),
          mul(desired, dt * 3),
        )), 85);
      }
    }
    const end = add(projectile.position, mul(projectile.velocity, dt));
    const targetHit = sphereSweepTime(projectile.position, end, target, projectile.hostile ? 3 : 7);
    let coverHit: number | null = null;
    for (const rock of bodies) {
      const t = sphereSweepTime(projectile.position, end, rock.position, rock.radius);
      if (t !== null && (coverHit === null || t < coverHit)) coverHit = t;
    }
    if (coverHit !== null && (targetHit === null || coverHit <= targetHit)) continue;
    if (targetHit !== null) {
      if (projectile.hostile) applyHullDamage(state, 12);
      else if (state.stage === "drone") {
        applyHullDamage(state.drone, projectile.guided ? 40 : 12);
        state.hits++;
      }
      continue;
    }
    projectile.position = end;
    state.projectiles[liveProjectiles++] = projectile;
  }
  state.projectiles.length = liveProjectiles;
  if (state.hull <= 0) state.stage = "destroyed";
}
