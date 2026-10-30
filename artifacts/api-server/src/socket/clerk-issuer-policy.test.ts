import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveClerkIssuer } from "./clerk-issuer-policy";

test("Replit-managed production requires explicit Replit hosting and may omit issuer", () => {
  assert.equal(
    resolveClerkIssuer({
      NODE_ENV: "production",
      WFM_CLERK_AUTH_PROVIDER: "replit-managed",
      WFM_CLERK_BACKEND_HOSTING: "replit",
    }),
    undefined,
  );
});

test("Replit-managed Clerk is rejected for a non-Replit backend", () => {
  assert.throws(
    () =>
      resolveClerkIssuer({
        NODE_ENV: "production",
        WFM_CLERK_AUTH_PROVIDER: "replit-managed",
        WFM_CLERK_BACKEND_HOSTING: "railway",
        CLERK_ISSUER: "https://clerk.example.test",
      }),
    /Replit-hosted backend/,
  );
});

test("external and undeclared production providers still require an issuer", () => {
  for (const environment of [
    { NODE_ENV: "production", WFM_CLERK_AUTH_PROVIDER: "external-clerk" },
    { NODE_ENV: "production" },
  ]) {
    assert.throws(() => resolveClerkIssuer(environment), /CLERK_ISSUER/);
  }
});

test("configured issuer remains enforced as verifier input", () => {
  assert.equal(
    resolveClerkIssuer({
      NODE_ENV: "production",
      WFM_CLERK_AUTH_PROVIDER: "external-clerk",
      CLERK_ISSUER: " https://clerk.example.test ",
    }),
    "https://clerk.example.test",
  );
});

test("unsupported production provider declarations fail closed", () => {
  assert.throws(
    () =>
      resolveClerkIssuer({
        NODE_ENV: "production",
        WFM_CLERK_AUTH_PROVIDER: "unknown-provider",
        CLERK_ISSUER: "https://clerk.example.test",
      }),
    /explicitly supported provider/,
  );
});
