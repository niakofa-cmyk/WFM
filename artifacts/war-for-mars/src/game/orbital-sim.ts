import { SHIPS } from "./ships";
import { ORBITAL_RULES_VERSION, type OrbitalRulesVersion } from "@workspace/orbital-sim";
import { detAtan2, detHypot } from "./detmath";
import { integrateFlight, newFlight, rotate } from "./orbital-flight";
import { distance3, guideMissile, launchMissile, primaryBullet, primaryVolley, primaryWeaponFor, segmentHit, targetSolution, updateAcquisition } from "./orbital-weapons";
import { activateOrbitalAbility, advanceOrbitalAbility, applyOrbitalAbilityInput, ORBITAL_ABILITY_COST, processOrbitalAbility } from "./orbital-abilities";
import type { Craft, Match, StepInput } from "./sim";

const IDLE: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null, countermeasure: false };
type Services = {
  hurt: (match: Match, craft: Craft, damage: number, fromX?: number, fromZ?: number) => boolean;
  tickTimers: (craft: Craft, dt: number) => void;
};

// Shared campaign/training setup. Networked competitive rooms still use their own authority.
export function prepareOrbital(match: Match, rulesVersion: OrbitalRulesVersion = ORBITAL_RULES_VERSION) {
  match.orbitalRulesVersion = rulesVersion;
  for (const craft of [match.player, ...match.allies, ...match.enemies]) {
    craft.space = newFlight(craft.yaw);
    craft.space.ammo = SHIPS[craft.ship].missileAmmo;
  }
  match.player.x = 0; match.player.z = 28;
  match.enemies.forEach((craft, i) => {
    craft.x = i === 0 ? 0 : (i % 2 ? -1 : 1) * (16 + i * 4);
    craft.z = -4 - i * 9;
    craft.space!.y = i === 0 ? 0 : (i % 2 ? 5 : -4);
    if (match.orbitalTraining) {
      // Training relocates the legacy roster, so align its first contacts
      // with their new spawn positions for the lock-and-missile tutorial.
      craft.yaw = detAtan2(-(match.player.x - craft.x), -(match.player.z - craft.z));
      craft.space = newFlight(craft.yaw);
      craft.space.y = i === 0 ? 0 : (i % 2 ? 5 : -4);
    }
    // Visible first target holds position while the pilot learns target acquisition.
    craft.guard = 0;
  });
  match.relays = []; match.runner = null;
  return match;
}

function resolveBoostHit(match: Match, craft: Craft, hurt: Services["hurt"]) {
  if (craft.boost <= 0 || craft.boostDmg <= 0 || craft.rammed) return;
  for (const target of craft.team === "foe" ? [match.player, ...match.allies] : match.enemies) {
    if (!target.alive || target.guard > 0 || distance3(craft, target) >= craft.radius + target.radius + 0.8) continue;
    hurt(match, target, craft.boostDmg, craft.x, craft.z);
    craft.rammed = true;
    if (craft.ship === "glide") {
      craft.boost = 0;
      craft.recover = 1.35;
      craft.untargetable = 0;
    }
    break;
  }
}

function selectTarget(match: Match, input: StepInput) {
  if (!input.lock) return;
  const pilot = match.player;
  const targets = match.enemies.filter((c) => c.alive && c.cloak <= 0).sort((a, b) => a.id - b.id);
  const index = targets.findIndex((c) => c.id === pilot.lockTargetId);
  const next = targets[(index + 1) % targets.length];
  pilot.lockTargetId = next?.id ?? null;
  pilot.space!.lockProgress = 0;
  match.lockId = pilot.lockTargetId;
}

export function stepOrbital(match: Match, input: StepInput, dt: number, services: Services) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw new Error("Orbital step must be finite and at most 100 ms.");
  const player = match.player;
  selectTarget(match, input);
  const crafts = [player, ...match.allies, ...match.enemies];
  for (const craft of crafts) {
    if (!craft.alive) continue;
    services.tickTimers(craft, dt);
    advanceOrbitalAbility(match, craft);
    const space = craft.space;
    if (!space) throw new Error("All orbital pilots need spatial state.");
    let played = input;
    if (craft.ai) {
      const foes = (craft.team === "foe" ? [player, ...match.allies] : match.enemies).filter((c) => c.alive);
      const target = foes.sort((a, b) => distance3(craft, a) - distance3(craft, b))[0];
      played = { ...IDLE };
      if (target) {
        const dx = target.x - craft.x; const dy = target.space!.y - space.y; const dz = target.z - craft.z;
        // Inverse rotation transforms the desired direction into local flight axes.
        const local = rotate([-space.q[0], -space.q[1], -space.q[2], space.q[3]], dx, dy, dz);
        played.yaw = Math.max(-1, Math.min(1, detAtan2(-local.x, -local.z) * 1.7));
        played.pitch = Math.max(-1, Math.min(1, detAtan2(local.y, detHypot(local.x, local.z)) * 1.7));
        const distance = distance3(craft, target);
        played.throttle = distance > 35 ? .4 : distance < 15 ? -.3 : 0;
        craft.lockTargetId = target.id;
        played.fire = match.time > 5 && targetSolution(craft, target, match.rocks).available && targetSolution(craft, target, match.rocks).angle < .18 && distance < 60;
        played.missile = match.orbitalTraining === true && match.time >= 2 + (craft.id % 3) && space.missileCd <= 0 && space.ammo > 0 &&
          space.lockProgress >= 1 && targetSolution(craft, target, match.rocks).available;
        // First defender is a stationary gun platform; other defenders maneuver.
        if (craft.id === match.enemies[0]?.id) played.throttle = 0;
        played.ult = craft.ultCd <= 0 && space.energy >= ORBITAL_ABILITY_COST[SHIPS[craft.ship].ability] &&
          (distance < 32 || SHIPS[craft.ship].ability === "aegis-intercept-grid");
      }
    }
    if (played.ult) activateOrbitalAbility(match, craft, services);
    played = applyOrbitalAbilityInput(craft, played);
    integrateFlight(craft, played, dt, 1, match);
    resolveBoostHit(match, craft, services.hurt);
    updateAcquisition(match, craft, dt);
    if (played.missile && launchMissile(match, craft) && craft.ai) {
      // AI ordnance is intentionally intermittent; it creates readable
      // incoming threats without overwhelming the offline training sortie.
      space.missileCd = Math.max(space.missileCd, 12 + (craft.id % 3) * 2);
    }
    if (craft.id === player.id && played.countermeasure) {
      for (let i = match.bullets.length - 1; i >= 0; i--) {
        const bullet = match.bullets[i]!;
        if (bullet.faction !== player.faction && bullet.missile) {
          match.bullets.splice(i, 1);
        }
      }
      // Show an unmistakable release cue even if the incoming missile expired
      // on the same simulation step as the pilot's countermeasure tap.
      match.fx.push({ k: "flare", x: player.x, y: space.y, z: player.z, yaw: player.yaw });
    }
    const weapon = primaryWeaponFor(match, craft);
    const volleySize = weapon?.volleyCount ?? 1;
    if (played.fire && craft.fireCd <= 0 && craft.root <= 0 && match.bullets.length + volleySize <= 110) {
      const def = SHIPS[craft.ship];
      let damage = def.shotDmg * (craft.ai ? .28 : 2.2);
      if (craft.dmgMulT > 0) damage *= craft.dmgMul;
      if (craft.nextCrit) {
        damage *= 2.45;
        craft.nextCrit = false;
      }
      let fireInterval = def.fireInterval;
      if (SHIPS[craft.ship].ability === "adaptive-fire-control" &&
          (craft.abilityState?.active ?? 0) > 0 && (craft.abilityState?.shotsRemaining ?? 0) > 0) {
        fireInterval *= .62;
        damage *= .78;
        craft.abilityState!.shotsRemaining--;
      }
      if (SHIPS[craft.ship].ability === "siege-configuration" && (craft.abilityState?.active ?? 0) > 0) {
        fireInterval *= 1.25;
        damage *= 1.75;
      }
      craft.fireCd = fireInterval;
      if (craft.cloak > 0) craft.cloak = 0;
      match.bullets.push(...primaryVolley(match, craft, damage));
      match.fx.push({
        k: "shot", x: craft.x, y: space.y, z: craft.z,
        big: (weapon?.projectileRadius ?? 0.3) >= 0.45,
        you: !craft.ai, faction: craft.faction, visualEffect: weapon?.visualEffect, audioCue: weapon?.audioCue,
      });
    }
    if (craft.hurtT <= 0) craft.shield = Math.min(craft.shieldMax, craft.shield + 3 * dt);
  }
  for (const craft of crafts) processOrbitalAbility(match, craft);
  for (let i = match.bullets.length - 1; i >= 0; i--) {
    const bullet = match.bullets[i];
    const targets = bullet.faction === player.faction ? match.enemies : [player, ...match.allies];
    if (bullet.homeId != null) {
      const target = targets.find((c) => c.id === bullet.homeId && c.alive && c.cloak <= 0);
      if (target) guideMissile(bullet, target, dt, crafts.find((craft) => craft.id === bullet.launcherId));
    }
    const px = bullet.x; const py = bullet.y ?? 0; const pz = bullet.z;
    bullet.x += bullet.vx * dt; bullet.y = py + (bullet.vy ?? 0) * dt; bullet.z += bullet.vz * dt; bullet.life -= dt;
    let dead = bullet.life <= 0 || match.rocks.some((rock) => segmentHit(rock.x, 0, rock.z, bullet, px, py, pz, rock.r));
    if (!dead) {
      for (const target of targets) {
        if (!target.alive || !segmentHit(target.x, target.space!.y, target.z, bullet, px, py, pz, target.radius + bullet.r)) continue;
        const before = match.fx.length;
        if (services.hurt(match, target, bullet.dmg, px, pz) && bullet.own) match.fx.push({ k: "ping" });
        for (let f = before; f < match.fx.length; f++) match.fx[f].y = target.space!.y;
        dead = true;
        break;
      }
    }
    if (dead) match.bullets.splice(i, 1);
  }
  match.time += dt;
  match.painted = match.enemies.filter((c) => c.alive && targetSolution(c, player, match.rocks).available).map((c) => c.id);
  if (!player.alive) match.over = "loss";
  else if (match.enemies.every((c) => !c.alive)) match.over = "win";
  else if (match.time >= match.limit) match.over = "loss";
}
