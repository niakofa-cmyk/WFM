import assert from "node:assert/strict";
import test from "node:test";
import { resolveWingSocketUrl } from "./socket-endpoint";

const securePage = {
  pageUrl: "https://game.example/play?room=OLD123",
  basePath: "/",
};

test("default socket follows the artifact base path and page security", () => {
  assert.equal(resolveWingSocketUrl(securePage).href, "wss://game.example/ws");
  assert.equal(
    resolveWingSocketUrl({ ...securePage, basePath: "/war-for-mars/" }).href,
    "wss://game.example/war-for-mars/ws",
  );
  assert.equal(
    resolveWingSocketUrl({ ...securePage, pageUrl: "http://localhost:5173/" })
      .href,
    "ws://localhost:5173/ws",
  );
});

test("separate backend is preserved when adding or replacing the room for reconnects", () => {
  const options = {
    ...securePage,
    endpoint: "wss://matches.example/ws?room=OLD123",
  };
  const initial = resolveWingSocketUrl(options);
  initial.searchParams.set("room", "new123");
  const reconnect = resolveWingSocketUrl(options);
  reconnect.searchParams.set("room", "new123");
  assert.equal(initial.href, "wss://matches.example/ws?room=new123");
  assert.equal(reconnect.href, initial.href);
});

test("empty override preserves same-origin development and staging", () => {
  assert.equal(
    resolveWingSocketUrl({ ...securePage, endpoint: "  " }).href,
    "wss://game.example/ws",
  );
});

test("invalid, mixed-content, credential-bearing and non-WebSocket overrides fail explicitly", () => {
  for (const endpoint of [
    "/ws",
    "bad address",
    "https://matches.example/ws",
    "ws://matches.example/ws",
    "wss://user:password@matches.example/ws",
    "wss://matches.example/ws#fragment",
  ]) {
    assert.throws(() => resolveWingSocketUrl({ ...securePage, endpoint }));
  }
});

test("authentication material is rejected from WebSocket query strings", () => {
  for (const parameter of [
    "token",
    "access_token",
    "session_token",
    "auth_token",
    "authorization",
    "jwt",
  ]) {
    assert.throws(
      () =>
        resolveWingSocketUrl({
          ...securePage,
          endpoint: `wss://matches.example/ws?${parameter}=synthetic-test-value`,
        }),
      /must not include authentication material in its query string/,
    );
  }

  assert.equal(
    resolveWingSocketUrl({
      ...securePage,
      endpoint: "wss://matches.example/ws?room=pilot-room",
    }).search,
    "?room=pilot-room",
  );
});
