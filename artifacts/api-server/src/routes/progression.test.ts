import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "../app";

test("profile and reward routes reject unauthenticated and forged progression requests", async () => {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  try {
    const station = await fetch(`${baseUrl}/world/services`, { method: "POST" });
    assert.equal(station.status, 401);
    const [profile, controlScheme, action, start, legacyClaim, forgedClaim, market, trade, world, travel, explore, quest] = await Promise.all([
      fetch(`${baseUrl}/game/profile`, {
        headers: { "x-clerk-user-id": "forged-user" },
      }),
      fetch(`${baseUrl}/game/profile/control-scheme`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "forged-user",
        },
        body: JSON.stringify({ scheme: "strafe" }),
      }),
      fetch(`${baseUrl}/game/profile/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: randomUUID(), action: "refit", credits: 9_999_999 }),
      }),
      fetch(`${baseUrl}/strikes/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shipId: "mandjet",
          faction: "accord",
          scheme: "arc",
          pace: "strike",
          mission: "contact",
          tech: null,
          credits: 9_999_999,
        }),
      }),
      fetch(`${baseUrl}/strikes/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gain: 9_999_999, cleared: 4 }),
      }),
      fetch(`${baseUrl}/strikes/${randomUUID()}/claim`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "forged-user",
        },
        body: JSON.stringify({
          inputs: [],
          strikeRunId: randomUUID(),
          reconnectToken: "client-supplied",
          clientLootCalculated: 9_999_999,
        }),
      }),
      fetch(`${baseUrl}/market`),
      fetch(`${baseUrl}/market/trades`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          goodId: "salt",
          side: "buy",
          quantity: 1,
        }),
      }),
      fetch(`${baseUrl}/world`),
      fetch(`${baseUrl}/world/travel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: randomUUID(), destinationId: "rust-disc" }),
      }),
      fetch(`${baseUrl}/world/locations/rust-disc/explore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: randomUUID() }),
      }),
      fetch(`${baseUrl}/world/quests/rust-recording/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: randomUUID(), action: "accept" }),
      }),
    ]);
    assert.equal(profile.status, 401);
    assert.equal(controlScheme.status, 401);
    assert.equal(action.status, 401);
    assert.equal(start.status, 401);
    assert.equal(legacyClaim.status, 401);
    assert.equal(forgedClaim.status, 401);
    assert.equal(market.status, 401);
    assert.equal(trade.status, 401);
    assert.equal(world.status, 401);
    assert.equal(travel.status, 401);
    assert.equal(explore.status, 401);
    assert.equal(quest.status, 401);
  } finally {
    server.close();
    await once(server, "close");
  }
});
