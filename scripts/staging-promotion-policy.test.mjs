import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_STAGING_ENVIRONMENT_CHECKS,
  requiredEnvironmentFailures,
} from "./staging-promotion-policy.mjs";

const confirmedEnvironment = Object.fromEntries(
  REQUIRED_STAGING_ENVIRONMENT_CHECKS.map((key) => [key, true]),
);

test("the owner-deferred Replit invite-only setting is not a launch requirement", () => {
  assert.deepEqual(
    requiredEnvironmentFailures({
      ...confirmedEnvironment,
      inviteOnlyDeployment: false,
    }),
    [],
  );
});

test("every explicitly required environment assertion must be true", () => {
  for (const key of REQUIRED_STAGING_ENVIRONMENT_CHECKS) {
    assert.deepEqual(requiredEnvironmentFailures({
      ...confirmedEnvironment,
      [key]: false,
    }), [`environment.${key} must be confirmed true.`]);
  }
});

test("missing and non-boolean environment evidence fails closed", () => {
  assert.deepEqual(
    requiredEnvironmentFailures({}),
    REQUIRED_STAGING_ENVIRONMENT_CHECKS.map(
      (key) => `environment.${key} must be confirmed true.`,
    ),
  );
  assert.deepEqual(
    requiredEnvironmentFailures({
      ...confirmedEnvironment,
      separateStagingDatabase: "true",
    }),
    ["environment.separateStagingDatabase must be confirmed true."],
  );
});
