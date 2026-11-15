import { detHypot } from "./detmath";
import { rotate } from "./orbital-flight";
import { distance3, primaryBullet, targetSolution } from "./orbital-weapons";
import { SHIPS, type ShipAbilityId } from "./ships";
import type { Craft, Match, StepInput } from "./sim";

export const ORBITAL_ABILITY_COST: Record<ShipAbilityId, number> = {
  "solar-flare": 28,
  "wing-dive": 24,
  "vortex-camouflage": 22,
  "trinity-shift": 28,
  "quantum-lock": 18,
  "proximity-ward": 24,
  "ring-split": 24,
  "skip-reentry": 30,
  "vector-pursuit": 22,
  "adaptive-fire-control": 20,
  "aegis-intercept-grid": 30,
  "siege-configuration": 30,
  "void-veil": 25,
  "solar-cataclysm": 40,
  "phantom-swarm": 34,
  "thunder-veil": 30,
};

type AbilityServices = { hurt: (match: Match, craft: Craft, damage: number, fromX?: number, fromZ?: number) => boolean };
export type OrbitalAbilityBlockReason = "disabled" | "cooldown" | "energy";
export function orbitalAbilityAvailability(craft: Craft) {
  const energy = craft.space?.energy ?? 0;
  const energyCost = ORBITAL_ABILITY_COST[SHIPS[craft.ship].ability];
  const reason: OrbitalAbilityBlockReason | null = !craft.space || !craft.alive
    ? "disabled"
    : craft.ultCd > 0
      ? "cooldown"
      : energy < energyCost
        ? "energy"
        : null;
  return { ready: reason === null, reason, energy, energyCost, cooldownSeconds: Math.max(0, craft.ultCd) };
}

const clamp = (value: number, low = -1, high = 1) => Math.max(low, Math.min(high, value));
const opposing = (match: Match, craft: Craft) => craft.team === "foe" ? [match.player, ...match.allies] : match.enemies;
const friendlies = (match: Match, craft: Craft) => craft.team === "foe" ? match.enemies : [match.player, ...match.allies];
const abilityState = (craft: Craft) =>
  craft.abilityState ??= { active: 0, charge: 0, shotsRemaining: 0, interceptsRemaining: 0, released: true };

function inFront(match: Match, craft: Craft, target: Craft, range: number, minForwardDot = 0.72) {
  return targetSolution(craft, target, match.rocks, { maxRange: range, minForwardDot }).available;
}

function nearestForwardTarget(match: Match, craft: Craft, range: number, minForwardDot = 0.72) {
  return opposing(match, craft)
    .filter((target) => target.alive && inFront(match, craft, target, range, minForwardDot))
    .sort((a, b) => distance3(craft, a) - distance3(craft, b))[0];
}

function pushEffect(match: Match, effect: Match["fx"][number]) {
  if (match.fx.length > 28) match.fx.shift();
  match.fx.push(effect);
}

export function activateOrbitalAbility(match: Match, craft: Craft, services: AbilityServices) {
  const space = craft.space;
  const definition = SHIPS[craft.ship];
  if (!space || !orbitalAbilityAvailability(craft).ready) return false;

  const quantumTarget = definition.ability === "quantum-lock"
    ? craft.lockTargetId == null
      ? nearestForwardTarget(match, craft, 58, 0.68)
      : opposing(match, craft).find((target) =>
        target.id === craft.lockTargetId && target.alive && inFront(match, craft, target, 58, 0.68))
    : undefined;
  if (definition.ability === "quantum-lock" && !quantumTarget) return false;

  const swarmTargets = definition.ability === "phantom-swarm"
    ? opposing(match, craft)
      .filter((target) => target.alive && inFront(match, craft, target, 52, 0.64))
      .sort((a, b) => distance3(craft, a) - distance3(craft, b))
      .slice(0, 3)
    : [];
  if (definition.ability === "phantom-swarm" && swarmTargets.length === 0) return false;
  if (definition.ability === "solar-cataclysm" && match.bullets.length >= 108) return false;

  space.energy -= ORBITAL_ABILITY_COST[definition.ability];
  craft.ultCd = definition.ultCd;
  const state = abilityState(craft);
  state.active = 0;
  state.charge = 0;
  state.shotsRemaining = 0;
  state.interceptsRemaining = 0;
  state.released = true;

  switch (definition.ability) {
    case "solar-flare": {
      pushEffect(match, { k: "flare", x: craft.x, y: space.y, z: craft.z, yaw: craft.yaw });
      for (const target of opposing(match, craft)) {
        if (target.alive && inFront(match, craft, target, 34, 0.62)) services.hurt(match, target, 26, craft.x, craft.z);
      }
      break;
    }
    case "wing-dive":
      craft.boost = 1.7;
      craft.boostDmg = 28;
      craft.rammed = false;
      pushEffect(match, { k: "dive", x: craft.x, y: space.y, z: craft.z, yaw: craft.yaw });
      break;
    case "vortex-camouflage":
      craft.cloak = 4;
      craft.nextCrit = true;
      pushEffect(match, { k: "cloak", x: craft.x, y: space.y, z: craft.z });
      break;
    case "trinity-shift":
      for (const target of opposing(match, craft)) {
        if (target.alive && distance3(craft, target) < 24) target.thrustMuted = Math.max(target.thrustMuted ?? 0, 1.55);
      }
      pushEffect(match, { k: "emp", x: craft.x, y: space.y, z: craft.z });
      break;
    case "quantum-lock": {
      const target = quantumTarget!;
      craft.lockTargetId = target.id;
      space.lockTargetId = target.id;
      space.lockProgress = Math.max(space.lockProgress, 0.65);
      craft.dmgMul = 1.5;
      craft.dmgMulT = 3.2;
      pushEffect(match, { k: "mark", x: target?.x ?? craft.x, y: target?.space?.y ?? space.y, z: target?.z ?? craft.z });
      break;
    }
    case "proximity-ward":
      for (const ally of friendlies(match, craft)) {
        if (!ally.alive || distance3(craft, ally) > 22) continue;
        ally.shield = Math.min(ally.shieldMax, ally.shield + ally.shieldMax * (ally.id === craft.id ? 0.3 : 0.16));
      }
      pushEffect(match, { k: "guard", x: craft.x, y: space.y, z: craft.z });
      break;
    case "ring-split":
      for (const target of opposing(match, craft)) {
        if (!target.alive || distance3(craft, target) > 42) continue;
        target.jam = Math.max(target.jam, 2);
        target.lockTargetId = null;
        if (target.space) {
          target.space.lockTargetId = null;
          target.space.lockProgress = 0;
        }
      }
      pushEffect(match, { k: "jam", x: craft.x, y: space.y, z: craft.z });
      break;
    case "skip-reentry":
      craft.untargetable = 0.95;
      craft.boost = 1.65;
      craft.boostDmg = 38;
      craft.rammed = false;
      pushEffect(match, { k: "ram", x: craft.x, y: space.y, z: craft.z, yaw: craft.yaw });
      break;
    case "vector-pursuit":
      state.active = 3.2;
      pushEffect(match, { k: "dive", x: craft.x, y: space.y, z: craft.z, yaw: craft.yaw });
      break;
    case "adaptive-fire-control":
      state.active = 4.2;
      state.shotsRemaining = 7;
      pushEffect(match, { k: "mark", x: craft.x, y: space.y, z: craft.z });
      break;
    case "aegis-intercept-grid":
      state.active = 5;
      state.interceptsRemaining = 3;
      pushEffect(match, { k: "guard", x: craft.x, y: space.y, z: craft.z });
      break;
    case "siege-configuration":
      state.active = 4.5;
      pushEffect(match, { k: "mark", x: craft.x, y: space.y, z: craft.z });
      break;
    case "void-veil": {
      craft.cloak = 2.7;
      const target = nearestForwardTarget(match, craft, 52, 0.62);
      if (target) {
        craft.lockTargetId = target.id;
        space.lockTargetId = target.id;
        space.lockProgress = 0;
        target.jam = Math.max(target.jam, 1.8);
        target.lockTargetId = null;
        if (target.space) {
          target.space.lockTargetId = null;
          target.space.lockProgress = 0;
        }
      }
      pushEffect(match, { k: "cloak", x: craft.x, y: space.y, z: craft.z });
      break;
    }
    case "solar-cataclysm":
      state.charge = 0.45;
      state.released = false;
      pushEffect(match, { k: "mark", x: craft.x, y: space.y, z: craft.z });
      break;
    case "phantom-swarm": {
      const forward = rotate(space.q, 0, 0, -1);
      for (const target of swarmTargets) {
        if (match.bullets.length >= 108) break;
        const dx = target.x - craft.x;
        const dy = (target.space?.y ?? 0) - space.y;
        const dz = target.z - craft.z;
        const length = Math.max(0.001, detHypot(detHypot(dx, dy), dz));
        const speed = 34;
        match.bullets.push({
          x: craft.x + forward.x * 2.5, y: space.y + forward.y * 2.5, z: craft.z + forward.z * 2.5,
          vx: dx / length * speed, vy: dy / length * speed, vz: dz / length * speed,
          life: 3.6, dmg: 9, r: 0.32, homeId: target.id, missile: true, faction: craft.faction, own: !craft.ai,
        });
      }
      pushEffect(match, { k: "shot", x: craft.x, y: space.y, z: craft.z, big: true, you: !craft.ai });
      break;
    }
    case "thunder-veil":
      for (const target of opposing(match, craft)) {
        if (!target.alive || distance3(craft, target) > 26) continue;
        target.jam = Math.max(target.jam, 2.4);
        target.fireCd = Math.max(target.fireCd, 0.45);
        target.lockTargetId = null;
        if (target.space) {
          target.space.energy = Math.max(0, target.space.energy - 8);
          target.space.lockTargetId = null;
          target.space.lockProgress = 0;
        }
      }
      pushEffect(match, { k: "jam", x: craft.x, y: space.y, z: craft.z });
      break;
  }
  return true;
}

export function applyOrbitalAbilityInput(craft: Craft, input: StepInput): StepInput {
  if ((craft.abilityState?.active ?? 0) <= 0) return input;
  if (SHIPS[craft.ship].ability === "vector-pursuit") {
    return {
      ...input,
      yaw: clamp(input.yaw * 1.35),
      pitch: clamp(input.pitch * 1.12),
      strafe: clamp(input.strafe + input.yaw * 0.2),
    };
  }
  if (SHIPS[craft.ship].ability === "siege-configuration") {
    return { ...input, throttle: input.throttle * 0.62, yaw: input.yaw * 0.58, pitch: input.pitch * 0.68, strafe: input.strafe * 0.55 };
  }
  return input;
}

export function advanceOrbitalAbility(match: Match, craft: Craft) {
  const state = craft.abilityState;
  const space = craft.space;
  if (!state || !space || state.released || state.charge > 0 || SHIPS[craft.ship].ability !== "solar-cataclysm") return;
  const bullet = primaryBullet(match, craft, 42);
  bullet.dmg = 42;
  bullet.r = 0.72;
  bullet.life = 1.8;
  match.bullets.push({ ...bullet, faction: craft.faction, own: !craft.ai });
  pushEffect(match, { k: "shot", x: craft.x, y: space.y, z: craft.z, big: true, you: !craft.ai });
  state.released = true;
}

export function processOrbitalAbility(match: Match, craft: Craft) {
  const state = craft.abilityState;
  if (!state || state.active <= 0 || SHIPS[craft.ship].ability !== "aegis-intercept-grid" || state.interceptsRemaining <= 0) return;
  const defended = friendlies(match, craft).filter((ally) => ally.alive && distance3(craft, ally) <= 28);
  if (defended.length === 0) return;
  for (let i = match.bullets.length - 1; i >= 0; i--) {
    const bullet = match.bullets[i]!;
    if (!bullet.missile || bullet.faction === craft.faction) continue;
    const threatened = defended
      .filter((ally) => bullet.homeId == null || bullet.homeId === ally.id)
      .sort((a, b) => detHypot(
        detHypot(a.x - bullet.x, a.z - bullet.z),
        (a.space?.y ?? 0) - (bullet.y ?? 0),
      ) - detHypot(
        detHypot(b.x - bullet.x, b.z - bullet.z),
        (b.space?.y ?? 0) - (bullet.y ?? 0),
      ))[0];
    if (!threatened) continue;
    const missileDistance = detHypot(
      detHypot(threatened.x - bullet.x, threatened.z - bullet.z),
      (threatened.space?.y ?? 0) - (bullet.y ?? 0),
    );
    if (missileDistance > 15) continue;
    match.bullets.splice(i, 1);
    state.interceptsRemaining--;
    pushEffect(match, { k: "guard", x: threatened.x, y: threatened.space?.y ?? 0, z: threatened.z });
    break;
  }
  for (const ally of defended) ally.shield = Math.min(ally.shieldMax, ally.shield + 0.7 / 30);
}
