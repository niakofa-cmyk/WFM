import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  setAuthTokenGetter,
  setBaseUrl,
} from "@workspace/api-client-react";
import { customFetch } from "../../../../lib/api-client-react/src/custom-fetch.ts";

async function captureRequestHeaders(
  tokenGetter: () => Promise<string | null> | string | null,
  requestHeaders?: HeadersInit,
): Promise<Headers> {
  const originalFetch = globalThis.fetch;
  const captured: { headers?: Headers } = {};

  setBaseUrl(null);
  setAuthTokenGetter(tokenGetter);
  globalThis.fetch = async (_input, init) => {
    captured.headers = new Headers(init?.headers);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await customFetch("/api/profile", {
      responseType: "json",
      headers: requestHeaders,
    });
    assert.ok(captured.headers, "customFetch should issue a request");
    return captured.headers;
  } finally {
    setAuthTokenGetter(null);
    setBaseUrl(null);
    globalThis.fetch = originalFetch;
  }
}

test("WFM mounts the Clerk token bridge inside its provider", async () => {
  const appSource = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

  assert.match(appSource, /function ApiAuthBridge\(\)/);
  assert.match(appSource, /setAuthTokenGetter\(\(\) =>/);
  assert.match(appSource, /isLoaded && isSignedIn \? getToken\(\) : null/);
  assert.match(appSource, /<ApiAuthBridge\s*\/>/);
});

test("customFetch forwards the signed-in session as a bearer header", async () => {
  const headers = await captureRequestHeaders(
    async () => "synthetic-session-token",
  );

  assert.equal(headers.get("authorization"), "Bearer synthetic-session-token");
});

test("customFetch omits authorization when no session token is available", async () => {
  const headers = await captureRequestHeaders(() => null);

  assert.equal(headers.has("authorization"), false);
});

test("customFetch preserves an explicit authorization header", async () => {
  let tokenGetterCalls = 0;
  const headers = await captureRequestHeaders(
    () => {
      tokenGetterCalls += 1;
      return "synthetic-session-token";
    },
    { authorization: "Bearer explicit-test-token" },
  );

  assert.equal(tokenGetterCalls, 0);
  assert.equal(headers.get("authorization"), "Bearer explicit-test-token");
});
