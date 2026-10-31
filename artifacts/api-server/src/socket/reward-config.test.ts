import assert from "node:assert/strict";
import test from "node:test";
import {
  getSocketFeatureReadiness,
  isWingRewardsEnabled,
} from "./reward-config";

test("Wing rewards stay off unless the exact enable flag and database are present", () => {
  assert.equal(isWingRewardsEnabled({}), false);
  assert.equal(
    isWingRewardsEnabled({ WFM_WING_REWARDS_ENABLED: "true" }),
    false,
  );
  assert.equal(
    isWingRewardsEnabled({ DATABASE_URL: "postgres://staging.invalid/db" }),
    false,
  );
  assert.equal(
    isWingRewardsEnabled({
      WFM_WING_REWARDS_ENABLED: "TRUE",
      DATABASE_URL: "postgres://staging.invalid/db",
    }),
    false,
  );
  assert.equal(
    isWingRewardsEnabled({
      WFM_WING_REWARDS_ENABLED: "true",
      DATABASE_URL: "postgres://staging.invalid/db",
    }),
    true,
  );
});

test("socket readiness is fail-closed and contains only safe booleans", () => {
  const databaseUrl = "postgres://should-never-appear";
  const readiness = getSocketFeatureReadiness({
    DATABASE_URL: databaseUrl,
    WFM_CASUAL_AI_QUEUE_ENABLED: "true",
  });

  assert.deepEqual(readiness, {
    competitiveQueueEnabled: false,
    casualAiQueueEnabled: true,
    wingRewardsFlagEnabled: false,
    databaseConfigured: true,
    wingRewardsEnabled: false,
  });
  assert.equal(JSON.stringify(readiness).includes(databaseUrl), false);
  assert.ok(Object.values(readiness).every((value) => typeof value === "boolean"));
});

test("socket readiness enables rewards only with the explicit flag and database", () => {
  assert.deepEqual(
    getSocketFeatureReadiness({
      DATABASE_URL: "postgres://not-logged",
      WFM_COMPETITIVE_QUEUE_ENABLED: "true",
      WFM_CASUAL_AI_QUEUE_ENABLED: "true",
      WFM_WING_REWARDS_ENABLED: "true",
    }),
    {
      competitiveQueueEnabled: true,
      casualAiQueueEnabled: true,
      wingRewardsFlagEnabled: true,
      databaseConfigured: true,
      wingRewardsEnabled: true,
    },
  );
});
