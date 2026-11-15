import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthLoadingView, AUTH_INITIALIZATION_TIMEOUT_MS } from "../components/auth-initialization";

test("authentication initialization immediately renders an accessible loading message", () => {
  const html = renderToStaticMarkup(createElement(AuthLoadingView, { timedOut: false, onRetry() {} }));
  assert.match(html, /Connecting to sign-in/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Back to Niakofa Kids/);
  assert.doesNotMatch(html, /button-retry-auth/);
});

test("stalled authentication offers a retry without claiming a session or starting gameplay", () => {
  assert.equal(AUTH_INITIALIZATION_TIMEOUT_MS, 10_000);
  const html = renderToStaticMarkup(createElement(AuthLoadingView, { timedOut: true, onRetry() {} }));
  assert.match(html, /Sign-in is taking longer than expected/);
  assert.match(html, /button-retry-auth/);
  assert.match(html, /Retry connection/);
  assert.match(html, /The game has not started/);
  assert.doesNotMatch(html, /canvas|signed in successfully/i);
});

test("all auth routes are gated while retaining Clerk's protected game branch", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const boundary = readFileSync(new URL("../components/auth-initialization.tsx", import.meta.url), "utf8");
  assert.match(app, /<AuthInitialization>\s*<Switch>/);
  assert.match(app, /<Show when="signed-in"><SignedInGame \/><\/Show>/);
  assert.match(app, /<Show when="signed-out"><PublicLanding \/><\/Show>/);
  assert.match(boundary, /window\.clearTimeout\(timer\)/);
  assert.match(boundary, /window\.location\.reload\(\)/);
  assert.doesNotMatch(boundary, /localStorage|sessionStorage|signOut|removeItem|fetch\(/);
});
