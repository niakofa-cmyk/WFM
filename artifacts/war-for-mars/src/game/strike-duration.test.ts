import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, matchLimit, outcomeReason, step, type StepInput } from "./sim";

const NEUTRAL_INPUT: StepInput = {
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

function createBeaconStrike(localEndurance = false) {
  return createMatch("mandjet", "accord", 0, "strike", {
    goal: "beacons",
    allyCount: 0,
    foeCount: 0,
    seed: 24,
    localEndurance,
  });
}

test("Strike is capped at 360 simulation seconds, not guaranteed to run that long", () => {
  const match = createBeaconStrike();
  assert.equal(matchLimit("strike"), 360);
  assert.equal(match.limit, 360);
  assert.equal(Object.hasOwn(match, "localEndurance"), false);
});

test("two secured beacons resolve the mission before the timer and explain the result", () => {
  const match = createBeaconStrike();
  for (const relay of match.relays.slice(0, 2)) {
    relay.cap = 1;
    relay.own = 1;
  }

  step(match, NEUTRAL_INPUT, 1 / 60);

  assert.equal(match.over, "win");
  assert.ok(match.time < match.limit);
  assert.equal(outcomeReason(match, 0), "Your wing secured two of three beacons.");
});

test("enemy integrity reaching zero can end the mission early and is not reported as timer expiry", () => {
  const match = createBeaconStrike();
  match.foeBar = 0;

  step(match, NEUTRAL_INPUT, 1 / 60);

  assert.equal(match.over, "win");
  assert.ok(match.time < match.limit);
  assert.equal(
    outcomeReason(match, 0),
    "The enemy wing's integrity was depleted before two beacons were secured.",
  );
});

test("player integrity reaching zero ends the mission early with a depletion reason", () => {
  const match = createBeaconStrike();
  match.youBar = 0;

  step(match, NEUTRAL_INPUT, 1 / 60);

  assert.equal(match.over, "loss");
  assert.ok(match.time < match.limit);
  assert.equal(
    outcomeReason(match, 0),
    "Your wing's integrity was depleted before two beacons were secured.",
  );
});

test("a round that reaches the Strike limit reports timer expiry", () => {
  const match = createBeaconStrike();
  const finalStep = 1 / 60;
  match.time = match.limit - finalStep;

  step(match, NEUTRAL_INPUT, finalStep);

  assert.equal(match.time, match.limit);
  assert.equal(match.over, "loss");
  assert.equal(outcomeReason(match, 0), "Time expired before your wing secured two beacons.");
});

test("the local endurance sample suppresses early endings and stops at the 360-second cap", () => {
  const match = createBeaconStrike(true);
  for (const relay of match.relays.slice(0, 2)) {
    relay.cap = 1;
    relay.own = 1;
  }
  match.foeBar = 0;
  match.youBar = 0;

  step(match, NEUTRAL_INPUT, 1 / 60);

  assert.equal(match.over, null);
  assert.ok(match.time < match.limit);
  assert.ok(match.foeBar > 0);
  assert.ok(match.youBar > 0);

  const finalStep = 1 / 60;
  match.time = match.limit - finalStep;
  step(match, NEUTRAL_INPUT, finalStep);

  assert.equal(match.time, match.limit);
  assert.equal(match.over, "draw");
});
