import assert from "node:assert/strict";
import test from "node:test";
import { isWingRewardsEnabled } from "./reward-config";

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
