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
    const [profile, action, start, legacyClaim] = await Promise.all([
      fetch(`${baseUrl}/game/profile`),
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
    ]);
    assert.equal(profile.status, 401);
    assert.equal(action.status, 401);
    assert.equal(start.status, 401);
    assert.equal(legacyClaim.status, 401);
  } finally {
    server.close();
    await once(server, "close");
  }
});
