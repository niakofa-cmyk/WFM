import assert from "node:assert/strict";
import test from "node:test";
import { SHIPS } from "./ships";
import {
  chooseAiTarget,
  createMatch,
  leadAimPoint,
  outcomeForTeam,
  outcomeReason,
  relayCallout,
  step,
  type StepInput,
} from "./sim";

const idle: StepInput = {
  throttle: 0,
  yaw: 0,
  strafe: 0,
  pitch: 0,
  fire: false,
  ult: false,
  lock: false,
  evade: 0,
  preset: null,
};

test("flight controls ease turn input and counter-thrust faster than coasting", () => {
  const turning = createMatch("mandjet", "accord", 0, "strike", { seed: 21 });
  step(turning, { ...idle, throttle: 1, yaw: 1 }, 1 / 60);
  assert.ok(turning.player.speed > 0);
  assert.ok(turning.player.steer > 0 && turning.player.steer < 1);
  assert.ok(turning.player.yaw > 0);
  assert.ok(turning.player.yaw < SHIPS.mandjet.turnRate * SHIPS.mandjet.handling / 60);

  const coasting = createMatch("mandjet", "accord", 0, "strike", { seed: 22 });
  const braking = createMatch("mandjet", "accord", 0, "strike", { seed: 22 });
  coasting.player.speed = 12;
  braking.player.speed = 12;
  step(coasting, idle, 0.1);
  step(braking, { ...idle, throttle: -1 }, 0.1);
  assert.ok(braking.player.speed < coasting.player.speed);
});

test("competitive simulations can normalize the player-seat shield regeneration", () => {
  const standard = createMatch("mandjet", "accord", 0, "strike", { seed: 29 });
  standard.allies = [];
  standard.enemies = [];
  standard.player.shield = 0;
  step(standard, idle, 0.5);
  assert.equal(standard.player.shield, 8);

  const normalized = createMatch("mandjet", "accord", 0, "strike", {
    seed: 30,
    playerShieldRegenRate: 5,
  });
  normalized.allies = [];
  normalized.enemies = [];
  normalized.player.shield = 0;
  step(normalized, idle, 0.5);
  assert.equal(normalized.player.shield, 2.5);
});

test("duel certification applies the same integrity penalty to both pilots", () => {
  const foeMatch = createMatch("mandjet", "accord", 0, "strike", {
    seed: 31,
    allyCount: 1,
    foeCount: 1,
    symmetricDuelDeathPenalty: 9,
  });
  foeMatch.allies = [];
  foeMatch.rocks = [];
  const foe = foeMatch.enemies[0];
  foe.ai = false;
  foe.human = idle;
  foe.shield = 0;
  foe.hull = 1;
  foe.guard = 0;
  foeMatch.bullets.push({
    x: foe.x, z: foe.z, vx: 0, vz: 0, life: 1, dmg: 10,
    faction: foeMatch.playerFaction, r: 0.5, homeId: null, own: true,
  });
  step(foeMatch, idle, 1 / 30);
  assert.equal(foeMatch.foeBar, 91);

  const playerMatch = createMatch("mandjet", "accord", 0, "strike", {
    seed: 32,
    allyCount: 1,
    foeCount: 1,
    symmetricDuelDeathPenalty: 9,
  });
  playerMatch.allies = [];
  playerMatch.rocks = [];
  playerMatch.player.shield = 0;
  playerMatch.player.hull = 1;
  playerMatch.player.guard = 0;
  playerMatch.bullets.push({
    x: playerMatch.player.x, z: playerMatch.player.z, vx: 0, vz: 0, life: 1, dmg: 10,
    faction: "ussf", r: 0.5, homeId: null, own: false,
  });
  step(playerMatch, idle, 1 / 30);
  assert.equal(playerMatch.youBar, 91);
});

test("AI lead point intercepts a crossing ship instead of aiming behind it", () => {
  const point = leadAimPoint(
    0,
    0,
    { x: 10, z: 0, yaw: -Math.PI / 2, speed: 10 },
    20,
  );
  assert.ok(Math.abs(point.x - 20) < 1e-6);
  assert.ok(Math.abs(point.z) < 1e-6);
});

test("AI prioritizes a hostile escort and exposed targets", () => {
  const extraction = createMatch("mandjet", "accord", 0, "strike", {
    seed: 27,
    goal: "extract",
  });
  const ally = extraction.allies[0];
  extraction.enemies[0].x = ally.x;
  extraction.enemies[0].z = ally.z;
  assert.equal(chooseAiTarget(extraction, ally), extraction.runner);

  const skirmish = createMatch("mandjet", "accord", 0, "strike", { seed: 28 });
  const pilot = skirmish.allies[0];
  const [near, exposed] = skirmish.enemies;
  near.x = pilot.x + 15;
  near.z = pilot.z;
  exposed.x = pilot.x + 18;
  exposed.z = pilot.z;
  exposed.shield = 0;
  exposed.hull = 0.1;
  assert.equal(chooseAiTarget(skirmish, pilot), exposed);
});

test("relay callout shows capture progress, contesting, and control", () => {
  const match = createMatch("mandjet", "accord", 0, "strike", { seed: 23 });
  const relay = match.relays[0];
  relay.x = match.player.x;
  relay.z = match.player.z;
  relay.own = 0;
  relay.cap = 0;
  assert.equal(relayCallout(match, "you", match.player.x, match.player.z), "0/3 HELD · CAPTURE 50%");

  match.enemies[0].x = relay.x;
  match.enemies[0].z = relay.z;
  assert.equal(relayCallout(match, "you", match.player.x, match.player.z), "0/3 HELD · ZONE CONTESTED");

  match.enemies.forEach((enemy) => {
    enemy.x = 500;
    enemy.z = 500;
  });
  relay.own = 1;
  relay.cap = 1;
  assert.equal(relayCallout(match, "you", match.player.x, match.player.z), "1/3 HELD · ZONE SECURED");
});

test("match result and debrief reason are correct from either team", () => {
  const match = createMatch("mandjet", "accord", 0, "strike", { seed: 24 });
  match.over = "win";
  match.youBar = 70;
  match.foeBar = 0;
  assert.equal(outcomeForTeam(match, 0), "win");
  assert.equal(outcomeForTeam(match, 1), "loss");
  assert.equal(outcomeReason(match, 1), "Your wing's integrity was depleted by combat and relay pressure.");

  const beacons = createMatch("mandjet", "accord", 0, "strike", {
    seed: 25,
    goal: "beacons",
  });
  beacons.relays[0].own = -1;
  beacons.relays[1].own = -1;
  beacons.over = "loss";
  assert.equal(outcomeForTeam(beacons, 1), "win");
  assert.equal(outcomeReason(beacons, 1), "Your wing secured two of three beacons.");
});

test("primary weapon output and ultimate recharge stay within the tuned band", () => {
  for (const ship of Object.values(SHIPS)) {
    const sustainedDps = ship.shotDmg / ship.fireInterval;
    assert.ok(sustainedDps >= 16 && sustainedDps <= 22, `${ship.name} sustained DPS ${sustainedDps}`);
    assert.ok(ship.ultCd >= 7 && ship.ultCd <= 12, `${ship.name} ultimate cooldown ${ship.ultCd}`);
  }
});

test("six-minute Strike reaches the clock and resolves a tied integrity result", () => {
  const match = createMatch("mandjet", "accord", 0, "strike", { seed: 26 });
  match.relays.forEach((relay) => {
    relay.x = 200;
    relay.z = 200;
  });
  for (const craft of [match.player, ...match.allies, ...match.enemies]) {
    craft.hull = craft.hullMax = 1_000_000;
    craft.shield = craft.shieldMax = craft.baseShield = 1_000_000;
    craft.fireCd = 10_000;
  }

  for (let tick = 0; tick < 21_601 && !match.over; tick += 1) {
    step(match, idle, 1 / 60);
  }

  assert.equal(match.over, "draw");
  assert.ok(match.time >= 360 && match.time < 360.02);
  assert.equal(outcomeReason(match, 0), "Time expired with both integrity bars tied.");
});
