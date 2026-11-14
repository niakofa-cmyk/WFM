import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUniversePopulationEpoch,
  maximumHostileAiShareFromEnvironment,
} from "./universe-population-balancer";

test("population epoch requires fresh server census and does not mutate an empty universe", async () => {
  const stale = await applyUniversePopulationEpoch({
    capturedAt: 1_000,
    observedAt: 1_000,
    activePilotsByFaction: { ussf: 1, accord: 0 },
    total: 1,
  }, { now: new Date(20_000) });
  assert.deepEqual(stale, { status: "stale-census" });

  const empty = await applyUniversePopulationEpoch({
    capturedAt: 900_000,
    observedAt: 20_000,
    activePilotsByFaction: { ussf: 0, accord: 0 },
    total: 0,
  }, { now: new Date(20_000) });
  assert.deepEqual(empty, { status: "empty-census" });
});

test("hostile share remains adjustable but always leaves a friendly faction floor", () => {
  assert.equal(maximumHostileAiShareFromEnvironment(undefined), 0.8);
  assert.equal(maximumHostileAiShareFromEnvironment("0.7"), 0.7);
  assert.equal(maximumHostileAiShareFromEnvironment("0.9"), 0.9);
  assert.throws(() => maximumHostileAiShareFromEnvironment("0.49"), /between 0.5 and 0.9/);
  assert.throws(() => maximumHostileAiShareFromEnvironment("0.95"), /between 0.5 and 0.9/);
});
