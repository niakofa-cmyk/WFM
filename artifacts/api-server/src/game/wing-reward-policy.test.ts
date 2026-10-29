import assert from "node:assert/strict";
import test from "node:test";
import {
  settleWingMatchWithStore,
  WING_REWARD_POLICY,
  type CompletedWingMatch,
  type ExistingWingReward,
  type WingRewardBalance,
  type WingRewardStore,
  type WingRewardWrite,
} from "./wing-reward-policy";

function createMemoryStore() {
  const profiles = new Map<string, WingRewardBalance>();
  const events = new Map<
    string,
    ExistingWingReward & { createdAt: Date }
  >();
  let transactionCalls = 0;
  const store: WingRewardStore = {
    transaction: async (callback) => {
      transactionCalls += 1;
      return callback({
        lockProfiles: async (playerIds) => {
          for (const playerId of playerIds) {
            if (!profiles.has(playerId)) {
              profiles.set(playerId, { credits: 90, revision: 0 });
            }
          }
          return new Map(
            playerIds.map((playerId) => [playerId, profiles.get(playerId)!]),
          );
        },
        findExistingReward: async (playerId, idempotencyKey) => {
          const event = events.get(`${playerId}:${idempotencyKey}`);
          if (!event) return null;
          return {
            amount: event.amount,
            balanceAfter: event.balanceAfter,
            revision: event.revision,
          };
        },
        countRewardsInUtcWindow: async (playerId, start, end) =>
          [...events.entries()].filter(
            ([key, event]) =>
              key.startsWith(`${playerId}:`) &&
              event.createdAt >= start &&
              event.createdAt < end,
          ).length,
        writeReward: async (input: WingRewardWrite) => {
          const profile = profiles.get(input.playerId);
          assert.ok(profile);
          const balanceBefore = profile.credits;
          const updated = {
            credits: balanceBefore + input.amount,
            revision: profile.revision + 1,
          };
          profiles.set(input.playerId, updated);
          events.set(`${input.playerId}:${input.idempotencyKey}`, {
            amount: input.amount,
            balanceAfter: updated.credits,
            revision: updated.revision,
            createdAt: new Date(testNow),
          });
          return {
            balanceBefore,
            balanceAfter: updated.credits,
            revision: updated.revision,
          };
        },
      });
    },
  };
  return {
    store,
    profiles,
    events,
    get transactionCalls() {
      return transactionCalls;
    },
  };
}

const testNow = new Date("2026-10-29T12:00:00.000Z");

function completedMatch(
  matchId: string,
  result: CompletedWingMatch["result"] = "win",
  updates: Partial<CompletedWingMatch["participants"][number]> = {},
): CompletedWingMatch {
  return {
    matchId,
    matchMode: "competitive",
    result,
    participants: [
      {
        playerId: "pilot-team-0",
        team: 0,
        activeSeconds: 60,
        acceptedInputs: 120,
        connectedAtEnd: true,
        ...updates,
      },
      {
        playerId: "pilot-team-1",
        team: 1,
        activeSeconds: 60,
        acceptedInputs: 120,
        connectedAtEnd: true,
      },
    ],
  };
}

test("private, practice, and test rooms cannot settle rewards", async () => {
  const memory = createMemoryStore();
  for (const matchMode of ["private", "practice", "test"] as const) {
    const result = await settleWingMatchWithStore({
      ...completedMatch(`ineligible-${matchMode}`),
      matchMode,
    }, memory.store, testNow);
    assert.equal(result.get("pilot-team-0")?.status, "not_eligible");
    assert.equal(
      result.get("pilot-team-0")?.reason,
      "competitive_queue_required",
    );
    assert.equal(result.get("pilot-team-0")?.gain, 0);
    assert.equal(result.get("pilot-team-1")?.gain, 0);
  }
  assert.equal(memory.transactionCalls, 0);
  assert.equal(memory.profiles.size, 0);
  assert.equal(memory.events.size, 0);
});

test("Wing rewards are team-specific, additive, and idempotent", async () => {
  const { store, profiles, events } = createMemoryStore();
  const match = completedMatch("match-win-1");

  const first = await settleWingMatchWithStore(match, store, testNow);
  assert.deepEqual(
    first.get("pilot-team-0"),
    {
      status: "awarded",
      outcome: "win",
      gain: WING_REWARD_POLICY.credits.win,
      balanceAfter: 120,
      revision: 1,
    },
  );
  assert.deepEqual(first.get("pilot-team-1"), {
    status: "awarded",
    outcome: "loss",
    gain: WING_REWARD_POLICY.credits.loss,
    balanceAfter: 100,
    revision: 1,
  });

  const replay = await settleWingMatchWithStore(match, store, testNow);
  assert.equal(replay.get("pilot-team-0")?.gain, 30);
  assert.equal(replay.get("pilot-team-1")?.gain, 10);
  assert.equal(profiles.get("pilot-team-0")?.credits, 120);
  assert.equal(profiles.get("pilot-team-1")?.credits, 100);
  assert.equal(events.size, 2);
});

test("Wing draws pay the configured draw amount to both qualified pilots", async () => {
  const { store } = createMemoryStore();
  const result = await settleWingMatchWithStore(
    completedMatch("match-draw-1", "draw"),
    store,
    testNow,
  );

  assert.equal(result.get("pilot-team-0")?.gain, 15);
  assert.equal(result.get("pilot-team-1")?.gain, 15);
  assert.equal(result.get("pilot-team-0")?.outcome, "draw");
  assert.equal(result.get("pilot-team-1")?.outcome, "draw");
});

test("Wing rewards require qualified human participation on both teams", async () => {
  const { store, events, profiles } = createMemoryStore();
  const shortMatch = completedMatch("match-short-1", "win", {
    activeSeconds: 59,
  });
  const shortResult = await settleWingMatchWithStore(
    shortMatch,
    store,
    testNow,
  );
  assert.equal(shortResult.get("pilot-team-0")?.status, "not_eligible");
  assert.equal(shortResult.get("pilot-team-0")?.reason, "opposing_human_participation_required");
  assert.equal(events.size, 0);
  assert.equal(profiles.size, 0);

  const oneQualifiedTeam = completedMatch("match-one-team-1");
  oneQualifiedTeam.participants[1] = {
    ...oneQualifiedTeam.participants[1]!,
    connectedAtEnd: false,
  };
  const disconnected = await settleWingMatchWithStore(
    oneQualifiedTeam,
    store,
    testNow,
  );
  assert.equal(disconnected.get("pilot-team-0")?.status, "not_eligible");
  assert.equal(disconnected.get("pilot-team-1")?.status, "not_eligible");
  assert.equal(events.size, 0);
  assert.equal(profiles.size, 0);
});

test("Wing rewards stop at five per UTC day for each account", async () => {
  const { store, profiles, events } = createMemoryStore();

  for (let index = 1; index <= 6; index += 1) {
    const result = await settleWingMatchWithStore(
      completedMatch(`match-daily-${index}`),
      store,
      testNow,
    );
    const expectedStatus = index <= 5 ? "awarded" : "daily_limit";
    assert.equal(result.get("pilot-team-0")?.status, expectedStatus);
    assert.equal(result.get("pilot-team-1")?.status, expectedStatus);
  }

  assert.equal(events.size, 10);
  assert.equal(profiles.get("pilot-team-0")?.credits, 240);
  assert.equal(profiles.get("pilot-team-1")?.credits, 140);
});

test("Wing reward inputs reject duplicate player identities", async () => {
  const { store, events } = createMemoryStore();
  const match = completedMatch("match-duplicate-player");
  match.participants[1] = {
    ...match.participants[1]!,
    playerId: "pilot-team-0",
  };
  const result = await settleWingMatchWithStore(match, store, testNow);
  assert.equal(result.get("pilot-team-0")?.status, "not_eligible");
  assert.equal(events.size, 0);
});
