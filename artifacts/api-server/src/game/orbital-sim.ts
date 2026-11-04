import { SHIPS } from "./ships";
import { detAtan2, detHypot } from "./detmath";
import { integrateFlight, newFlight, rotate } from "./orbital-flight";
import { distance3, guideMissile, launchMissile, primaryBullet, segmentHit, targetSolution, updateAcquisition } from "./orbital-weapons";
import type { Craft, Match, StepInput } from "./sim";

const IDLE: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };
type Services = {
  hurt: (match: Match, craft: Craft, damage: number, fromX?: number, fromZ?: number) => boolean;
  tickTimers: (craft: Craft, dt: number) => void;
};

// Shared campaign/training setup. Networked competitive rooms still use their own authority.
export function prepareOrbital(match: Match) {
  for (const craft of [match.player, ...match.allies, ...match.enemies]) craft.space = newFlight(craft.yaw);
  match.player.x = 0; match.player.z = 28;
  match.enemies.forEach((craft, i) => {
    craft.x = i === 0 ? 0 : (i % 2 ? -1 : 1) * (16 + i * 4);
    craft.z = -4 - i * 9;
    craft.space!.y = i === 0 ? 0 : (i % 2 ? 5 : -4);
    // Visible first target holds position while the pilot learns target acquisition.
    craft.guard = 0;
  });
  match.relays = []; match.runner = null;
  return match;
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
        // First defender is a stationary gun platform; other defenders maneuver.
        if (craft.id === match.enemies[0]?.id) played.throttle = 0;
      }
    }
    integrateFlight(craft, played, dt, 1, match);
    updateAcquisition(match, craft, dt);
    if (played.missile) launchMissile(match, craft);
    if (played.fire && craft.fireCd <= 0 && craft.root <= 0 && match.bullets.length < 110) {
      const def = SHIPS[craft.ship];
      craft.fireCd = def.fireInterval;
      match.bullets.push(primaryBullet(match, craft, def.shotDmg * (craft.ai ? .28 : 2.2)));
      match.fx.push({ k: "shot", x: craft.x, y: space.y, z: craft.z, big: false, you: !craft.ai });
    }
    if (craft.hurtT <= 0) craft.shield = Math.min(craft.shieldMax, craft.shield + 3 * dt);
  }
  for (let i = match.bullets.length - 1; i >= 0; i--) {
    const bullet = match.bullets[i];
    const targets = bullet.faction === player.faction ? match.enemies : [player, ...match.allies];
    if (bullet.homeId != null) {
      const target = targets.find((c) => c.id === bullet.homeId && c.alive && c.cloak <= 0);
      if (target) guideMissile(bullet, target, dt);
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
