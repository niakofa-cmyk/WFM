import { acquireTarget, spawnMissile, spawnPrimary } from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import type { Bullet, Craft, Match } from "./sim";

export { MISSILE_RANGE, LOCK_SECONDS, distance3, guideMissile, segmentHit, targetSolution } from "@workspace/orbital-sim";
function targetFor(match: Match, pilot: Craft) {
  return (pilot.team === "foe" ? [match.player, ...match.allies] : match.enemies).find((c) => c.id === pilot.lockTargetId);
}
export function updateAcquisition(match: Match, pilot: Craft, dt: number) {
  acquireTarget(pilot, targetFor(match, pilot), dt, match.rocks);
}
export function launchMissile(match: Match, pilot: Craft) {
  const bullet = spawnMissile(pilot, targetFor(match, pilot), match.bullets.length, pilot.ai ? 16 : SHIPS[pilot.ship].missileDamage, match.rocks);
  if (!bullet) return false;
  match.bullets.push({ ...bullet, faction: pilot.faction, own: !pilot.ai });
  match.fx.push({ k: "shot", x: pilot.x, y: pilot.space!.y, z: pilot.z, big: true, you: !pilot.ai });
  return true;
}
export function primaryBullet(match: Match, pilot: Craft, damage: number): Bullet {
  return { ...spawnPrimary(pilot, targetFor(match, pilot), SHIPS[pilot.ship].shotSpeed, damage, match.rocks), faction: pilot.faction, own: !pilot.ai };
}
