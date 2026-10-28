import assert from "node:assert/strict";
import test from "node:test";

import { configuredClerkPublishableKey } from "./clerk-config";

test("uses the explicitly configured Clerk publishable key unchanged", () => {
  const key = "pk_test_synthetic_instance";
  assert.equal(configuredClerkPublishableKey(key), key);
});

test("trims only surrounding configuration whitespace", () => {
  assert.equal(
    configuredClerkPublishableKey(" pk_test_synthetic_instance \n"),
    "pk_test_synthetic_instance",
  );
});

test("fails explicitly when the configured key is missing", () => {
  assert.throws(() => configuredClerkPublishableKey(undefined), {
    message: "Missing VITE_CLERK_PUBLISHABLE_KEY.",
  });
});
