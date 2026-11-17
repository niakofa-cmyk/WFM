import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AUTH_INITIALIZATION_TIMEOUT_MS,
  AuthLoadingView,
} from "../components/auth-initialization";

test("sign-in loading view is accessible and returns to Niakofa Kids", () => {
  const html = renderToStaticMarkup(
    createElement(AuthLoadingView, {
      timedOut: false,
      returnHref: "/kids/wfm/about",
      onRetry() {},
    }),
  );
  assert.match(html, /Connecting to sign-in/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /href="\/kids\/wfm\/about"/);
  assert.match(html, /Back to Niakofa Kids/);
  assert.doesNotMatch(html, /button-retry-auth/);
});

test("stalled sign-in offers a full-page retry but makes no session claim", () => {
  assert.equal(AUTH_INITIALIZATION_TIMEOUT_MS, 10_000);
  const html = renderToStaticMarkup(
    createElement(AuthLoadingView, {
      timedOut: true,
      returnHref: "/kids/wfm/about",
      onRetry() {},
    }),
  );
  assert.match(html, /Sign-in is taking longer than expected/);
  assert.match(html, /button-retry-auth/);
  assert.match(html, /Retry connection/);
  assert.match(html, /The game has not started/);
  assert.doesNotMatch(html, /canvas|signed in successfully/i);
});

test("only hosted sign-in and sign-up routes are gated; account entry stays protected", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../components/auth-initialization.tsx", import.meta.url), "utf8");

  assert.match(app, /function AccountGameEntry\(\)[\s\S]*?if \(isLoaded && isSignedIn\) return <SignedInGame key=\{userId\} \/>;[\s\S]*?return <PublicLanding \/>;/);
  assert.match(app, /<GameApiSession>[\s\S]*?<WarApp initialOrbitalOpen \/>[\s\S]*?<\/GameApiSession>/);
  assert.match(app, /function SignInPage\(\)[\s\S]*?<AuthInitialization returnHref=\{`\$\{basePath\}\/about`\}>[\s\S]*?<SignIn\b/);
  assert.match(app, /function SignUpPage\(\)[\s\S]*?<AuthInitialization returnHref=\{`\$\{basePath\}\/about`\}>[\s\S]*?<SignUp\b/);
  assert.doesNotMatch(app, /<AuthInitialization[^>]*>\s*<Switch>/);
  assert.match(gate, /window\.clearTimeout\(timer\)/);
  assert.match(gate, /window\.location\.reload\(\)/);
  assert.doesNotMatch(gate, /localStorage|sessionStorage|signOut|removeItem|fetch\(/);
});
