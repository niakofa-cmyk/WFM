import assert from "node:assert/strict";
import test from "node:test";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { ExplorationEncounter, type ExplorationReceipt } from "./exploration-encounter";
import { settleExplorationWithStore, type ExplorationLedgerRecord, type ExplorationRewardStore } from "./exploration-settlement";

function receipt(id = "settlement-test", outcome: "completed" | "aborted" = "completed", damage = true) {
  const encounter = new ExplorationEncounter({
    encounterId: id, sectorId: "mars", authority: "server", mode: "universe-exploration", runtime: ORBITAL_RUNTIME_ID,
    rewardPolicy: { id: "test-only", creditsPerNpcKill: 7, completionCredits: 0, maxCreditsPerEncounter: 10 },
    actors: [
      { id: "a", playerId: "user_a", faction: "ussf", hull: 100 },
      { id: "b", playerId: "user_b", faction: "ussf", hull: 100 },
      { id: "enemy", faction: "accord", hull: 10, rewardEligible: true },
    ],
  });
  if (damage) encounter.recordDamage({ eventId: "hit", tick: 1, attackerActorId: "a", targetActorId: "enemy", hullDamage: 10 });
  return encounter.finalize(2, outcome, false);
}

/** Serial transactional fixture: commits only after the entire callback passes. */
function storeFixture() {
  let profiles = new Map([["user_a", { credits: 90, revision: 0 }], ["user_b", { credits: 90, revision: 0 }]]);
  let ledger = new Map<string, ExplorationLedgerRecord>();
  let queue: Promise<unknown> = Promise.resolve();
  let failFor = "";
  const store: ExplorationRewardStore = {
    transaction: (callback) => {
      const run = queue.then(async () => {
        const draftProfiles = structuredClone(profiles);
        const draftLedger = structuredClone(ledger);
        let locks: string[] = [];
        const output = await callback({
          lockProfiles: async (players) => {
            assert.deepEqual(players, [...players].sort());
            locks = players;
            return new Map(players.filter((player) => draftProfiles.has(player)).map((player) => [player, draftProfiles.get(player)!]));
          },
          findResult: async (player, key) => draftLedger.get(`${player}:${key}`) ?? null,
          writeResult: async (player, key, result, award) => {
            assert.ok(locks.includes(player));
            if (player === failFor) throw new Error("injected ledger failure");
            draftProfiles.set(player, { credits: award.balanceAfter, revision: award.revision });
            draftLedger.set(`${player}:${key}`, { version: result.version, fingerprint: result.fingerprint, award });
          },
        });
        profiles = draftProfiles; ledger = draftLedger;
        return output;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return { store, balance: (player = "user_a") => profiles.get(player), entries: () => ledger.size,
    fail: (player: string) => { failFor = player; }, remove: (player: string) => profiles.delete(player),
    removeResult: (player: string) => { for (const key of ledger.keys()) if (key.startsWith(`${player}:`)) ledger.delete(key); },
    setBalance: (credits: number) => profiles.set("user_a", { credits, revision: 0 }),
    corruptAward: () => {
      const [key, value] = [...ledger.entries()][0];
      ledger.set(key, { ...value, award: { ...value.award, kills: value.award.kills + 1 } });
    },
  };
}

test("concurrent retries accept one settlement, persist kills and return identical duplicates", async () => {
  const fixture = storeFixture();
  const completed = receipt();
  const responses = await Promise.all(Array.from({ length: 8 }, () => settleExplorationWithStore(completed, fixture.store, true)));
  assert.equal(responses.filter((result) => result.status === "settled").length, 1);
  assert.equal(responses.filter((result) => result.status === "duplicate").length, 7);
  assert.deepEqual(fixture.balance(), { credits: 97, revision: 1 });
  assert.equal(fixture.entries(), 2);
  assert.deepEqual(responses[0].awards, responses[7].awards);
  assert.equal(responses[0].awards[0].kills, 1);
  assert.equal((await settleExplorationWithStore(receipt(), fixture.store, true)).status, "duplicate");
});

test("rollback leaves no balance/tally writes and retry succeeds after a later pilot write fails", async () => {
  const fixture = storeFixture();
  fixture.fail("user_b");
  const completed = receipt();
  await assert.rejects(settleExplorationWithStore(completed, fixture.store, true), /injected/);
  assert.deepEqual(fixture.balance(), { credits: 90, revision: 0 });
  assert.equal(fixture.entries(), 0);
  fixture.fail("");
  assert.equal((await settleExplorationWithStore(completed, fixture.store, true)).status, "settled");
  assert.equal(fixture.balance()?.credits, 97);
});

test("default rollout, aborts, missing profiles, conflicts and copied receipts fail closed", async () => {
  const fixture = storeFixture();
  assert.equal((await settleExplorationWithStore(receipt(), fixture.store)).status, "disabled");
  assert.equal((await settleExplorationWithStore(receipt("aborted", "aborted"), fixture.store, true)).status, "not_eligible");
  assert.equal(fixture.entries(), 0);
  await assert.rejects(settleExplorationWithStore({ encounterId: "fake" } as ExplorationReceipt, fixture.store, true), /Server-issued/);
  await settleExplorationWithStore(receipt(), fixture.store, true);
  await assert.rejects(settleExplorationWithStore(receipt("settlement-test", "completed", false), fixture.store, true), /Conflicting/);
  assert.equal(fixture.balance()?.credits, 97);
  const missing = storeFixture();
  missing.remove("user_b");
  await assert.rejects(settleExplorationWithStore(receipt(), missing.store, true), /missing/);
  assert.equal(missing.entries(), 0);
});

test("partial or corrupted prior settlement fails without issuing another reward", async () => {
  const partial = storeFixture();
  await settleExplorationWithStore(receipt(), partial.store, true);
  partial.removeResult("user_b");
  await assert.rejects(settleExplorationWithStore(receipt(), partial.store, true), /Partial/);
  assert.equal(partial.balance()?.credits, 97);
  const corrupt = storeFixture();
  await settleExplorationWithStore(receipt(), corrupt.store, true);
  corrupt.corruptAward();
  await assert.rejects(settleExplorationWithStore(receipt(), corrupt.store, true), /Invalid exploration ledger/);
  assert.equal(corrupt.balance()?.credits, 97);
});

test("currency overflow cannot write any participant result", async () => {
  const fixture = storeFixture();
  fixture.setBalance(2_147_483_647);
  await assert.rejects(settleExplorationWithStore(receipt(), fixture.store, true), /overflow/);
  assert.equal(fixture.entries(), 0);
  assert.equal(fixture.balance()?.credits, 2_147_483_647);
});
