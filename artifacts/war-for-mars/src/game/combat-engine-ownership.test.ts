import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LEGACY_ORBITAL_RULES_VERSION,
  ORBITAL_LINEUP_RULES_VERSION,
  resolveOrbitalMatchOutcome,
} from "@workspace/orbital-sim";

test("a fixed-step Contact timeout resolves inside the existing replay-frame limit", () => {
  assert.equal(resolveOrbitalMatchOutcome({
    playerAlive: true, livingEnemies: 3,
    elapsedSeconds: 119.99999999999447, timeLimitSeconds: 120,
    rulesVersion: ORBITAL_LINEUP_RULES_VERSION,
  }), "loss");
});

test("exact combat precedence stays shared and legacy time without Orbital rules stays strict", () => {
  const base = {
    playerAlive: true, livingEnemies: 1,
    elapsedSeconds: 119.99999999999447, timeLimitSeconds: 120,
  };
  assert.equal(resolveOrbitalMatchOutcome({ ...base, rulesVersion: LEGACY_ORBITAL_RULES_VERSION }), "loss");
  assert.equal(resolveOrbitalMatchOutcome(base), null);
  assert.equal(resolveOrbitalMatchOutcome({ ...base, playerAlive: false }), "loss");
  assert.equal(resolveOrbitalMatchOutcome({ ...base, livingEnemies: 0 }), "win");
});

test("client and reward server route combat through byte-identical Orbital orchestration and ability adapters", () => {
  for (const file of ["orbital-sim.ts", "orbital-abilities.ts"]) {
    assert.deepEqual(
      readFileSync(new URL(`./${file}`, import.meta.url)),
      readFileSync(new URL(`../../../api-server/src/game/${file}`, import.meta.url)),
      `${file} must stay in parity until its dependencies are extracted into the shared engine`,
    );
  }
});
