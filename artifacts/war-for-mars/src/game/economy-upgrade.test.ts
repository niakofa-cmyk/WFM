import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, step, type StepInput } from "./sim";
import { SHIPS } from "./ships";

test("client solo shields use the same persistent 25-percent multiplier on all eight ships", () => {
  const idle: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };
  for (const id of Object.keys(SHIPS) as (keyof typeof SHIPS)[]) {
    const base = createMatch(id, SHIPS[id].faction, 0, "practice", { seed: 731 });
    const upgraded = createMatch(id, SHIPS[id].faction, 0, "practice", { seed: 731, shieldMk2: true });
    assert.equal(upgraded.player.baseShield, base.player.baseShield * 1.25);
    assert.equal(upgraded.player.hullMax, base.player.hullMax);
    for (let tick = 0; tick < 60; tick++) { step(base, idle, 1 / 60); step(upgraded, idle, 1 / 60); }
    assert.equal(upgraded.player.shieldMax, base.player.shieldMax * 1.25);
  }
});
