import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { customFetch, setAuthTokenGetter } from "../../../../lib/api-client-react/src/custom-fetch";
import { installGameApiSession } from "./api-auth-session";

test("first API request carries a fresh token and later requests refresh it", async () => {
  const originalFetch = globalThis.fetch;
  const observed: Array<string | null> = [];
  let issued = 0;
  globalThis.fetch = async (_input, options) => {
    observed.push(new Headers(options?.headers).get("authorization"));
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  const release = installGameApiSession(() => `fixture-${++issued}`, setAuthTokenGetter);
  try {
    await customFetch("/api/game/profile");
    await customFetch("/api/world");
    assert.deepEqual(observed, ["Bearer fixture-1", "Bearer fixture-2"]);
  } finally { release(); globalThis.fetch = originalFetch; }
});

test("missing and failed tokens never send unauthenticated API requests", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("{}"); };
  try {
    for (const getter of [() => null, async () => { throw new Error("Session refresh failed"); }]) {
      const release = installGameApiSession(getter, setAuthTokenGetter);
      try { await assert.rejects(customFetch("/api/game/profile")); }
      finally { release(); }
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("sign-out cancels token resolution already in flight", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveToken!: (token: string) => void;
  globalThis.fetch = async () => { calls++; return new Response("{}"); };
  const release = installGameApiSession(
    () => new Promise<string>((resolve) => { resolveToken = resolve; }),
    setAuthTokenGetter,
  );
  try {
    const rejection = assert.rejects(customFetch("/api/game/profile"), /session changed/);
    release();
    resolveToken("fixture-token");
    await rejection;
    assert.equal(calls, 0);
  } finally { release(); globalThis.fetch = originalFetch; }
});

test("old account cleanup cannot remove the new session provider", async () => {
  const originalFetch = globalThis.fetch;
  let bearer: string | null = null;
  globalThis.fetch = async (_input, options) => {
    bearer = new Headers(options?.headers).get("authorization");
    return new Response("{}");
  };
  const oldRelease = installGameApiSession(() => "old-fixture", setAuthTokenGetter);
  const newRelease = installGameApiSession(() => "new-fixture", setAuthTokenGetter);
  try {
    oldRelease();
    await customFetch("/api/game/profile");
    assert.equal(bearer, "Bearer new-fixture");
  } finally { oldRelease(); newRelease(); globalThis.fetch = originalFetch; }
});

test("redirects remain inside WFM and all signed-in consumers wait for auth", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("./GameApiSession.tsx", import.meta.url), "utf8");
  assert.match(app, /signInForceRedirectUrl=\{`\$\{basePath\}\/`\}/);
  assert.match(app, /signUpForceRedirectUrl=\{`\$\{basePath\}\/`\}/);
  assert.match(app, /<GameApiSession>[\s\S]*?<WarApp\b[\s\S]*?<\/GameApiSession>/);
  assert.doesNotMatch(app, /ApiAuthBridge/);
  assert.match(gate, /readySession !== sessionId/);
  assert.ok(gate.indexOf("installGameApiSession(") < gate.indexOf("setReadySession(sessionId)"));
  assert.match(gate, /return release/);
});
