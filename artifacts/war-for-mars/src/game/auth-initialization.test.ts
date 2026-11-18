import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthLoadingView, AUTH_INITIALIZATION_TIMEOUT_MS } from "../components/auth-initialization";

test("authentication initialization remains a compact status, not a replacement page", () => {
  const html = renderToStaticMarkup(createElement(AuthLoadingView, { timedOut: false, onRetry() {} }));
  assert.match(html, /Checking your secure pilot session/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /min-h-dvh|<main|Connecting to sign-in|Back to Niakofa Kids/);
  assert.doesNotMatch(html, /button-retry-auth/);
});

test("stalled authentication offers an inline retry and keeps the game locked", () => {
  assert.equal(AUTH_INITIALIZATION_TIMEOUT_MS, 10_000);
  const html = renderToStaticMarkup(createElement(AuthLoadingView, { timedOut: true, onRetry() {} }));
  assert.match(html, /Still connecting securely/);
  assert.match(html, /button-retry-auth/);
  assert.match(html, />Retry</);
  assert.match(html, /session is not verified; the game remains locked/);
  assert.doesNotMatch(html, /min-h-dvh|<main|Sign-in is taking longer than expected/);
  assert.doesNotMatch(html, /canvas|signed in successfully/i);
});

test("root and sign-in render the canonical Clerk page until session verification succeeds", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const boundary = readFileSync(new URL("../components/auth-initialization.tsx", import.meta.url), "utf8");
  assert.match(app, /<AuthInitialization>\s*<Switch>/);
  assert.match(app, /const basePath = import\.meta\.env\.BASE_URL\.replace/);
  assert.match(app, /function AccountGameEntry\(\)[\s\S]*?if \(isLoaded && isSignedIn\) return <SignedInGame key=\{userId\} \/>;[\s\S]*?return <Redirect to="\/sign-in" \/>;/);
  assert.match(app, /function SignInEntry\(\)[\s\S]*?if \(isLoaded && isSignedIn\) return <SignedInGame key=\{userId\} \/>;[\s\S]*?return <SignInPage \/>;/);
  assert.match(app, /<Route path="\/" component=\{AccountGameEntry\} \/>/);
  assert.match(app, /<Route path="\/sign-in\/\*\?" component=\{SignInEntry\} \/>/);
  assert.match(app, /data-testid="orbital-signin-page"[\s\S]*?<SignIn/);
  assert.match(app, /proxyUrl=\{clerkProxyUrl\}/);
  assert.match(app, /forceRedirectUrl=\{gameEntryUrl\}/);
  assert.match(app, /<GameApiSession>[\s\S]*?<WarApp \/>[\s\S]*?<\/GameApiSession>/);
  assert.doesNotMatch(app, /<Show when="signed-out">/);
  assert.match(boundary, /return \(\s*<>\s*\{children\}/);
  assert.doesNotMatch(boundary, /if \(!isLoaded\)\s*\{\s*return <AuthLoadingView/);
  assert.match(boundary, /window\.clearTimeout\(timer\)/);
  assert.match(boundary, /window\.location\.reload\(\)/);
  assert.doesNotMatch(boundary, /localStorage|sessionStorage|signOut|removeItem|fetch\(/);
});
