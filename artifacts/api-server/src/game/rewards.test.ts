import assert from "node:assert/strict";
import test from "node:test";
import { adjudicateStrike } from "./rewards";
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
