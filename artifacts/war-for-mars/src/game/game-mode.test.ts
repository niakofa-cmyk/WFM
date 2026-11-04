import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrbitalRuntime,
  GAME_MODE_DEFINITIONS,
  getGameModeDefinition,
  ORBITAL_RUNTIME_ID,
} from "@workspace/orbital-sim";

test("the mode registry is a complete, unique source-backed launch inventory", () => {
  const ids = GAME_MODE_DEFINITIONS.map((mode) => mode.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const mode of GAME_MODE_DEFINITIONS) {
    assert.ok(mode.mission.length > 0);
    assert.ok(mode.environment.length > 0);
    assert.ok(mode.players.min > 0 && mode.players.max >= mode.players.min);
    assert.ok(mode.players.minimumHumans <= mode.players.max);
    assert.ok(mode.objectives.length > 0);
    assert.ok(mode.rules.length > 0);
    assert.ok(mode.simulation.packages.length > 0);
  }
});

test("canonical Orbital modes initialize with the pinned simulation rules", () => {
  for (const id of ["orbital-combat-lab", "local-arena-practice", "campaign-contact"] as const) {
    const mode = getGameModeDefinition(id);
    const runtime = createOrbitalRuntime(mode);
    assert.equal(runtime.runtimeId, ORBITAL_RUNTIME_ID);
    assert.equal(runtime.rulesVersion, 1);
    assert.equal(runtime.modeId, id);
    if (mode.authority === "local") assert.equal(runtime.rewardEligibility, "none");
  }
});

test("compatibility, partial, navigation-only, and planned modes cannot silently launch as Orbital", () => {
  for (const mode of GAME_MODE_DEFINITIONS.filter((candidate) => candidate.simulation.migration !== "canonical")) {
    assert.throws(
      () => createOrbitalRuntime(mode),
      new RegExp(`Mode ${mode.id} is not ready for canonical Orbital launch`),
    );
  }
});

test("live competitive, private, and AI-fill reward boundaries are declared in the mode contract", () => {
  const competitive = getGameModeDefinition("wing-competitive");
  assert.equal(competitive.players.minimumHumans, 10);
  assert.equal(competitive.rewardEligibility, "server-validated");
  assert.equal(getGameModeDefinition("wing-private").rewardEligibility, "none");
  assert.equal(getGameModeDefinition("wing-casual-ai").rewardEligibility, "none");
});
