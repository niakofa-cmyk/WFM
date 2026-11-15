import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLeaderboardProfileUpdate,
  projectPublicWingLeaderboard,
  PUBLIC_WING_LEADERBOARD_LIMIT,
} from "./public-leaderboard";

test("public leaderboard includes only opted-in callsigns and safe positive scores", () => {
  const entries = projectPublicWingLeaderboard([
    { userId: "private-user-a", optIn: true, callsign: "Rook 7", score: "42" },
    { userId: "private-user-b", optIn: false, callsign: "Hidden", score: "999" },
    { userId: "private-user-c", optIn: true, callsign: "bad@email.test", score: "100" },
    { userId: "private-user-d", optIn: true, callsign: "Zero", score: "0" },
    { userId: "private-user-e", optIn: true, callsign: "Ace", score: "80" },
  ]);

  assert.deepEqual(entries, [
    { rank: 1, callsign: "Ace", score: 80 },
    { rank: 2, callsign: "Rook 7", score: 42 },
  ]);
  assert.deepEqual(Object.keys(entries[0]!).sort(), ["callsign", "rank", "score"]);
  assert.equal(JSON.stringify(entries).includes("private-user"), false);
});

test("public leaderboard enforces its cap and stable score ordering", () => {
  const entries = projectPublicWingLeaderboard(
    Array.from({ length: PUBLIC_WING_LEADERBOARD_LIMIT + 5 }, (_, index) => ({
      userId: `private-user-${index}`,
      optIn: true,
      callsign: `Pilot ${String(index).padStart(2, "0")}`,
      score: index + 1,
    })),
  );

  assert.equal(entries.length, PUBLIC_WING_LEADERBOARD_LIMIT);
  assert.equal(entries[0]?.score, PUBLIC_WING_LEADERBOARD_LIMIT + 5);
  assert.equal(entries.at(-1)?.rank, PUBLIC_WING_LEADERBOARD_LIMIT);
});

test("unsafe or malformed aggregate scores are excluded", () => {
  const entries = projectPublicWingLeaderboard([
    { userId: "safe", optIn: true, callsign: "Pilot", score: 12 },
    { userId: "nan", optIn: true, callsign: "Number", score: "not-a-number" },
    { userId: "unsafe", optIn: true, callsign: "Huge", score: Number.MAX_SAFE_INTEGER + 1 },
    { userId: "negative", optIn: true, callsign: "Minus", score: -1 },
  ]);
  assert.deepEqual(entries, [{ rank: 1, callsign: "Pilot", score: 12 }]);
});

test("opt-out clears the public callsign and enabled profiles require a safe callsign", () => {
  assert.deepEqual(
    normalizeLeaderboardProfileUpdate({ enabled: false, callsign: "Pilot" }),
    { enabled: false, callsign: null },
  );
  assert.deepEqual(
    normalizeLeaderboardProfileUpdate({ enabled: true, callsign: "  Rook 7  " }),
    { enabled: true, callsign: "Rook 7" },
  );
  assert.throws(
    () => normalizeLeaderboardProfileUpdate({ enabled: true, callsign: "pilot@example.com" }),
    /invalid_public_callsign/,
  );
  assert.throws(
    () => normalizeLeaderboardProfileUpdate({ enabled: true, callsign: "A" }),
    /invalid_public_callsign/,
  );
});
