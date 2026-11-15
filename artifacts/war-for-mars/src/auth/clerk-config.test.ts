import assert from "node:assert/strict";
import test from "node:test";
import { configuredClerkPublishableKey } from "./clerk-config";

test("Clerk configuration preserves the explicitly selected instance for either environment", () => {
  for (const fixture of ["pk_test_synthetic_fixture", "pk_live_synthetic_fixture"]) {
    assert.equal(configuredClerkPublishableKey(fixture), fixture);
  }
});

test("Clerk configuration accepts surrounding environment-setting whitespace", () => {
  assert.equal(configuredClerkPublishableKey(" pk_test_synthetic_fixture \n"), "pk_test_synthetic_fixture");
});

test("missing Clerk configuration fails without exposing supplied values", () => {
  for (const fixture of [undefined, "", "  "]) {
    assert.throws(() => configuredClerkPublishableKey(fixture), {
      message: "Missing VITE_CLERK_PUBLISHABLE_KEY.",
    });
  }
});
