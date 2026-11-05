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
    assert.ok(mode.presentation.renderer.length > 0);
    assert.ok(mode.presentation.lifecycleOwner.length > 0);
  }
});

test("canonical Orbital modes initialize with the pinned simulation rules", () => {
  for (const id of [
    "orbital-combat-lab", "local-arena-practice", "rust-disc-local",
    "rust-disc-sector-coop", "iron-eclipse", "campaign-contact",
  ] as const) {
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

test("simulation and presentation migrations are reported independently", () => {
  const rustDiscLocal = getGameModeDefinition("rust-disc-local");
  assert.equal(rustDiscLocal.simulation.migration, "canonical");
  assert.equal(rustDiscLocal.simulation.runtimeId, ORBITAL_RUNTIME_ID);
  assert.equal(rustDiscLocal.presentation.renderer, "rust-disc-three-v1");
  assert.equal(rustDiscLocal.presentation.lifecycleOwner, "RustDiscFlight");
  assert.equal(rustDiscLocal.presentation.migration, "compatibility");

  for (const id of ["rust-disc-sector-coop", "iron-eclipse"] as const) {
    const mode = getGameModeDefinition(id);
    assert.equal(mode.simulation.migration, "canonical");
    assert.equal(mode.simulation.runtimeId, ORBITAL_RUNTIME_ID);
    assert.equal(mode.presentation.renderer, "rust-disc-three-v1");
    assert.equal(mode.presentation.migration, "compatibility");
  }

  const lab = getGameModeDefinition("orbital-combat-lab");
  assert.equal(lab.presentation.renderer, "arena-three-v1");
  assert.equal(lab.presentation.lifecycleOwner, "Arena");
});

test("live competitive, private, and AI-fill reward boundaries are declared in the mode contract", () => {
  const competitive = getGameModeDefinition("wing-competitive");
  assert.equal(competitive.players.minimumHumans, 10);
  assert.equal(competitive.rewardEligibility, "server-validated");
  assert.equal(getGameModeDefinition("wing-private").rewardEligibility, "none");
  assert.equal(getGameModeDefinition("wing-casual-ai").rewardEligibility, "none");
});
