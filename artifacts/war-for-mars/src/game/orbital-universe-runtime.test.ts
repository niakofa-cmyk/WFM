import assert from "node:assert/strict";
import test from "node:test";
import { createBus, readInput } from "./input";
import { prepareOrbital } from "./orbital-sim";
import { createMatch, step, type StepInput } from "./sim";
import {
  advanceLocalUniverseFlight,
  evaluateLocalAnomalyScan,
  evaluateLocalRelayInteraction,
  transitionLocalUniverse,
} from "./orbital-universe-runtime";
import { universeSectorContents } from "./universe-sectors";
import {
  capturePilotPose, CINDER_STATION, createUniverseSession, evaluateCinderDock,
  MARS_NIGHT_SIDE_STATION, placeAtSpawn, placeAtUniverseStart, RUST_DISC_RELAY, type UniverseSession,
} from "./orbital-universe-session";

const idle: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };
function setup() {
  const match = prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", {
    seed: 1938, orbitalTraining: true, allyCount: 1, foeCount: 3,
  }));
  const template = structuredClone(match);
  placeAtSpawn(match.player);
  return { match, template };
}
function dock() {
  const { match, template } = setup();
  match.player.x = CINDER_STATION.x;
  match.player.z = CINDER_STATION.z + 2;
  match.player.space!.y = CINDER_STATION.y;
  match.player.space!.energy = 63;
  match.player.space!.ammo = 2;
  match.player.space!.vx = .1;
  match.player.space!.vz = -.2;
  const retained = capturePilotPose(match.player);
  const session = transitionLocalUniverse(match, template, createUniverseSession(), { type: "dock", rendererReady: true });
  assert.equal(session.phase, "docked");
  return { match, template, session, retained };
}

test("actual runtime refuses remote docking and reevaluates a stale eligible readout", () => {
  const { match, template } = setup();
  const original = createUniverseSession();
  assert.equal(transitionLocalUniverse(match, template, original, { type: "dock", rendererReady: true }), original);
  match.player.z = CINDER_STATION.z + 2;
  assert.equal(evaluateCinderDock(match.player).eligible, true);
  match.player.space!.vz = 20;
  assert.equal(transitionLocalUniverse(match, template, original, { type: "dock", rendererReady: true }), original);
  match.player.space!.vz = 0;
  assert.equal(transitionLocalUniverse(match, template, original, { type: "dock", rendererReady: false }), original);
});

test("exploration uses actual canonical controls without stepping clock, AI, or weapon commands", () => {
  const { match } = setup();
  const enemies = structuredClone(match.enemies);
  const bus = createBus("arc");
  bus.orbital = true; bus.leftStickFlight = true; bus.leftY = -.4;
  const session = createUniverseSession();
  for (let frame = 0; frame < 120; frame++) {
    advanceLocalUniverseFlight(match, session, { ...readInput(bus), fire: true, missile: true, ult: true, lock: true }, 1 / 60);
  }
  assert.ok(match.player.z < -1);
  assert.equal(match.time, 0);
  assert.equal(match.over, null);
  assert.deepEqual(match.enemies, enemies);
  assert.equal(match.bullets.length, 0);
  assert.equal(match.kills, 0);
});

test("sector crossing rebases only position and keeps the same continuous flight state", () => {
  const { match } = setup();
  const session = createUniverseSession();
  match.player.x = 255.95;
  match.player.space!.vx = 60;
  const orientation = [...match.player.space!.q];
  const velocityBefore = match.player.space!.vx;
  const nextSector = advanceLocalUniverseFlight(match, session, idle, 1 / 60);
  assert.deepEqual(nextSector, { x: "1", y: "0", z: "0" });
  assert.ok(match.player.x < 0, "local coordinates must rebase into the new sector");
  assert.ok(match.player.space!.vx > 0, "velocity direction must survive sector entry");
  assert.ok(match.player.space!.vx < velocityBefore, "ordinary flight damping still applies");
  assert.deepEqual(match.player.space!.q, orientation, "sector travel must not rotate the ship");
});

test("local anomaly scan requires a real nearby signal and records no combat reward", () => {
  const { match, template } = setup();
  let address = { x: "1", y: "0", z: "0" };
  let contents = universeSectorContents(address);
  for (let x = 1; x <= 100 && !contents.anomaly; x++) {
    address = { x: String(x), y: "0", z: "0" };
    contents = universeSectorContents(address);
  }
  assert.ok(contents.anomaly, "the deterministic sector generator should provide a scannable anomaly");
  const session = { ...createUniverseSession(), sectorAddress: address };
  match.player.x = contents.anomaly.x;
  match.player.z = contents.anomaly.z;
  match.player.space!.y = contents.anomaly.y;
  match.player.space!.vx = 0;
  match.player.space!.vy = 0;
  match.player.space!.vz = 0;

  const scan = evaluateLocalAnomalyScan(match, session);
  assert.equal(scan?.ready, true);
  match.player.space!.vx = 4.1;
  assert.equal(evaluateLocalAnomalyScan(match, session)?.ready, false);
  match.player.space!.vx = 0;
  const scanned = transitionLocalUniverse(match, template, session, { type: "scan-anomaly" });
  assert.notEqual(scanned, session);
  assert.deepEqual(scanned.scannedAnomalies, [scan!.id]);
  assert.equal(scanned.phase, "exploration");
  assert.equal(match.kills, 0);
});

test("Rust Disc relay must be physically approached, scanned, then recovered in this session", () => {
  const { match, template } = setup();
  const session = createUniverseSession();
  assert.equal(evaluateLocalRelayInteraction(match, session), null);
  assert.equal(transitionLocalUniverse(match, template, session, { type: "scan-rust-relay" }), session);

  match.player.x = RUST_DISC_RELAY.position.x + 30;
  match.player.z = RUST_DISC_RELAY.position.z;
  match.player.space!.y = RUST_DISC_RELAY.position.y;
  assert.equal(evaluateLocalRelayInteraction(match, session)?.canScan, false);
  match.player.x = RUST_DISC_RELAY.position.x;
  match.player.space!.vx = 0;
  match.player.space!.vy = 0;
  match.player.space!.vz = 0;
  const atRelay = evaluateLocalRelayInteraction(match, session);
  assert.equal(atRelay?.canScan, true);
  assert.equal(transitionLocalUniverse(match, template, session, { type: "recover-rust-relay" }), session);

  const scanned = transitionLocalUniverse(match, template, session, { type: "scan-rust-relay" });
  assert.equal(scanned.rustRelayScanned, true);
  assert.equal(scanned.rustRelayRecovered, false);
  assert.equal(evaluateLocalRelayInteraction(match, scanned)?.canRecover, true);
  match.player.x += 30;
  assert.equal(evaluateLocalRelayInteraction(match, scanned)?.canRecover, false);
  assert.equal(transitionLocalUniverse(match, template, scanned, { type: "recover-rust-relay" }), scanned);
  match.player.x -= 30;
  const recovered = transitionLocalUniverse(match, template, scanned, { type: "recover-rust-relay" });
  assert.equal(recovered.rustRelayRecovered, true);
  assert.equal(recovered.phase, "exploration");
  assert.equal(transitionLocalUniverse(match, template, recovered, { type: "recover-rust-relay" }), recovered);
  assert.equal(match.kills, 0);
  assert.equal(match.over, null);
});

test("night-side station docking uses the nearest physical station and retains local flight", () => {
  const { match, template } = setup();
  placeAtUniverseStart(match.player, "mars-night-side");
  match.player.x = MARS_NIGHT_SIDE_STATION.position.x;
  match.player.z = MARS_NIGHT_SIDE_STATION.position.z;
  match.player.space!.y = MARS_NIGHT_SIDE_STATION.position.y;
  const session = createUniverseSession();
  const docked = transitionLocalUniverse(match, template, session, { type: "dock", rendererReady: true });
  assert.equal(docked.phase, "docked");
  assert.equal(docked.dockedAt, "mars-night-side-station");
  assert.equal(transitionLocalUniverse(match, template, docked, { type: "launch-training" }), docked);
  assert.equal(match.kills, 0);
  assert.equal(match.over, null);
});

test("frozen station phases ignore flight input, boost, and resource changes", () => {
  const { match, template, session } = dock();
  const before = structuredClone(match);
  for (let frame = 0; frame < 180; frame++) {
    advanceLocalUniverseFlight(match, session, { ...idle, throttle: 1, boost: true, roll: 1 }, 1 / 60);
  }
  assert.deepEqual(match, before);
  let next = transitionLocalUniverse(match, template, session, { type: "launch-training" });
  next = transitionLocalUniverse(match, template, next, { type: "abort-training" });
  const debriefMatch = structuredClone(match);
  advanceLocalUniverseFlight(match, next, { ...idle, throttle: 1 }, 1 / 60);
  assert.deepEqual(match, debriefMatch);
});

test("activity cannot fabricate completion before the actual combat simulation ends", () => {
  const { match, template, session } = dock();
  const training = transitionLocalUniverse(match, template, session, { type: "launch-training" });
  assert.equal(match.over, null);
  assert.equal(transitionLocalUniverse(match, template, training, { type: "training-outcome" }), training);
});

test("real primary fire produces a win and its debrief restores exact exploration resources", () => {
  const { match, template, session, retained } = dock();
  const identity = match;
  let state = transitionLocalUniverse(match, template, session, { type: "launch-training" });
  match.rocks = [];
  match.allies.forEach((craft) => { craft.ai = false; });
  // Stationary low-integrity targets isolate actual projectile/hit/outcome rules.
  match.enemies.forEach((craft, index) => {
    craft.ai = false; craft.x = 0; craft.z = 12 - index * 4;
    craft.space!.y = 0; craft.guard = 0; craft.hull = 1; craft.shield = 0;
  });
  for (let tick = 0; tick < 3600 && !match.over; tick++) step(match, { ...idle, fire: true }, 1 / 60);
  assert.equal(match.over, "win");
  assert.equal(match.kills, 3);
  state = transitionLocalUniverse(match, template, state, { type: "training-outcome" });
  assert.equal(state.phase, "debrief");
  assert.equal(state.debrief!.outcome, "win");
  assert.equal(state.debrief!.kills, 3);
  assert.equal(match, identity);
  assert.deepEqual(capturePilotPose(match.player), retained);
  assert.equal(match.over, null);
  assert.equal(match.time, 0);
  state = transitionLocalUniverse(match, template, state, { type: "return-from-debrief" });
  state = transitionLocalUniverse(match, template, state, { type: "undock" });
  advanceLocalUniverseFlight(match, state, idle, 1 / 60);
  assert.notEqual(match.player.z, retained.z, "retained velocity must resume on undock");
});

test("real training timeout reports loss and returns to the same local pose", () => {
  const { match, template, session, retained } = dock();
  let state = transitionLocalUniverse(match, template, session, { type: "launch-training" });
  match.rocks = [];
  [...match.allies, ...match.enemies].forEach((craft) => { craft.ai = false; });
  for (let tick = 0; tick < 7210 && !match.over; tick++) step(match, idle, 1 / 60);
  assert.equal(match.over, "loss");
  assert.ok(Math.abs(match.time - match.limit) < 1e-6);
  state = transitionLocalUniverse(match, template, state, { type: "training-outcome" });
  assert.equal(state.debrief!.outcome, "loss");
  assert.match(state.debrief!.reason, /time expired/);
  assert.deepEqual(capturePilotPose(match.player), retained);
});

test("actual damage resolves destroyed-hull loss, not a false timeout", () => {
  const { match, template, session, retained } = dock();
  let state = transitionLocalUniverse(match, template, session, { type: "launch-training" });
  match.player.hull = 1; match.player.shield = 0; match.player.guard = 0;
  for (let tick = 0; tick < 7200 && !match.over; tick++) step(match, idle, 1 / 60);
  assert.equal(match.player.alive, false);
  assert.equal(match.over, "loss");
  state = transitionLocalUniverse(match, template, state, { type: "training-outcome" });
  assert.match(state.debrief!.reason, /destroyed/);
  assert.deepEqual(capturePilotPose(match.player), retained);
});

test("repeated actual launch/abort cycles keep match identity and pristine activity data", () => {
  const { match, template, session: original, retained } = dock();
  const immutableTemplate = structuredClone(template);
  let state: UniverseSession = original;
  const identity = match;
  for (let run = 0; run < 12; run++) {
    state = transitionLocalUniverse(match, template, state, { type: "launch-training" });
    assert.deepEqual(match, template);
    for (let frame = 0; frame < 120; frame++) step(match, { ...idle, fire: true, throttle: .3 }, 1 / 60);
    state = transitionLocalUniverse(match, template, state, { type: "abort-training" });
    assert.deepEqual(capturePilotPose(match.player), retained);
    assert.equal(match.bullets.length, 0);
    assert.equal(match, identity);
    state = transitionLocalUniverse(match, template, state, { type: "return-from-debrief" });
  }
  assert.deepEqual(template, immutableTemplate);
  assert.equal(state.trainingRuns, 12);
});
