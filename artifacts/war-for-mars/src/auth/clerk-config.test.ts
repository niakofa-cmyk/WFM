import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  clerkProxyUrlForEnvironment,
  configuredClerkPublishableKey,
  gameAuthReturnUrl,
} from "./clerk-config";

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

test("Development uses Clerk directly even if a hosted proxy URL is configured", () => {
  assert.equal(clerkProxyUrlForEnvironment(true, "/api/__clerk"), undefined);
  assert.equal(
    clerkProxyUrlForEnvironment(true, "https://hosted.example.test/api/__clerk"),
    undefined,
  );
});

test("hosted builds use only an explicitly configured Clerk proxy URL", () => {
  assert.equal(
    clerkProxyUrlForEnvironment(false, " /api/__clerk "),
    "/api/__clerk",
  );
  assert.equal(clerkProxyUrlForEnvironment(false, undefined), undefined);
  assert.equal(clerkProxyUrlForEnvironment(false, "   "), undefined);
});

test("completed authentication returns to the mounted game entry", () => {
  assert.equal(gameAuthReturnUrl(""), "/");
  assert.equal(gameAuthReturnUrl("/"), "/");
  assert.equal(gameAuthReturnUrl("/war-for-mars/"), "/war-for-mars/");
  assert.equal(gameAuthReturnUrl("/kids/wfm"), "/kids/wfm/");
});

test("game authentication return paths cannot select another origin or query destination", () => {
  for (const path of ["https://example.invalid", "//example.invalid", "/\\example.invalid", "/?next=/login", "/#login"]) {
    assert.throws(() => gameAuthReturnUrl(path), { message: "Invalid game base path." });
  }
});

test("sign-in and registration both explicitly override host-site return defaults", () => {
  const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(source, /const gameEntryUrl = gameAuthReturnUrl\(basePath\)/);
  assert.match(
    source,
    /const clerkProxyUrl = clerkProxyUrlForEnvironment\([\s\S]*?import\.meta\.env\.DEV,[\s\S]*?import\.meta\.env\.VITE_CLERK_PROXY_URL,[\s\S]*?\)/,
  );
  for (const component of ["SignIn", "SignUp"]) {
    assert.match(source, new RegExp(`<${component}\\s[^>]*forceRedirectUrl=\\{gameEntryUrl\\}`));
  }
});
