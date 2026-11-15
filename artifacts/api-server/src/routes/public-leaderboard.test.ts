import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { createPublicLeaderboardRouter } from "./public-leaderboard";

test("public leaderboard is readable without authentication and returns no private identifiers", async () => {
  const app = express();
  app.use(
    "/api",
    createPublicLeaderboardRouter(async () => [
      { rank: 1, callsign: "Rook 7", score: 42 },
    ]),
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/game/leaderboard`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json() as {
      entries: Array<Record<string, unknown>>;
    };
    assert.deepEqual(body.entries, [{ rank: 1, callsign: "Rook 7", score: 42 }]);
    assert.deepEqual(Object.keys(body.entries[0]!).sort(), ["callsign", "rank", "score"]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
