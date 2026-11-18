import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AUTH_INITIALIZATION_TIMEOUT_MS,
  AuthLoadingView,
} from "../components/auth-initialization";

test("sign-in initialization is a compact status, not a replacement page", () => {
  const html = renderToStaticMarkup(
    createElement(AuthLoadingView, {
      timedOut: false,
      onRetry() {},
    }),
  );
  assert.match(html, /Checking your secure pilot session/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /min-h-dvh|<main|Connecting to sign-in|Back to Niakofa Kids/);
  assert.doesNotMatch(html, /button-retry-auth/);
});

test("stalled sign-in offers inline retry and keeps the game locked", () => {
  assert.equal(AUTH_INITIALIZATION_TIMEOUT_MS, 10_000);
  const html = renderToStaticMarkup(
    createElement(AuthLoadingView, {
      timedOut: true,
      onRetry() {},
    }),
  );
  assert.match(html, /Still connecting securely/);
  assert.match(html, /button-retry-auth/);
  assert.match(html, />Retry</);
  assert.match(html, /session is not verified; the game remains locked/);
  assert.doesNotMatch(html, /min-h-dvh|<main|Sign-in is taking longer than expected/);
});

test("entry opens Clerk sign-in and game remains gated until Clerk verifies the session", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../components/auth-initialization.tsx", import.meta.url), "utf8");

  assert.match(app, /function AccountGameEntry\(\)[\s\S]*?if \(isLoaded && isSignedIn\) return <SignedInGame key=\{userId\} \/>;[\s\S]*?return <Redirect to="\/sign-in" \/>;/);
  assert.match(app, /function SignInEntry\(\)[\s\S]*?if \(isLoaded && isSignedIn\) return <SignedInGame key=\{userId\} \/>;[\s\S]*?return <SignInPage \/>;/);
  assert.match(app, /<GameApiSession>[\s\S]*?<WarApp initialOrbitalOpen \/>[\s\S]*?<\/GameApiSession>/);
  assert.match(app, /data-testid="orbital-signin-page"[\s\S]*?<SignIn\b/);
  assert.match(app, /<Route path="\/sign-in\/\*\?" component=\{SignInEntry\} \/>/);
  assert.match(gate, /return \(\s*<>\s*\{children\}/);
  assert.match(gate, /window\.clearTimeout\(timer\)/);
  assert.match(gate, /window\.location\.reload\(\)/);
  assert.doesNotMatch(gate, /localStorage|sessionStorage|signOut|removeItem|fetch\(/);
});
