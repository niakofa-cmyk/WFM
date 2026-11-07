import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createOrbitalRuntime, getGameModeDefinition, integrateSpatialFlight, normalizeFlightControls, ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { clearInput, createBus, readInput, setCircularRollControl } from "./input";
import { prepareOrbital } from "./orbital-sim";
import { createMatch } from "./sim";
import { SHIPS } from "./ships";
import {
  CINDER_STATION, UNIVERSE_BOUNDARY_RADIUS, UNIVERSE_COLLIDERS, UNIVERSE_MODE_ID,
  capturePilotPose, cinderStationTransform, createUniverseSession, evaluateCinderDock,
  placeAtSpawn, restorePilotPose, transitionUniverse, universeFrozen,
} from "./orbital-universe-session";

function localMatch() {
  return prepareOrbital(createMatch("duskbreaker", "ussf", 0, "practice", {
    seed: 1938, orbitalTraining: true, allyCount: 1, foeCount: 3,
  }));
}
function atStation() {
  const craft = localMatch().player;
  craft.x = CINDER_STATION.x;
  craft.z = CINDER_STATION.z + 2;
  craft.space!.y = CINDER_STATION.y;
  return craft;
}
function dockedSession() {
  const craft = atStation();
  return transitionUniverse(createUniverseSession(), {
    type: "dock", pose: capturePilotPose(craft),
    dock: evaluateCinderDock(craft), rendererReady: true,
  });
}

test("local universe declares canonical Arena ownership with no network or reward authority", () => {
  const definition = getGameModeDefinition(UNIVERSE_MODE_ID);
  const runtime = createOrbitalRuntime(definition);
  assert.equal(runtime.runtimeId, ORBITAL_RUNTIME_ID);
  assert.equal(runtime.authority, "local");
  assert.equal(runtime.rewardEligibility, "none");
  assert.equal(definition.presentation.lifecycleOwner, "Arena");
  assert.ok(definition.rules.includes("bounded-local-sector"));
  assert.ok(definition.rules.includes("no-server-location-authority"));
});

test("spawn has a real spatial pose and cannot remotely dock", () => {
  const craft = localMatch().player;
  placeAtSpawn(craft);
  assert.equal(craft.speed, 0);
  assert.equal(Math.hypot(craft.space!.vx, craft.space!.vy, craft.space!.vz), 0);
  assert.deepEqual(craft.space!.q, [0, 0, 0, 1]);
  assert.equal(evaluateCinderDock(craft).eligible, false);
  assert.equal(evaluateCinderDock(craft).reason, "range");
  const visual = cinderStationTransform();
  assert.equal(visual.position.z, CINDER_STATION.z);
  assert.equal(visual.position.x, CINDER_STATION.x);
});

test("Cinder admission requires physical proximity, low speed, heading, and renderer", () => {
  const craft = atStation();
  assert.equal(evaluateCinderDock(craft).reason, "ready");
  craft.space!.vz = CINDER_STATION.maxClosureSpeed + 1;
  assert.equal(evaluateCinderDock(craft).reason, "closure");
  craft.space!.vz = 0;
  craft.space!.q = [0, 1, 0, 0];
  assert.equal(evaluateCinderDock(craft).reason, "heading");
  craft.space!.q = [0, 0, 0, 1];
  const before = createUniverseSession();
  const event = { type: "dock" as const, pose: capturePilotPose(craft), dock: evaluateCinderDock(craft), rendererReady: false };
  assert.equal(transitionUniverse(before, event), before);
  assert.equal(transitionUniverse(before, { ...event, rendererReady: true }).phase, "docked");
});

test("Cinder docking is available through the 22 m approach radius, but not beyond it", () => {
  const craft = atStation();
  craft.z = CINDER_STATION.z + CINDER_STATION.interactionRadius;
  assert.equal(evaluateCinderDock(craft).distance, 22);
  craft.space!.vz = 3.6;
  assert.equal(evaluateCinderDock(craft).eligible, true);

  craft.z += 0.01;
  assert.equal(evaluateCinderDock(craft).reason, "range");

  craft.z = CINDER_STATION.z + CINDER_STATION.interactionRadius;
  craft.space!.vz = CINDER_STATION.maxClosureSpeed + 0.1;
  assert.equal(evaluateCinderDock(craft).reason, "closure");
});

test("invalid spatial telemetry never passes the local gate", () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    for (const field of ["x", "z"] as const) {
      const craft = atStation();
      craft[field] = invalid;
      assert.equal(evaluateCinderDock(craft).eligible, false);
    }
    for (const field of ["y", "vx", "vy", "vz"] as const) {
      const craft = atStation();
      craft.space![field] = invalid;
      assert.equal(evaluateCinderDock(craft).eligible, false);
    }
    const craft = atStation();
    craft.space!.q[0] = invalid;
    assert.equal(evaluateCinderDock(craft).eligible, false);
  }
});

test("pilot pose capture and restore do not alias quaternion or flight resources", () => {
  const craft = atStation();
  craft.space!.energy = 42;
  craft.space!.vx = .5;
  const pose = capturePilotPose(craft);
  craft.space!.q[0] = .7;
  craft.space!.energy = 0;
  restorePilotPose(craft, pose);
  assert.equal(craft.space!.energy, 42);
  assert.equal(craft.space!.vx, .5);
  assert.equal(craft.space!.q[0], 0);
  craft.space!.q[0] = .2;
  assert.equal(pose.space.q[0], 0);
});

test("station owns its retained pose rather than the caller's mutable event", () => {
  const craft = atStation();
  const pose = capturePilotPose(craft);
  const session = transitionUniverse(createUniverseSession(), {
    type: "dock", pose, dock: evaluateCinderDock(craft), rendererReady: true,
  });
  pose.space.energy = 1;
  pose.space.q[0] = .9;
  pose.x = 99;
  assert.notEqual(session.retained!.x, 99);
  assert.notEqual(session.retained!.space.energy, 1);
  assert.equal(session.retained!.space.q[0], 0);
});

test("training finish, abort, debrief, and undock retain the same universe context repeatedly", () => {
  let session = dockedSession();
  const retained = structuredClone(session.retained);
  for (let run = 1; run <= 20; run++) {
    session = transitionUniverse(session, { type: "launch-training" });
    assert.equal(session.phase, "training");
    assert.equal(session.trainingRuns, run);
    assert.equal(universeFrozen(session.phase), false);
    session = transitionUniverse(session, run % 2
      ? { type: "training-outcome", debrief: { outcome: "win", kills: 3, reason: "Local training complete" } }
      : { type: "abort-training" });
    assert.equal(session.phase, "debrief");
    assert.equal(universeFrozen(session.phase), true);
    assert.deepEqual(session.retained, retained);
    session = transitionUniverse(session, { type: "return-from-debrief" });
    assert.equal(session.phase, "docked");
  }
  session = transitionUniverse(session, { type: "undock" });
  assert.equal(session.phase, "exploration");
  assert.deepEqual(session.retained, retained);
});

test("activities cannot be entered or completed from invalid phases", () => {
  const initial = createUniverseSession();
  for (const event of [
    { type: "launch-training" }, { type: "undock" }, { type: "abort-training" },
    { type: "return-from-debrief" },
    { type: "training-outcome", debrief: { outcome: "win", kills: 3, reason: "invalid" } },
  ] as const) assert.equal(transitionUniverse(initial, event), initial);
});

test("canonical left thumb drives signed translation and right thumb rolls the real universe hull", () => {
  for (const direction of [-1, 1]) {
    const craft = localMatch().player;
    placeAtSpawn(craft);
    const bus = createBus("arc");
    bus.orbital = true; bus.leftStickFlight = true;
    bus.leftY = direction * .7;
    setCircularRollControl(bus, .8, 1000);
    const controls = normalizeFlightControls(readInput(bus, 1001));
    for (let tick = 0; tick < 20; tick++) {
      integrateSpatialFlight(craft, controls, 1 / 60, 1, UNIVERSE_COLLIDERS, SHIPS[craft.ship], { boundaryRadius: UNIVERSE_BOUNDARY_RADIUS });
    }
    assert.ok(craft.z * direction > 0, "signed throttle must move the hull");
    assert.notEqual(craft.space!.q[2], 0, "direct roll must rotate the real spatial state");
    clearInput(bus);
    const neutral = normalizeFlightControls(readInput(bus, 1002));
    assert.equal(neutral.throttle === 0, true);
    assert.equal(neutral.maneuver, undefined);
  }
});

test("universe transitions do not remount a second renderer or launch a parallel approach", () => {
  const source = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/new THREE.WebGLRenderer\(/g) ?? []).length, 1);
  assert.ok(source.includes("transitionLocalUniverse(match, template, session, event)"));
  assert.ok(source.includes("advanceLocalUniverseFlight(match, universeRef.current!, readInput(bus), FIXED)"));
  assert.ok(source.includes("if (!localUniverse && modeId === UNIVERSE_MODE_ID)"));
  assert.ok(!source.includes("CinderRingDockingApproach"));
  const helper = readFileSync(new URL("./orbital-universe-session.ts", import.meta.url), "utf8");
  for (const forbidden of ["requestAnimationFrame(", "WebGLRenderer", "fetch(", "new WebSocket("]) {
    assert.ok(!helper.includes(forbidden), `session helper must not own ${forbidden}`);
  }
});
