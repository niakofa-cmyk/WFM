import { detAcos, detCos, detHypot } from "./detmath";
import { LOCK_SECONDS, MISSILE_RANGE, PROJECTILE_LIMIT, rotate, type Rock, type SpatialBullet, type SpatialCraft } from "./flight";
import type { MissileDefinition, PrimaryWeaponDefinition } from "./weapons-catalog";

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
export function sphereSweepTime(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  center: { x: number; y: number; z: number },
  radius: number,
): number | null {
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

export type TargetSolutionRules = {
  maxRange?: number;
  /** Minimum forward-axis dot product; .94 matches the Rust Disc lock cone. */
  minForwardDot?: number;
};
export type TargetingFrame = {
  id?: number;
  x: number; y: number; z: number;
  fx: number; fy: number; fz: number;
  alive: boolean;
  jammed?: boolean;
};
export type TargetingContact = {
  id: number;
  x: number; y: number; z: number;
  alive: boolean;
  cloak?: number;
  untargetable?: number;
};
export function targetSolution3d(
  pilot: TargetingFrame,
  target: TargetingContact,
  rocks: readonly Rock[] = [],
  rules: TargetSolutionRules = {},
) {
  const dx = target.x - pilot.x, dy = target.y - pilot.y, dz = target.z - pilot.z;
  const distance = hypot3(dx, dy, dz);
  const dot = (pilot.fx * dx + pilot.fy * dy + pilot.fz * dz) / Math.max(.001, distance);
  const blocked = rocks.some((rock) => segmentHit(
    rock.x, rock.y ?? 0, rock.z, target, pilot.x, pilot.y, pilot.z, rock.r,
  ));
  return {
    distance,
    angle: detAcos(Math.max(-1, Math.min(1, dot))),
    available: pilot.alive && target.alive && target.id !== pilot.id &&
      (target.cloak ?? 0) <= 0 && (target.untargetable ?? 0) <= 0 &&
      !pilot.jammed && distance <= (rules.maxRange ?? MISSILE_RANGE) &&
      dot >= (rules.minForwardDot ?? detCos(.3)) && !blocked,
  };
}
export function targetSolution(
  pilot: SpatialCraft,
  target: SpatialCraft,
  rocks: readonly Rock[] = [],
  rules: TargetSolutionRules = {},
) {
  const s = pilot.space;
  if (!s) return { distance: Infinity, angle: Math.PI, available: false };
  const f = rotate(s.q, 0, 0, -1);
  return targetSolution3d(
    { id: pilot.id, x: pilot.x, y: s.y, z: pilot.z, fx: f.x, fy: f.y, fz: f.z, alive: pilot.alive, jammed: pilot.jam > 0 },
    { id: target.id, x: target.x, y: target.space?.y ?? 0, z: target.z, alive: target.alive, cloak: target.cloak, untargetable: target.untargetable },
    rocks,
    { ...rules, minForwardDot: rules.minForwardDot ?? detCos(.3) },
  );
}
export function acquireTarget(
  pilot: SpatialCraft,
  target: SpatialCraft | undefined,
  dt: number,
  rocks: readonly Rock[] = [],
  missile?: MissileDefinition,
) {
  const s = pilot.space;
  if (!s) throw new Error("Acquisition requires orbital state.");
  s.missileCd = Math.max(0, s.missileCd - dt);
  if (s.lockTargetId !== pilot.lockTargetId) {
    s.lockProgress = 0;
    s.lockTargetId = pilot.lockTargetId;
  }
  const available = !!target && targetSolution(pilot, target, rocks, missile ? {
    maxRange: missile.maxLockRange,
    minForwardDot: detCos(missile.lockConeRadians),
  } : {}).available;
  s.lockProgress = available
    ? Math.min(1, s.lockProgress + dt / (missile?.lockSeconds ?? LOCK_SECONDS))
    : 0;
}
function missileSolutionAvailable(
  pilot: SpatialCraft,
  target: SpatialCraft | undefined,
  rocks: readonly Rock[],
  missile?: MissileDefinition,
) {
  return !!target && target.id === pilot.lockTargetId && targetSolution(pilot, target, rocks, missile ? {
    maxRange: missile.maxLockRange,
    minForwardDot: detCos(missile.lockConeRadians),
  } : {}).available;
}
function missileCanLaunch(
  pilot: SpatialCraft,
  target: SpatialCraft | undefined,
  count: number,
  rocks: readonly Rock[],
  missile?: MissileDefinition,
) {
  const s = pilot.space;
  if (!s || !pilot.alive || pilot.root > 0 || s.ammo < (missile?.ammoCost ?? 1) ||
      s.missileCd > 0 || s.lockProgress < 1 || s.lockTargetId !== pilot.lockTargetId ||
      count + (missile?.projectilesPerLaunch ?? 1) > PROJECTILE_LIMIT) return false;
  return missileSolutionAvailable(pilot, target, rocks, missile);
}
export function spawnMissile(pilot: SpatialCraft, target: SpatialCraft | undefined, count: number, damage: number, rocks: readonly Rock[] = []): SpatialBullet | null {
  const s = pilot.space;
  if (!s || !target || !missileCanLaunch(pilot, target, count, rocks)) return null;
  const f = rotate(s.q, 0, 0, -1);
  s.ammo--; s.missileCd = 3.5;
  return { x: pilot.x + f.x * 2.5, y: s.y + f.y * 2.5, z: pilot.z + f.z * 2.5,
    vx: f.x * 38, vy: f.y * 38, vz: f.z * 38, life: 4, dmg: damage, r: .5, homeId: target.id, missile: true };
}
export function spawnMissileVolley(
  pilot: SpatialCraft,
  target: SpatialCraft | undefined,
  count: number,
  damage: number,
  rocks: readonly Rock[],
  missile: MissileDefinition,
): SpatialBullet[] {
  const s = pilot.space;
  if (!s || !missileCanLaunch(pilot, target, count, rocks, missile) || !target) return [];
  const projectileCount = missile.projectilesPerLaunch;
  s.ammo -= missile.ammoCost;
  s.missileCd = missile.cooldownSeconds;
  const forward = rotate(s.q, 0, 0, -1);
  const right = rotate(s.q, 1, 0, 0);
  return Array.from({ length: projectileCount }, (_, index) => {
    const offset = projectileCount === 1
      ? 0
      : (index / (projectileCount - 1) - 0.5) * missile.spreadRadians;
    const forwardScale = detCos(offset);
    const lateralScale = detCos(Math.PI / 2 - offset);
    const direction = {
      x: forward.x * forwardScale + right.x * lateralScale,
      y: forward.y * forwardScale + right.y * lateralScale,
      z: forward.z * forwardScale + right.z * lateralScale,
    };
    const length = Math.max(0.001, hypot3(direction.x, direction.y, direction.z));
    direction.x /= length; direction.y /= length; direction.z /= length;
    return {
      x: pilot.x + direction.x * 2.5,
      y: s.y + direction.y * 2.5,
      z: pilot.z + direction.z * 2.5,
      vx: direction.x * missile.launchSpeed,
      vy: direction.y * missile.launchSpeed,
      vz: direction.z * missile.launchSpeed,
      life: missile.lifetimeSeconds,
      dmg: damage * missile.damageScale / projectileCount,
      r: missile.projectileRadius,
      homeId: target.id,
      missile: true,
      weaponId: missile.fitId,
      turnRate: missile.turnRateRadiansPerSecond,
      launcherId: pilot.id,
      guidance: missile.guidance,
      countermeasureClass: missile.countermeasureClass,
      visualEffect: missile.visualEffect,
      audioCue: missile.audioCue,
    };
  });
}
export function spawnPrimary(
  pilot: SpatialCraft,
  target: SpatialCraft | undefined,
  speed: number,
  damage: number,
  rocks: readonly Rock[] = [],
  weapon?: PrimaryWeaponDefinition,
): SpatialBullet {
  const s = pilot.space;
  if (!s) throw new Error("Spatial primary requires orbital state.");
  let direction = rotate(s.q, 0, 0, -1);
  const effectiveSpeed = speed * (weapon?.projectileSpeedScale ?? 1);
  const solution = target && targetSolution(pilot, target, rocks);
  if (s.aimAssist && target && solution?.available && solution.angle < .22) {
    const t = distance3(pilot, target) / effectiveSpeed;
    const dx = target.x + (target.space?.vx ?? 0) * t - pilot.x;
    const dy = (target.space?.y ?? 0) + (target.space?.vy ?? 0) * t - s.y;
    const dz = target.z + (target.space?.vz ?? 0) * t - pilot.z;
    const length = Math.max(.001, hypot3(dx, dy, dz));
    direction = { x: dx / length, y: dy / length, z: dz / length };
  }
  return { x: pilot.x + direction.x * 2, y: s.y + direction.y * 2, z: pilot.z + direction.z * 2,
    vx: direction.x * effectiveSpeed, vy: direction.y * effectiveSpeed, vz: direction.z * effectiveSpeed,
    life: weapon?.projectileLifetimeSeconds ?? 1.6,
    dmg: damage * (weapon?.damageScale ?? 1),
    r: weapon?.projectileRadius ?? .3,
    homeId: null,
    weaponId: weapon?.fitId,
    visualEffect: weapon?.visualEffect,
    audioCue: weapon?.audioCue,
  };
}
export function spawnPrimaryVolley(
  pilot: SpatialCraft,
  target: SpatialCraft | undefined,
  speed: number,
  damage: number,
  rocks: readonly Rock[],
  weapon: PrimaryWeaponDefinition,
): SpatialBullet[] {
  const first = spawnPrimary(pilot, target, speed, damage, rocks, weapon);
  if (weapon.volleyCount <= 1) return [first];
  const s = pilot.space!;
  const forward = { x: first.vx, y: first.vy ?? 0, z: first.vz };
  const forwardLength = Math.max(0.001, hypot3(forward.x, forward.y, forward.z));
  forward.x /= forwardLength; forward.y /= forwardLength; forward.z /= forwardLength;
  const right = rotate(s.q, 1, 0, 0);
  return Array.from({ length: weapon.volleyCount }, (_, index) => {
    const offset = (index / (weapon.volleyCount - 1) - 0.5) * weapon.spreadRadians;
    const forwardScale = detCos(offset);
    const lateralScale = detCos(Math.PI / 2 - offset);
    const direction = {
      x: forward.x * forwardScale + right.x * lateralScale,
      y: forward.y * forwardScale + right.y * lateralScale,
      z: forward.z * forwardScale + right.z * lateralScale,
    };
    const length = Math.max(0.001, hypot3(direction.x, direction.y, direction.z));
    direction.x /= length; direction.y /= length; direction.z /= length;
    return {
      ...first,
      vx: direction.x * speed * weapon.projectileSpeedScale,
      vy: direction.y * speed * weapon.projectileSpeedScale,
      vz: direction.z * speed * weapon.projectileSpeedScale,
      dmg: first.dmg / weapon.volleyCount,
    };
  });
}
export const COUNTERMEASURE_COOLDOWN_SECONDS = 3.5;
export const HARDENED_MISSILE_DISRUPTION_SECONDS = 0.55;
export type CountermeasureResult = { activated: boolean; decoyed: number; disrupted: number };

/**
 * Orbital v3 flares only affect missiles currently tracking this pilot.
 * Standard seekers are decoyed into ballistic flight; hardened seekers retain
 * their target but temporarily lose steering, leaving a window to evade.
 */
export function deployCountermeasure(
  bullets: Array<SpatialBullet & { faction: string }>,
  pilot: SpatialCraft & { faction: string },
): CountermeasureResult {
  const flight = pilot.space;
  if (!flight || flight.countermeasureCd === undefined || flight.countermeasureCd > 0) {
    return { activated: false, decoyed: 0, disrupted: 0 };
  }
  const incoming = bullets.filter((bullet) =>
    bullet.missile === true && bullet.faction !== pilot.faction && bullet.homeId === pilot.id,
  );
  if (incoming.length === 0) return { activated: false, decoyed: 0, disrupted: 0 };

  flight.countermeasureCd = COUNTERMEASURE_COOLDOWN_SECONDS;
  let decoyed = 0;
  let disrupted = 0;
  for (const bullet of incoming) {
    if (bullet.countermeasureClass === "hardened") {
      bullet.guidanceSuppressed = Math.max(
        bullet.guidanceSuppressed ?? 0,
        HARDENED_MISSILE_DISRUPTION_SECONDS,
      );
      disrupted++;
    } else {
      bullet.homeId = null;
      decoyed++;
    }
  }
  return { activated: true, decoyed, disrupted };
}

export function guideMissile(
  b: SpatialBullet,
  target: SpatialCraft | undefined,
  dt: number,
  launcher?: Pick<SpatialCraft, "lockTargetId">,
) {
  if ((b.guidanceSuppressed ?? 0) > 0) {
    b.guidanceSuppressed = Math.max(0, b.guidanceSuppressed! - dt);
    return;
  }
  if (!target) return;
  if (b.guidance === "semi-active" && launcher?.lockTargetId !== b.homeId) return;
  steerProjectileToward(b, { x: target.x, y: target.space?.y ?? 0, z: target.z }, dt, b.turnRate ?? 2.5);
}
export function steerProjectileToward(
  b: { x: number; y?: number; z: number; vx: number; vy?: number; vz: number },
  target: { x: number; y: number; z: number },
  dt: number,
  turnRate = 2.5,
) {
  const dx = target.x - b.x; const dy = target.y - (b.y ?? 0); const dz = target.z - b.z;
  const distance = Math.max(.001, hypot3(dx, dy, dz));
  const speed = hypot3(b.vx, b.vy ?? 0, b.vz);
  if (speed <= 0) throw new Error("Guided projectile must have positive speed.");
  const dot = (b.vx * dx + (b.vy ?? 0) * dy + b.vz * dz) / Math.max(.001, speed * distance);
  const angle = detAcos(Math.max(-1, Math.min(1, dot)));
  const mix = angle < 1e-5 ? 1 : Math.min(1, turnRate * dt / angle);
  let vx = b.vx / speed * (1 - mix) + dx / distance * mix;
  let vy = (b.vy ?? 0) / speed * (1 - mix) + dy / distance * mix;
  let vz = b.vz / speed * (1 - mix) + dz / distance * mix;
  const length = Math.max(.001, hypot3(vx, vy, vz));
  vx /= length; vy /= length; vz /= length;
  b.vx = vx * speed; b.vy = vy * speed; b.vz = vz * speed;
}
export function applyHullDamage(target: { hull: number }, incoming: number) {
  const applied = Math.min(Math.max(0, target.hull), Math.max(0, incoming));
  target.hull -= applied;
  return applied;
}
export function absorbArmor(state: { armor: number }, incoming: number) {
  const absorbed = Math.min(state.armor, Math.max(0, incoming) * .6);
  state.armor -= absorbed;
  return incoming - absorbed;
}
