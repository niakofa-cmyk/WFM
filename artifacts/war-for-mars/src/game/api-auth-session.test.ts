import assert from "node:assert/strict";
import { test } from "node:test";
import { customFetch, setAuthTokenGetter, setBaseUrl } from "../../../../lib/api-client-react/src/custom-fetch";
import { installGameApiSession } from "./api-auth-session";

test("profile requests include a fresh Clerk bearer token", async () => {
  const originalFetch = globalThis.fetch;
  const authorization: Array<string | null> = [];
  let issued = 0;
  globalThis.fetch = async (_input, options) => {
    authorization.push(new Headers(options?.headers).get("authorization"));
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  const release = installGameApiSession(() => `token-${++issued}`, setAuthTokenGetter);
  try {
    await customFetch("/api/game/profile");
    await customFetch("/api/game/profile");
    assert.deepEqual(authorization, ["Bearer token-1", "Bearer token-2"]);
  } finally {
    release();
    globalThis.fetch = originalFetch;
  }
});

test("missing or failed Clerk tokens never send an unauthenticated request", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  try {
    for (const getToken of [
      () => null,
      async () => { throw new Error("Clerk token refresh failed"); },
    ]) {
      const release = installGameApiSession(getToken, setAuthTokenGetter);
      try {
        await assert.rejects(customFetch("/api/game/profile"));
      } finally {
        release();
      }
    }
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sign-out invalidates a token that resolves after cleanup", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  let resolveToken!: (token: string) => void;
  globalThis.fetch = async () => {
    requests++;
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  const release = installGameApiSession(
    () => new Promise<string>((resolve) => { resolveToken = resolve; }),
    setAuthTokenGetter,
  );
  try {
    const rejected = assert.rejects(customFetch("/api/game/profile"), /session changed/);
    release();
    resolveToken("late-token");
    await rejected;
    assert.equal(requests, 0);
  } finally {
    release();
    globalThis.fetch = originalFetch;
  }
});

test("cleanup from a prior account cannot clear the current account token getter", async () => {
  const originalFetch = globalThis.fetch;
  let authorization: string | null = null;
  globalThis.fetch = async (_input, options) => {
    authorization = new Headers(options?.headers).get("authorization");
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  const releaseOld = installGameApiSession(() => "old-account", setAuthTokenGetter);
  const releaseNew = installGameApiSession(() => "new-account", setAuthTokenGetter);
  try {
    releaseOld();
    await customFetch("/api/game/profile");
    assert.equal(authorization, "Bearer new-account");
  } finally {
    releaseOld();
    releaseNew();
    globalThis.fetch = originalFetch;
  }
});

test("requests started after sign-out reject instead of falling back to cookies", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response("{}");
  };
  const release = installGameApiSession(() => "signed-in-token", setAuthTokenGetter);
  try {
    release();
    await assert.rejects(customFetch("/api/game/profile"), /session changed/);
    assert.equal(requests, 0);
  } finally {
    release();
    globalThis.fetch = originalFetch;
  }
});

test("account replacement invalidates the prior account's unresolved token", async () => {
  const originalFetch = globalThis.fetch;
  let resolveOld!: (token: string) => void;
  const headers: Array<string | null> = [];
  globalThis.fetch = async (_input, options) => {
    headers.push(new Headers(options?.headers).get("authorization"));
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  const releaseOld = installGameApiSession(
    () => new Promise<string>((resolve) => { resolveOld = resolve; }),
    setAuthTokenGetter,
  );
  let releaseNew = () => {};
  try {
    const rejected = assert.rejects(customFetch("/api/game/profile"), /session changed/);
    releaseNew = installGameApiSession(() => "new-pilot-token", setAuthTokenGetter);
    resolveOld("old-pilot-token");
    await rejected;
    await customFetch("/api/game/profile");
    assert.deepEqual(headers, ["Bearer new-pilot-token"]);
  } finally {
    releaseOld();
    releaseNew();
    globalThis.fetch = originalFetch;
  }
});

test("configured API origins receive authenticated profile requests", async () => {
  const originalFetch = globalThis.fetch;
  let destination = "";
  let authorization: string | null = null;
  globalThis.fetch = async (input, options) => {
    destination = String(input);
    authorization = new Headers(options?.headers).get("authorization");
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  const release = installGameApiSession(() => "pilot-token", setAuthTokenGetter);
  setBaseUrl("https://api.example.test/");
  try {
    await customFetch("/api/game/profile");
    assert.equal(destination, "https://api.example.test/api/game/profile");
    assert.equal(authorization, "Bearer pilot-token");
  } finally {
    release();
    setBaseUrl(null);
    globalThis.fetch = originalFetch;
  }
});
