import assert from "node:assert/strict";
import test from "node:test";
import { createBus, readInput, setCircularRollControl } from "./input";
import { createMatch, step, type StepInput } from "./sim";
import { prepareOrbital } from "./orbital-sim";
import { integrateFlight, rotate } from "./orbital-flight";
import { launchMissile, primaryBullet, segmentHit, targetSolution, updateAcquisition } from "./orbital-weapons";
import { armorSpill } from "./orbital-damage";
import { ORBITAL_COUNTERMEASURE_RULES_VERSION, ORBITAL_WEAPON_RULES_VERSION } from "@workspace/orbital-sim";
import { clearInput, createBus, readInput } from "./input";

const idle: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };
function lab() {
  const match = prepareOrbital(
    createMatch("duskbreaker", "ussf", 0, "practice", {
      foeCount: 3,
      allyCount: 1,
      seed: 1938,
      orbitalTraining: true,
      orbitalRulesVersion: ORBITAL_COUNTERMEASURE_RULES_VERSION,
    }),
    ORBITAL_COUNTERMEASURE_RULES_VERSION,
  );
  match.rocks = []; match.allies = [];
  return match;
}

test("default combat remains planar and does not receive orbital state or armor", () => {
  const match = createMatch("duskbreaker", "ussf", 0, "practice", { seed: 1938 });
  assert.equal(match.player.space, undefined);
  step(match, { ...idle, throttle: 1, pitch: 1 }, 1 / 60);
  assert.equal(match.player.space, undefined);
  assert.ok(match.player.z < 28);
  assert.equal(armorSpill(match.player, 20), 20);
});

test("orbital pitch yaw roll and vertical/lateral translation are real spatial controls", () => {
  const match = lab(); const pilot = match.player;
  for (let i = 0; i < 30; i++) integrateFlight(pilot, { ...idle, pitch: .4, yaw: .2, roll: .5, throttle: 1, vertical: .3, strafe: .3 }, 1 / 60, 1, match);
  const space = pilot.space!;
  assert.ok(space.y > 0); assert.ok(Math.abs(pilot.x) > .1); assert.ok(pilot.z < 28);
  assert.ok(Math.abs(space.q[0]) > .01); assert.ok(Math.abs(space.q[1]) > .01); assert.ok(Math.abs(space.q[2]) > .01);
  assert.ok(Math.abs(Math.hypot(...space.q) - 1) < 1e-12);
  const forward = rotate(space.q, 0, 0, -1);
  assert.ok(forward.y > 0);
});

test("unified mobile stick drives forward, reverse and a coordinated turn", () => {
  const forward = lab();
  const reverse = lab();
  const turning = lab();
  const readStick = (x: number, y: number) => {
    const bus = createBus("arc");
    bus.orbital = true;
    bus.leftStickFlight = true;
    bus.leftX = x;
    bus.leftY = y;
    return readInput(bus);
  };
  const forwardInput = readStick(0, -1);
  const reverseInput = readStick(0, 1);
  const turningInput = readStick(0.6, -0.8);

  assert.equal(forwardInput.throttle, 1);
  assert.equal(reverseInput.throttle, -1);
  assert.ok(turningInput.throttle > 0);
  assert.notEqual(turningInput.yaw, 0);
  assert.notEqual(turningInput.roll, 0);

  for (let i = 0; i < 30; i++) {
    integrateFlight(forward.player, forwardInput, 1 / 60, 1, forward);
    integrateFlight(reverse.player, reverseInput, 1 / 60, 1, reverse);
    integrateFlight(turning.player, turningInput, 1 / 60, 1, turning);
  }
  assert.ok(forward.player.z < 28, "up-stick thrust advances along the ship's forward axis");
  assert.ok(reverse.player.z > 28, "down-stick thrust reverses along the ship's forward axis");
  assert.ok(turning.player.z < 28 && Math.abs(turning.player.x) > 0.01, "diagonal stick input turns while continuing forward");
});

test("inertia preserves vector while brake dissipates it and boost spends energy", () => {
  const a = lab(); const b = lab();
  a.player.space!.assist = false; b.player.space!.assist = false;
  a.player.space!.vx = b.player.space!.vx = 10;
  integrateFlight(a.player, idle, .1, 1, a);
  integrateFlight(b.player, { ...idle, brake: true }, .1, 1, b);
  assert.equal(a.player.space!.vx, 10);
  assert.ok(b.player.space!.vx < 6);
  const before = a.player.space!.energy;
  integrateFlight(a.player, { ...idle, boost: true, throttle: 1 }, .1, 1, a);
  assert.ok(a.player.space!.energy < before);
  assert.ok(a.player.space!.vz < 0);
  const boostedVelocity = Math.abs(a.player.space!.vz);
  const normal = lab();
  integrateFlight(normal.player, { ...idle, throttle: 1 }, .1, 1, normal);
  assert.ok(boostedVelocity > Math.abs(normal.player.space!.vz), "forward boost adds acceleration beyond the analog throttle");
  const energyAfterBoost = a.player.space!.energy;
  integrateFlight(a.player, idle, .1, 1, a);
  assert.ok(a.player.space!.energy > energyAfterBoost, "energy starts recharging when the temporary boost input is released");
});

test("tactical barrel roll changes quaternion and trajectory with bounded energy and cooldown", () => {
  const match = lab();
  const pilot = match.player;
  const space = pilot.space!;
  const startEnergy = space.energy;
  const startQuaternion = [...space.q];
  step(match, {
    ...idle,
    maneuver: { version: 1, kind: "barrel-roll", direction: "right" },
  }, 1 / 30);

  assert.ok((space.maneuverRollRemaining ?? 0) > 0 && (space.maneuverRollRemaining ?? 0) < Math.PI * 2);
  assert.ok((space.maneuverCooldown ?? 0) > 0);
  assert.ok(space.energy < startEnergy);
  assert.ok(space.vx > 0, "roll command applies a bounded lateral evasive thrust");
  const inProgressQuaternion = [...space.q];
  assert.ok(Math.abs(inProgressQuaternion[2]!) > 0.01);

  for (let i = 0; i < 180 && (space.maneuverRollRemaining ?? 0) !== 0; i++) {
    step(match, idle, 1 / 30);
  }
  assert.equal(space.maneuverRollRemaining ?? 0, 0);
  assert.ok(Math.abs(Math.hypot(...space.q) - 1) < 1e-12);
  const quaternionDot = space.q.reduce((sum, value, index) => sum + value * startQuaternion[index]!, 0);
  assert.ok(quaternionDot < -0.999, "the completed maneuver traverses a full 360-degree quaternion rotation");
  assert.ok(Math.abs(space.vx) > 0.01, "the roll leaves a real changed flight trajectory");
});

test("barrel roll rejects insufficient energy and ignores a second intent while active", () => {
  const match = lab();
  const space = match.player.space!;
  space.energy = 12;
  step(match, {
    ...idle,
    maneuver: { version: 1, kind: "barrel-roll", direction: "left" },
  }, 1 / 30);
  assert.equal(space.maneuverRollRemaining ?? 0, 0);

  space.energy = 100;
  step(match, {
    ...idle,
    maneuver: { version: 1, kind: "barrel-roll", direction: "right" },
  }, 1 / 30);
  const remaining = space.maneuverRollRemaining ?? 0;
  step(match, {
    ...idle,
    maneuver: { version: 1, kind: "barrel-roll", direction: "left" },
  }, 1 / 30);
  assert.ok((space.maneuverRollRemaining ?? 0) > 0);
  assert.ok((space.maneuverRollRemaining ?? 0) < remaining);
});

test("live barrel-roll control rotates during the thumb input and stops on release", () => {
  const match = lab();
  const space = match.player.space!;
  const start = [...space.q];
  const startEnergy = space.energy;
  const rolling: StepInput = {
    ...idle,
    throttle: 0.45,
    yaw: 0.12,
    pitch: -0.08,
    maneuver: { version: 1, kind: "barrel-roll-control", input: 1 },
  };
  let completedFullTurn = false;
  let firstStepLateralVelocity = 0;
  for (let i = 0; i < 60; i++) {
    step(match, rolling, 1 / 60);
    if (i === 0) firstStepLateralVelocity = space.vx;
    const dot = space.q.reduce((sum, value, index) => sum + value * start[index]!, 0);
    if (dot < -0.99) {
      completedFullTurn = true;
      break;
    }
  }
  assert.equal(completedFullTurn, true, "direct roll input should complete a fast hull rotation within one second");
  assert.ok(space.energy < startEnergy, "continuous roll uses the existing energy budget");
  assert.ok(Math.abs(firstStepLateralVelocity) > 0.01, "roll adds a bounded evasive vector while throttle and steering remain active");

  const atRelease = [...space.q];
  step(match, idle, 1 / 60);
  assert.deepEqual(space.q, atRelease, "release stops angular input instead of queuing a delayed roll");

  const beforeReverse = [...space.q];
  step(match, {
    ...idle,
    maneuver: { version: 1, kind: "barrel-roll-control", input: -1 },
  }, 1 / 60);
  assert.notDeepEqual(space.q, beforeReverse, "the pilot can immediately reverse roll direction");

  const depleted = lab();
  depleted.player.space!.energy = 0;
  const beforeDepletedRoll = [...depleted.player.space!.q];
  step(depleted, {
    ...idle,
    maneuver: { version: 1, kind: "barrel-roll-control", input: 1 },
  }, 1 / 60);
  assert.deepEqual(depleted.player.space!.q, beforeDepletedRoll, "the maneuver cannot roll with depleted energy");
});

test("offline right-stick roll input reaches the Orbital hull while aim and thrust stay active", () => {
  const match = lab();
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftY = -0.4;
  bus.rightX = 0.22;
  bus.rightY = -0.18;
  setCircularRollControl(bus, 0.8, 5_000);
  const active = readInput(bus, 5_050);
  assert.equal(active.throttle, 0.4);
  assert.notEqual(active.pitch, 0);
  assert.deepEqual(active.maneuver, { version: 1, kind: "barrel-roll-control", input: 0.8 });

  const before = [...match.player.space!.q];
  step(match, active, 1 / 60);
  assert.notDeepEqual(match.player.space!.q, before);
  assert.ok(Math.abs(match.player.space!.q[2]!) > 0.001, "the hull roll is visible during the same simulation step");

  bus.leftY = 0;
  bus.rightX = 0;
  bus.rightY = 0;
  const released = readInput(bus, 5_121);
  assert.equal(released.maneuver, undefined);
  const afterRelease = [...match.player.space!.q];
  step(match, released, 1 / 60);
  assert.deepEqual(match.player.space!.q, afterRelease);
});

test("vector drift from Rust Disc keeps orbital momentum while the pilot turns", () => {
  const drift = lab(); const normal = lab();
  for (const match of [drift, normal]) {
    match.player.space!.assist = true;
    match.player.space!.vx = 8;
    match.player.space!.vz = -14;
  }
  integrateFlight(drift.player, { ...idle, yaw: 1, drift: true }, 0.1, 1, drift);
  integrateFlight(normal.player, { ...idle, yaw: 1 }, 0.1, 1, normal);
  assert.ok(Math.hypot(drift.player.space!.vx, drift.player.space!.vz) >
    Math.hypot(normal.player.space!.vx, normal.player.space!.vz));
  assert.ok(Math.abs(drift.player.space!.vx - 8) < 0.1);
});

test("missiles require acquired, in-range, visible targets and consume ammo once", () => {
  const match = lab(); const p = match.player; const e = match.enemies[0];
  p.lockTargetId = e.id;
  assert.equal(launchMissile(match, p), false);
  for (let i = 0; i < 80; i++) updateAcquisition(match, p, 1 / 60);
  assert.equal(p.space!.lockProgress, 1);
  assert.equal(launchMissile(match, p), true);
  assert.equal(p.space!.ammo, 7); assert.equal(launchMissile(match, p), false);
  assert.equal(match.bullets[0].homeId, e.id);
  e.space!.y = 60;
  updateAcquisition(match, p, 1 / 60);
  assert.equal(p.space!.lockProgress, 0);
  e.space!.y = 0; e.z = -100;
  assert.equal(targetSolution(p, e).available, false);
  e.z = -4; e.cloak = 1;
  assert.equal(targetSolution(p, e).available, false);
});

test("swept projectile collision detects fast hits but not ships above the trajectory", () => {
  const bullet = { x: 0, y: 0, z: -10, vx: 0, vy: 0, vz: -100, r: .3, dmg: 10, faction: "ussf" as const, life: 1, homeId: null, own: true };
  assert.equal(segmentHit(0, 0, -5, bullet, 0, 0, 0, 1), true);
  assert.equal(segmentHit(0, 5, -5, bullet, 0, 0, 0, 1), false);
});

test("damage follows shields then armor then hull and destruction emits one explosion", () => {
  const match = lab(); const e = match.enemies[0];
  e.shield = 10; e.space!.armor = 10; e.hull = 10; e.fireCd = 1000; e.hurtT = 1;
  match.bullets.push({ x: e.x, y: e.space!.y, z: e.z, vx: 0, vy: 0, vz: 0, r: .4, dmg: 20, faction: "ussf", life: 1, homeId: null, own: true });
  step(match, idle, 1 / 60);
  assert.equal(e.shield, 0); assert.equal(e.space!.armor, 4); assert.equal(e.hull, 6);
  match.bullets.push({ x: e.x, y: e.space!.y, z: e.z, vx: 0, vy: 0, vz: 0, r: .4, dmg: 30, faction: "ussf", life: 1, homeId: null, own: true });
  step(match, idle, 1 / 60);
  assert.equal(e.alive, false); assert.equal(match.kills, 1);
  assert.equal(match.fx.filter((fx) => fx.k === "boom").length, 1);
});

test("representative target, acquire, pulse, missile, damage and destruction loop", () => {
  const match = lab();
  step(match, { ...idle, lock: true }, 1 / 60);
  const target = match.enemies[0];
  assert.equal(match.player.lockTargetId, target.id);
  let launched = false;
  for (let i = 0; i < 800 && target.alive; i++) {
    const launch = !launched && match.player.space!.lockProgress === 1;
    step(match, { ...idle, fire: true, missile: launch }, 1 / 60);
    if (launch) launched = true;
  }
  assert.ok(launched); assert.equal(match.player.space!.ammo, 7);
  assert.equal(target.alive, false); assert.ok(match.kills >= 1); assert.ok(match.fx.some((fx) => fx.k === "ping"));
});

test("offline Orbital opponents fire occasional guided missiles that expose a countermeasure window", () => {
  const match = prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", { seed: 1938, orbitalTraining: true }));
  let observedIncomingMissile = false;
  for (let i = 0; i < 1800 && !observedIncomingMissile; i++) {
    step(match, idle, 1 / 60);
    observedIncomingMissile = match.bullets.some((bullet) =>
      bullet.missile && bullet.faction !== match.player.faction,
    );
  }
  assert.equal(observedIncomingMissile, true);
});

test("orbital input pulses are edge triggered and clear on focus loss", () => {
  const bus = createBus("arc"); bus.orbital = true;
  bus.countermeasureEnabled = true;
  bus.keys = new Set(["KeyM", "KeyG", "KeyH", "KeyC", "KeyQ"]);
  bus.countermeasurePulse = true;
  const first = readInput(bus); const second = readInput(bus);
  assert.equal(first.missile, true); assert.equal(second.missile, false);
  assert.equal(first.countermeasure, true); assert.equal(second.countermeasure, false);
  assert.equal(first.inertial, true); assert.equal(second.inertial, false);
  assert.equal(first.vertical, 1); assert.equal(first.roll, 1);
  clearInput(bus); assert.equal(readInput(bus).vertical, 0);
});

test("Orbital v3 decoys standard and disrupts hardened missiles tracking the pilot", () => {
  const match = lab();
  match.bullets.push(
    { x: 500, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: match.player.id, own: false, missile: true, weaponId: "standard-test", countermeasureClass: "standard" },
    { x: 510, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: match.player.id, own: false, missile: true, weaponId: "hardened-test", countermeasureClass: "hardened" },
    { x: 520, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: match.enemies[0]!.id, own: false, missile: true, weaponId: "ally-target-test", countermeasureClass: "standard" },
    { x: 530, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "ussf", r: 0.4, homeId: match.player.id, own: true, missile: true, weaponId: "friendly-test", countermeasureClass: "standard" },
    { x: 540, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: null, own: false, missile: false },
  );
  step(match, { ...idle, countermeasure: true }, 1 / 60);
  const standard = match.bullets.find((bullet) => bullet.weaponId === "standard-test");
  const hardened = match.bullets.find((bullet) => bullet.weaponId === "hardened-test");
  const allyTargeted = match.bullets.find((bullet) => bullet.weaponId === "ally-target-test");
  const friendly = match.bullets.find((bullet) => bullet.weaponId === "friendly-test");
  assert.equal(standard?.homeId, null, "standard seekers keep flying but lose target guidance");
  assert.equal(hardened?.homeId, match.player.id, "hardened seekers retain the target");
  assert.ok((hardened?.guidanceSuppressed ?? 0) > 0.5, "hardened guidance is disrupted for a short evasion window");
  assert.equal(allyTargeted?.homeId, match.enemies[0]!.id, "missiles tracking someone else are unaffected");
  assert.equal(friendly?.homeId, match.player.id, "friendly ordnance is unaffected");
  const flare = match.fx.find((fx) => fx.k === "flare");
  assert.equal(flare?.decoyed, 1);
  assert.equal(flare?.disrupted, 1);
  assert.equal(match.player.space!.countermeasureCd, 3.5);

  const flareCount = match.fx.filter((fx) => fx.k === "flare").length;
  step(match, { ...idle, countermeasure: true }, 1 / 60);
  assert.equal(match.fx.filter((fx) => fx.k === "flare").length, flareCount, "cooldown prevents repeated flare pulses");
});

test("Orbital v2 keeps its already-issued all-missile countermeasure behavior", () => {
  const match = prepareOrbital(
    createMatch("duskbreaker", "ussf", 0, "practice", { seed: 1938, foeCount: 3, orbitalTraining: true }),
    ORBITAL_WEAPON_RULES_VERSION,
  );
  match.rocks = [];
  match.bullets.push(
    { x: 500, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: match.player.id, own: false, missile: true },
    { x: 510, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: match.enemies[0]!.id, own: false, missile: true },
    { x: 520, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 4, dmg: 10, faction: "accord", r: 0.4, homeId: null, own: false, missile: false },
  );
  step(match, { ...idle, countermeasure: true }, 1 / 60);
  assert.equal(match.bullets.length, 1);
  assert.equal(match.player.space!.countermeasureCd, undefined);
});

test("Orbital v3 flare release remains visible when a decoyed missile expires that frame", () => {
  const match = lab();
  match.bullets.push({
    x: 500, z: 500, vx: 0, vz: 0, y: 0, vy: 0, life: 1 / 120, dmg: 10,
    faction: "accord", r: 0.4, homeId: match.player.id, own: false, missile: true,
    countermeasureClass: "standard",
  });
  step(match, { ...idle, countermeasure: true }, 1 / 60);
  assert.ok(match.fx.some((fx) =>
    fx.k === "flare" && fx.x === match.player.x && fx.y === match.player.space!.y && fx.z === match.player.z,
  ));
});

test("mobile vector-thrust axes produce lateral and vertical Orbital movement", () => {
  const match = lab();
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftX = 0.7;
  bus.leftY = -0.4;
  const input = readInput(bus);
  for (let i = 0; i < 30; i++) integrateFlight(match.player, input, 1 / 60, 1, match);
  assert.ok(match.player.x > 0.1);
  assert.ok(match.player.space!.y > 0.1);
});

test("aim assistance cannot track cloaked or sensor-blocked targets", () => {
  const match = lab(); const p = match.player; const e = match.enemies[0];
  p.lockTargetId = e.id; e.x = 2;
  assert.ok(primaryBullet(match, p, 10).vx > 0);
  e.cloak = 1;
  assert.equal(primaryBullet(match, p, 10).vx, 0);
  e.cloak = 0; p.jam = 1;
  assert.equal(primaryBullet(match, p, 10).vx, 0);
});
