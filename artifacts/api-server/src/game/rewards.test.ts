import assert from "node:assert/strict";
import test from "node:test";
import { adjudicateStrike, validateStrikeReplayInputs } from "./rewards";
import type { ReplayClaim } from "./rewards";

const claim: ReplayClaim = {
  seed: 12345,
  shipId: "mandjet",
  faction: "accord",
  refit: 0,
  pace: "strike",
  goal: "disc",
  disc: "rust",
  allyCount: 4,
  foeCount: 5,
  tech: null,
  inputs: [],
  mission: "skirmish",
  cleared: 0,
  hold: null,
  paid: 0,
  prices: {},
};

test("an incomplete replay cannot claim the minimum loss reward", () => {
  assert.throws(() => adjudicateStrike(claim), /replay ended before the match was resolved/i);
});

test("versioned orbital replays require the complete spatial input contract", () => {
  const surfaceInput = {
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
  const orbitalInput = {
    ...surfaceInput,
    vertical: 0,
    roll: 0,
    boost: false,
    brake: false,
    inertial: false,
    missile: false,
    aimAssist: false,
  };

  assert.doesNotThrow(() => validateStrikeReplayInputs([surfaceInput], "practice", "surface-v1"));
  assert.doesNotThrow(() => validateStrikeReplayInputs([orbitalInput], "practice", "orbital-v1"));
  assert.doesNotThrow(() => validateStrikeReplayInputs([orbitalInput], "practice", "any"));
  assert.throws(() => validateStrikeReplayInputs([orbitalInput], "practice", "surface-v1"), /invalid control input/i);
  assert.throws(() => validateStrikeReplayInputs([surfaceInput], "practice", "orbital-v1"), /invalid control input/i);
  assert.throws(
    () => validateStrikeReplayInputs([surfaceInput, orbitalInput], "practice", "any"),
    /invalid control input/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs(
      [{ ...orbitalInput, missile: true }, { ...orbitalInput, missile: true }],
      "practice",
      "orbital-v1",
    ),
    /release frame/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs([{ ...orbitalInput, countermeasure: false }], "practice", "orbital-v1"),
    /invalid control input/i,
    "the training-only control must not silently expand the versioned Contact replay contract",
  );
});

test("orbital flight rules are restricted to Contact while unversioned runs keep legacy rules", () => {
  assert.throws(
    () => adjudicateStrike({ ...claim, mission: "contact", flightModel: "orbital-v1" }),
    /replay ended before the match was resolved/i,
  );
  assert.throws(
    () => adjudicateStrike({ ...claim, mission: "beacon", flightModel: "orbital-v1" }),
    /not authorized for this campaign sortie/i,
  );
  assert.throws(
    () => adjudicateStrike({
      ...claim,
      mission: "contact",
      inputs: [{
        throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false,
        lock: false, evade: 0, preset: null, vertical: 0, roll: 0, boost: false,
        brake: false, inertial: false, missile: false, aimAssist: false,
      }],
    }),
    /invalid control input/i,
  );
});

test("a validated Contact victory charts Pale Beacons in the campaign galaxy", async () => {
  const { createMatch, step } = await import("./sim");
  const { prepareOrbital } = await import("./orbital-sim");
  const seed = 123;
  const match = createMatch("mandjet", "accord", 0, "practice", {
    seed,
    goal: "disc",
    disc: "rust",
    allyCount: 4,
    foeCount: 4,
    tech: null,
  });
  prepareOrbital(match);
  const input = {
    throttle: 0,
    yaw: 0,
    strafe: 0,
    pitch: 0,
    fire: false,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
    vertical: 0,
    roll: 0,
    boost: false,
    brake: false,
    inertial: false,
    missile: false,
    aimAssist: false,
  } as const;
  const inputs = [];
  for (let frame = 0; frame < 120 * 60 && !match.over; frame += 1) {
    step(match, input, 1 / 60);
    inputs.push(input);
  }
  assert.equal(match.over, "win");

  const result = adjudicateStrike({
    ...claim,
    seed,
    pace: "practice",
    goal: "disc",
    disc: "rust",
    allyCount: 4,
    foeCount: 4,
    mission: "contact",
    flightModel: "orbital-v1",
    cleared: 0,
    inputs,
  });
  assert.equal(result.cleared, 1);
  assert.match(result.advance, /Pale Beacons.*Rust Disc/);
});

test("a full six-minute strike stays active through combat and ends at the timer boundary", async () => {
  const { createMatch, step } = await import("./sim");
  const match = createMatch("mandjet", "accord", 0, "strike", {
    seed: 100,
    goal: "disc",
    disc: "rust",
    allyCount: 4,
    foeCount: 5,
  });
  assert.equal(match.limit, 360);
  match.youBar = 10_000;
  match.foeBar = 10_000;
  for (const craft of [match.player, ...match.allies, ...match.enemies]) craft.ace = false;
  const input = {
    throttle: 0.25,
    yaw: 0.1,
    strafe: 0,
    pitch: 0,
    fire: true,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
  } as const;
  const frames = 360 * 60;
  for (let frame = 0; frame < frames && !match.over; frame += 1) {
    step(match, input, 1 / 60);
  }
  assert.ok(match.time >= 360);
  assert.ok(match.time < 360.02);
  assert.ok(match.over);
});

test("the final clock tick closes the strike when the timer reaches six minutes", async () => {
  const { createMatch, step } = await import("./sim");
  const match = createMatch("mandjet", "accord", 0, "strike", {
    seed: 100,
    goal: "disc",
    disc: "rust",
    allyCount: 4,
    foeCount: 5,
  });
  match.time = match.limit - 1 / 60;
  step(match, {
    throttle: 0,
    yaw: 0,
    strafe: 0,
    pitch: 0,
    fire: false,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
  }, 1 / 60);
  assert.ok(match.time >= 360);
  assert.ok(match.over);
});
