import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { parseSocketOrigins, socketOriginAllowed } from "./origin-policy";
import { startWingSocketServer } from "./server";

test("origin restrictions are optional locally and exact when configured", () => {
  assert.equal(socketOriginAllowed(undefined, parseSocketOrigins(undefined)), true);
  const allowed = parseSocketOrigins("https://game.example, http://localhost:5173");
  assert.equal(socketOriginAllowed("https://game.example", allowed), true);
  assert.equal(socketOriginAllowed("http://localhost:5173", allowed), true);
  for (const origin of [undefined, "null", "https://game.example.evil", "http://game.example"]) {
    assert.equal(socketOriginAllowed(origin, allowed), false);
  }
});

test("origin configuration rejects paths, credentials and malformed entries", () => {
  for (const value of ["not an origin", "wss://game.example", "https://game.example/play",
    "https://user:password@game.example", "https://game.example?query=1",
    "https://game.example#fragment", "https://game.example,"]) {
    assert.throws(() => parseSocketOrigins(value));
  }
});

test("live socket accepts the allowed frontend and rejects other or missing origins", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    allowedOrigins: parseSocketOrigins("https://game.example"),
    verifySessionToken: async () => "origin-test-player",
  });
  const url = `ws://127.0.0.1:${runtime.port}/ws?room=origin123`;
  try {
    const good = new WebSocket(url, { origin: "https://game.example" });
    await new Promise<void>((resolve, reject) => {
      good.once("open", () => { good.close(); resolve(); });
      good.once("error", reject);
    });
    for (const origin of [undefined, "https://other.example"]) {
      const bad = new WebSocket(url, origin ? { origin } : {});
      const error = await new Promise<Error>((resolve, reject) => {
        bad.once("open", () => { bad.close(); reject(new Error("Unexpected accepted origin")); });
        bad.once("error", resolve);
      });
      assert.match(error.message, /403/);
    }
    const health = await fetch(`http://127.0.0.1:${runtime.port}/healthz`);
    assert.equal(health.status, 200);
  } finally {
    await runtime.close();
  }
});
