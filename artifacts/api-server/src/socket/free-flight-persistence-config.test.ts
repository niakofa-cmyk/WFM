import assert from "node:assert/strict";
import test from "node:test";
import {
  freeFlightPersistenceConfig,
  freeFlightPersistenceReadiness,
  freeFlightPopulationBalancerConfig,
} from "./free-flight-persistence-config";
import { startWingSocketServer } from "./server";

test("persistent runtime cannot be constructed with missing authority dependencies", async () => {
  for (const missing of ["enabled", "distributed", "checkpoints"] as const) {
    assert.throws(() => freeFlightPersistenceReadiness({
      enabled: true, distributed: true, checkpoints: true, required: true, [missing]: false,
    }), /requires admission/);
  }
  assert.equal(freeFlightPersistenceReadiness({
    enabled: true, distributed: true, checkpoints: true, required: true,
  }).persistentRuntimeConfigured, true);
  await assert.rejects(startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: async () => "test-pilot",
    requireFreeFlightPersistence: true,
  }), /requires admission/);
});

test("socket health reports actual local configuration without implying persistence", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: async () => "test-pilot",
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => null,
  });
  try {
    const response = await fetch(`http://127.0.0.1:${runtime.port}/healthz`);
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.ok(typeof health === "object" && health !== null && "freeFlight" in health);
    assert.deepEqual(health.freeFlight, {
      enabled: true, transport: "process-local", checkpointStoreConfigured: false,
      persistenceRequired: false, persistentRuntimeConfigured: false,
    });
  } finally {
    await runtime.close();
  }
});

test("isolated development remains available unless persistence is required", () => {
  assert.deepEqual(freeFlightPersistenceConfig({}, true), {
    shared: false, persistenceRequired: false, mode: "process-local",
  });
  assert.throws(() => freeFlightPersistenceConfig({
    ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE: "1",
  }, true), /fallback is forbidden/);
});

test("persistent rollout requires exact opt-ins, database admission and Redis", () => {
  const env = {
    NODE_ENV: "production", WFM_FREE_FLIGHT_SHARED_ENV: "staging",
    ORBITAL_FREE_FLIGHT_SHARED: "1", ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE: "1",
    REDIS_URL: "redis://private-test-broker:6379",
  };
  assert.equal(freeFlightPersistenceConfig(env, true).mode, "redis-fenced-shards");
  assert.throws(() => freeFlightPersistenceConfig(env, false), /database-backed/);
  assert.throws(() => freeFlightPersistenceConfig({ ...env, REDIS_URL: undefined }, true), /configured Redis/);
  assert.throws(() => freeFlightPersistenceConfig({ ...env, WFM_FREE_FLIGHT_SHARED_ENV: undefined }, true), /staging-only/);
  for (const key of ["ORBITAL_FREE_FLIGHT_SHARED", "ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE"]) {
    assert.throws(() => freeFlightPersistenceConfig({ ...env, [key]: "true" }, true), /must be 0 or 1/);
  }
});

test("persistent population balancing is explicitly staging-only and disabled by default", () => {
  assert.equal(freeFlightPopulationBalancerConfig({}, false), false);
  const staging = {
    NODE_ENV: "production",
    WFM_FREE_FLIGHT_SHARED_ENV: "staging",
    DATABASE_URL: "postgresql://staging.invalid/example",
    ORBITAL_FREE_FLIGHT_POPULATION_BALANCER: "1",
  };
  assert.equal(freeFlightPopulationBalancerConfig(staging, true), true);
  assert.throws(() => freeFlightPopulationBalancerConfig({
    ...staging, WFM_FREE_FLIGHT_SHARED_ENV: undefined,
  }, true), /shared WFM staging/);
  assert.throws(() => freeFlightPopulationBalancerConfig(staging, false), /shared WFM staging/);
  assert.throws(() => freeFlightPopulationBalancerConfig({
    ...staging, DATABASE_URL: undefined,
  }, true), /shared WFM staging/);
  assert.throws(() => freeFlightPopulationBalancerConfig({
    ...staging, ORBITAL_FREE_FLIGHT_POPULATION_BALANCER: "true",
  }, true), /must be 0 or 1/);
});

test("configuration failures never expose endpoint contents", () => {
  assert.throws(() => freeFlightPersistenceConfig({
    ORBITAL_FREE_FLIGHT_SHARED: "1", REDIS_URL: "https://example.invalid/private-marker",
  }, true), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes("private-marker"));
    return true;
  });
});
