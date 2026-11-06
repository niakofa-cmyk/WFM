import {
  acquireTarget,
  MISSILE_CATALOG,
  ORBITAL_RULES_VERSION,
  PRIMARY_WEAPON_CATALOG,
  spawnMissile,
  spawnMissileVolley,
  spawnPrimary,
  spawnPrimaryVolley,
} from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import type { Bullet, Craft, Match } from "./sim";

export { MISSILE_RANGE, LOCK_SECONDS, distance3, guideMissile, segmentHit, targetSolution } from "@workspace/orbital-sim";
export function primaryWeaponFor(match: Match, pilot: Craft) {
  return match.orbitalRulesVersion === ORBITAL_RULES_VERSION
    ? PRIMARY_WEAPON_CATALOG[SHIPS[pilot.ship].primaryFit]
    : undefined;
}
function missileWeaponFor(match: Match, pilot: Craft) {
  return match.orbitalRulesVersion === ORBITAL_RULES_VERSION
    ? MISSILE_CATALOG[SHIPS[pilot.ship].missileFit]
    : undefined;
}
function targetFor(match: Match, pilot: Craft) {
  return (pilot.team === "foe" ? [match.player, ...match.allies] : match.enemies).find((c) => c.id === pilot.lockTargetId);
}
export function updateAcquisition(match: Match, pilot: Craft, dt: number) {
  acquireTarget(pilot, targetFor(match, pilot), dt, match.rocks, missileWeaponFor(match, pilot));
}
export function launchMissile(match: Match, pilot: Craft) {
  const weapon = missileWeaponFor(match, pilot);
  const damage = pilot.ai ? 16 : SHIPS[pilot.ship].missileDamage;
  const bullets = weapon
    ? spawnMissileVolley(pilot, targetFor(match, pilot), match.bullets.length, damage, match.rocks, weapon)
    : [spawnMissile(pilot, targetFor(match, pilot), match.bullets.length, damage, match.rocks)].filter((bullet): bullet is NonNullable<typeof bullet> => bullet !== null);
  if (bullets.length === 0) return false;
  match.bullets.push(...bullets.map((bullet) => ({ ...bullet, faction: pilot.faction, own: !pilot.ai })));
  match.fx.push({
    k: "shot", x: pilot.x, y: pilot.space!.y, z: pilot.z, big: true, you: !pilot.ai, faction: pilot.faction,
    visualEffect: weapon?.visualEffect, audioCue: weapon?.audioCue,
  });
  return true;
}
export function primaryBullet(match: Match, pilot: Craft, damage: number): Bullet {
  const weapon = primaryWeaponFor(match, pilot);
  return {
    ...spawnPrimary(pilot, targetFor(match, pilot), SHIPS[pilot.ship].shotSpeed, damage, match.rocks, weapon),
    faction: pilot.faction, own: !pilot.ai,
  };
}
export function primaryVolley(match: Match, pilot: Craft, damage: number): Bullet[] {
  const weapon = primaryWeaponFor(match, pilot);
  if (!weapon) return [primaryBullet(match, pilot, damage)];
  return spawnPrimaryVolley(pilot, targetFor(match, pilot), SHIPS[pilot.ship].shotSpeed, damage, match.rocks, weapon)
    .map((bullet) => ({ ...bullet, faction: pilot.faction, own: !pilot.ai }));
}
