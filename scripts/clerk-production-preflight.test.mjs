import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateClerkProductionPreflight,
  PRODUCTION_CLERK_TARGET,
} from "./clerk-production-preflight.mjs";

const syntheticKeys = {
  VITE_CLERK_PUBLISHABLE_KEY: "publishable-sentinel-must-not-print",
  CLERK_PUBLISHABLE_KEY: "api-publishable-sentinel-must-not-print",
  CLERK_SECRET_KEY: "secret-sentinel-must-not-print",
};

function readyEnvironment(overrides = {}) {
  return {
    WFM_CLERK_PREFLIGHT_TARGET: "railway-production",
    WFM_PROD_CLERK_ISSUER: PRODUCTION_CLERK_TARGET.issuer,
    WFM_PROD_CLERK_JWKS_URL: PRODUCTION_CLERK_TARGET.jwksUrl,
    API_ALLOWED_ORIGINS: PRODUCTION_CLERK_TARGET.origin,
    ...syntheticKeys,
    ...overrides,
  };
}

test("does not inspect Production variables until Railway Production is asserted", () => {
  const environment = {
    WFM_CLERK_PREFLIGHT_TARGET: "development",
  };
  for (const name of Object.keys(syntheticKeys)) {
    Object.defineProperty(environment, name, {
      get() {
        assert.fail(`secret variable ${name} must not be accessed`);
      },
    });
  }

  const report = evaluateClerkProductionPreflight(environment, "api");
  assert.equal(report.targetContext, "NOT_ASSERTED");
  assert.equal(report.configurationStatus, "NOT_CHECKED");
  assert.equal(
    report.overallStatus,
    "BLOCKED_TARGET_OR_SERVICE_CONTEXT_NOT_ASSERTED",
  );
  assert.equal(report.productionEnablement, "BLOCKED");
  assert.equal(report.exitCode, 1);
});

test("passes structural checks without claiming key pairing or Production readiness", () => {
  const environment = readyEnvironment();
  Object.defineProperty(environment, "VITE_CLERK_PUBLISHABLE_KEY", {
    get() {
      assert.fail("frontend publishable key must not be read in the API scope");
    },
  });
  const report = evaluateClerkProductionPreflight(environment, "api");

  assert.equal(report.configurationStatus, "PASS");
  assert.equal(
    report.overallStatus,
    "STRUCTURAL_PASS_MANUAL_GATES_BLOCKED",
  );
  assert.equal(report.serviceContext, "api");
  assert.deepEqual(
    report.requiredKeyVariables.map(({ name }) => name),
    ["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
  );
  assert.equal(report.publicConfiguration.productionOrigin.status, "MATCH");
  assert.equal(report.publicConfiguration.clerkIssuer.status, "MATCH");
  assert.equal(report.publicConfiguration.clerkJwksUrl.status, "MATCH");
  assert.equal(
    report.manualVerification.keyInstancePairing,
    "BLOCKED_REQUIRES_AUTHORIZED_EXTERNAL_INSTANCE_AND_SAFE_METADATA_MATCH",
  );
  assert.equal(
    report.manualVerification.emailDelivery,
    "BLOCKED_REQUIRES_TEST_INBOX_OR_CLERK_DELIVERY_LOG_CONFIRMATION",
  );
  assert.equal(
    report.manualVerification.protectedApiAndSessionSmokeTest,
    "NOT_RUN",
  );
  assert.equal(report.productionEnablement, "BLOCKED");
  assert.equal(report.exitCode, 2);
});

test("structural PASS never implies external Production Clerk authorization", () => {
  const report = evaluateClerkProductionPreflight(readyEnvironment(), "api");

  assert.equal(report.configurationStatus, "PASS");
  assert.deepEqual(report.authorization, {
    replitManagedClerkAvailability:
      "NOT_CHECKED_FROM_RAILWAY_SERVICE_CONTEXT",
    externalProductionClerkConnection: {
      status: "NOT_VERIFIED_BY_RAILWAY_SERVICE_CONTEXT",
      gate: "BLOCKED_REQUIRES_OWNER_CONFIRMATION_OF_SECURE_EXTERNAL_CONNECTION",
    },
    frontendApiKeyInstancePairing:
      "BLOCKED_REQUIRES_AUTHORIZED_EXTERNAL_INSTANCE_AND_SAFE_METADATA_MATCH",
  });
  assert.deepEqual(report.productionVerification, {
    apiAllowedOrigins: {
      variable: "API_ALLOWED_ORIGINS",
      status: "MATCH",
    },
    clerkAllowedOrigins:
      "NOT_CHECKED_REQUIRES_AUTHORIZED_EXTERNAL_PRODUCTION_CLERK_CONNECTION",
    clerkRedirectOrigins:
      "NOT_CHECKED_REQUIRES_AUTHORIZED_EXTERNAL_PRODUCTION_CLERK_CONNECTION",
    emailDelivery:
      "BLOCKED_REQUIRES_TEST_INBOX_OR_CLERK_DELIVERY_LOG_CONFIRMATION",
  });
  assert.match(report.operatorAction, /managed tenant/i);
  assert.match(report.operatorAction, /does not migrate accounts, credentials, or sessions/i);
  assert.match(report.operatorAction, /Keep Production blocked/i);
  assert.match(report.operatorAction, /supported non-destructive path/i);
  assert.equal(report.overallStatus, "STRUCTURAL_PASS_MANUAL_GATES_BLOCKED");
  assert.equal(report.productionEnablement, "BLOCKED");
});

test("reports required key-variable presence without returning or printing values", () => {
  const report = evaluateClerkProductionPreflight(
    readyEnvironment({ CLERK_SECRET_KEY: undefined }),
    "api",
  );
  const serialized = JSON.stringify(report);

  assert.deepEqual(report.requiredKeyVariables, [
    { name: "CLERK_PUBLISHABLE_KEY", status: "PRESENT" },
    { name: "CLERK_SECRET_KEY", status: "MISSING" },
  ]);
  assert.equal(serialized.includes("secret-sentinel-must-not-print"), false);
  assert.equal(
    serialized.includes("publishable-sentinel-must-not-print"),
    false,
  );
  assert.equal(
    serialized.includes("api-publishable-sentinel-must-not-print"),
    false,
  );
  assert.equal(report.secretValuesPrinted, false);
  assert.equal(report.configurationStatus, "BLOCKED");
  assert.equal(report.exitCode, 1);
});

test("blocks an incorrect issuer or JWKS URL without echoing configured values", () => {
  const report = evaluateClerkProductionPreflight(
    readyEnvironment({
      WFM_PROD_CLERK_ISSUER: "https://wrong-instance.example",
      WFM_PROD_CLERK_JWKS_URL:
        "https://wrong-instance.example/.well-known/jwks.json",
    }),
    "api",
  );
  const serialized = JSON.stringify(report);

  assert.equal(report.publicConfiguration.clerkIssuer.status, "MISMATCH");
  assert.equal(report.publicConfiguration.clerkJwksUrl.status, "MISMATCH");
  assert.equal(serialized.includes("wrong-instance.example"), false);
  assert.equal(report.configurationStatus, "BLOCKED");
});

test("requires the exact canonical HTTPS production origin allowlist", () => {
  for (const invalidOrigin of [
    "https://niakofa.com/kids/wfm",
    "https://www.niakofa.com",
    "https://niakofa.com,https://www.niakofa.com",
    "http://niakofa.com",
  ]) {
    const report = evaluateClerkProductionPreflight(
      readyEnvironment({ API_ALLOWED_ORIGINS: invalidOrigin }),
      "api",
    );
    assert.equal(
      report.publicConfiguration.productionOrigin.status,
      "MISMATCH",
    );
    assert.equal(report.configurationStatus, "BLOCKED");
  }
});

test("missing public issuer/JWKS metadata remains a blocker", () => {
  const report = evaluateClerkProductionPreflight(
    readyEnvironment({
      WFM_PROD_CLERK_ISSUER: undefined,
      WFM_PROD_CLERK_JWKS_URL: undefined,
    }),
    "api",
  );

  assert.equal(report.publicConfiguration.clerkIssuer.status, "MISSING");
  assert.equal(report.publicConfiguration.clerkJwksUrl.status, "MISSING");
  assert.equal(report.productionEnablement, "BLOCKED");
});

test("frontend scope checks only its own publishable key", () => {
  const environment = readyEnvironment();
  for (const name of [
    "CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "API_ALLOWED_ORIGINS",
  ]) {
    Object.defineProperty(environment, name, {
      get() {
        assert.fail(`${name} must not be read in the frontend service scope`);
      },
    });
  }

  const report = evaluateClerkProductionPreflight(environment, "frontend");
  assert.equal(report.configurationStatus, "PASS");
  assert.equal(report.serviceContext, "frontend");
  assert.deepEqual(report.requiredKeyVariables, [
    { name: "VITE_CLERK_PUBLISHABLE_KEY", status: "PRESENT" },
  ]);
  assert.equal(
    report.publicConfiguration.productionOrigin.status,
    "NOT_CHECKED",
  );
  assert.equal(
    report.productionVerification.apiAllowedOrigins.status,
    "NOT_CHECKED",
  );
  assert.equal(
    report.productionVerification.clerkAllowedOrigins,
    "NOT_CHECKED_REQUIRES_AUTHORIZED_EXTERNAL_PRODUCTION_CLERK_CONNECTION",
  );
  assert.equal(report.productionEnablement, "BLOCKED");
});

test("requires an explicit app or API service scope before inspecting keys", () => {
  const environment = readyEnvironment();
  for (const name of Object.keys(syntheticKeys)) {
    Object.defineProperty(environment, name, {
      get() {
        assert.fail(
          `key variable ${name} must not be read without a service scope`,
        );
      },
    });
  }

  const report = evaluateClerkProductionPreflight(environment);
  assert.equal(report.targetContext, "OPERATOR_ASSERTED_RAILWAY_PRODUCTION");
  assert.equal(report.serviceContext, "NOT_ASSERTED");
  assert.equal(report.configurationStatus, "NOT_CHECKED");
  assert.equal(
    report.overallStatus,
    "BLOCKED_TARGET_OR_SERVICE_CONTEXT_NOT_ASSERTED",
  );
  assert.equal(report.productionEnablement, "BLOCKED");
  assert.equal(report.exitCode, 1);
});
