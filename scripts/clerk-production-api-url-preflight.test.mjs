import assert from "node:assert/strict";
import test from "node:test";

import { evaluateProductionApiUrlPreflight } from "./clerk-production-api-url-preflight.mjs";

const VALID_ENVIRONMENT = Object.freeze({
  WFM_CLERK_PREFLIGHT_TARGET: "railway-production",
  WFM_CLERK_AUTH_PROVIDER: "external-clerk",
  WFM_CLERK_BACKEND_HOSTING: "railway",
  VITE_API_BASE_URL: "https://api.example.test",
});

test("validates a Production frontend API URL but never authorizes Production", () => {
  const report = evaluateProductionApiUrlPreflight(VALID_ENVIRONMENT, "frontend");

  assert.equal(report.structuralStatus, "PASS");
  assert.equal(
    report.requiredVariables.VITE_API_BASE_URL,
    "PRESENT_VALID_HTTPS_URL",
  );
  assert.equal(report.runtimeServiceContext, "NOT_PROVEN_BY_THIS_CHECK");
  assert.equal(report.productionAuthorization, "NOT_VERIFIED");
  assert.equal(report.productionEnablement, "BLOCKED");
  assert.equal(report.exitCode, 2);
  assert.equal(JSON.stringify(report).includes("api.example.test"), false);
});

test("blocks missing API URL without printing configuration values", () => {
  const report = evaluateProductionApiUrlPreflight(
    { ...VALID_ENVIRONMENT, VITE_API_BASE_URL: "" },
    "frontend",
  );

  assert.equal(report.structuralStatus, "BLOCKED");
  assert.equal(report.requiredVariables.VITE_API_BASE_URL, "MISSING");
  assert.equal(report.exitCode, 1);
});

test("blocks non-HTTPS, credentialed, queried, or fragmented API URLs", () => {
  for (const invalidUrl of [
    "http://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test?token=hidden",
    "https://api.example.test/#private",
  ]) {
    const report = evaluateProductionApiUrlPreflight(
      { ...VALID_ENVIRONMENT, VITE_API_BASE_URL: invalidUrl },
      "frontend",
    );
    assert.equal(report.structuralStatus, "BLOCKED");
    assert.equal(
      report.requiredVariables.VITE_API_BASE_URL,
      "INVALID_HTTPS_URL_SHAPE",
    );
    assert.equal(JSON.stringify(report).includes(invalidUrl), false);
  }
});

test("blocks missing target or wrong service scope before reading the API URL", () => {
  for (const [environment, service] of [
    [{ ...VALID_ENVIRONMENT, WFM_CLERK_PREFLIGHT_TARGET: "" }, "frontend"],
    [VALID_ENVIRONMENT, "api"],
  ]) {
    const scopedEnvironment = { ...environment };
    Object.defineProperty(scopedEnvironment, "VITE_API_BASE_URL", {
      get() {
        assert.fail("API URL must not be read outside the asserted frontend scope");
      },
    });

    const report = evaluateProductionApiUrlPreflight(scopedEnvironment, service);
    assert.equal(report.structuralStatus, "BLOCKED");
    assert.equal(
      report.requiredVariables.VITE_API_BASE_URL,
      "NOT_CHECKED_SCOPE_BLOCKED",
    );
    assert.equal(report.productionEnablement, "BLOCKED");
  }
});

test("rejects Replit-managed Clerk or ambiguous hosting declarations", () => {
  const replitManaged = evaluateProductionApiUrlPreflight(
    { ...VALID_ENVIRONMENT, WFM_CLERK_AUTH_PROVIDER: "replit-managed" },
    "frontend",
  );
  assert.equal(
    replitManaged.declarations.authProvider,
    "UNSUPPORTED_REPLIT_MANAGED_CLERK_FOR_RAILWAY",
  );
  assert.equal(replitManaged.structuralStatus, "BLOCKED");

  const unknownHosting = evaluateProductionApiUrlPreflight(
    { ...VALID_ENVIRONMENT, WFM_CLERK_BACKEND_HOSTING: "somewhere-else" },
    "frontend",
  );
  assert.equal(unknownHosting.declarations.backendHosting, "AMBIGUOUS");
  assert.equal(unknownHosting.structuralStatus, "BLOCKED");
});
