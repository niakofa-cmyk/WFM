import assert from "node:assert/strict";
import test from "node:test";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { ExplorationEncounter, readExplorationReceipt } from "./exploration-encounter";
import { settleExplorationWithStore, type ExplorationLedgerRecord,
  type ExplorationRewardStore } from "./exploration-settlement";

function encounter() {
  return new ExplorationEncounter({
    encounterId: "allied-npc-contract", missionId: "universe-patrol",
    sectorId: "phobos-yard", authority: "server", mode: "universe-exploration",
    runtime: ORBITAL_RUNTIME_ID,
    patrol: { patrolId: "enemy-patrol", locationId: "phobos-yard", faction: "accord" },
    actors: [
      { id: "leader", playerId: "human-leader", faction: "ussf", hull: 100 },
      { id: "patrol-ship:first", faction: "accord", hull: 10, rewardEligible: true },
      { id: "patrol-ship:second", faction: "accord", hull: 10, rewardEligible: true },
    ],
    rewardPolicy: { id: "universe-patrol-bounty-v1", creditsPerNpcKill: 12,
      completionCredits: 0, maxCreditsPerEncounter: 48 },
  });
}
const npc = { id: "allied-escort", faction: "ussf" as const, hull: 80 };

test("an allied NPC final blow preserves human assists and all patrol casualties without NPC accounts", () => {
  const combat = encounter();
  combat.recordDamage({ eventId: "lead-hit", tick: 1, attackerActorId: "leader",
    targetActorId: "patrol-ship:first", hullDamage: 3 });
  combat.addPilot({ id: "late-wingman", playerId: "human-wingman", faction: "ussf", hull: 100 }, 2);
  assert.equal(combat.addAlliedNpc(npc, 2), true);
  assert.equal(combat.addAlliedNpc(npc, 2), false, "repeat admission cannot heal or duplicate an NPC");
  combat.recordDamage({ eventId: "wing-hit", tick: 3, attackerActorId: "late-wingman",
    targetActorId: "patrol-ship:first", hullDamage: 3 });
  combat.recordDamage({ eventId: "escort-final", tick: 4, attackerActorId: npc.id,
    targetActorId: "patrol-ship:first", hullDamage: 4 });
  combat.recordDamage({ eventId: "escort-only", tick: 5, attackerActorId: npc.id,
    targetActorId: "patrol-ship:second", hullDamage: 10 });
  const result = readExplorationReceipt(combat.finalize(6, "completed", true));
  assert.deepEqual(result.patrolDestroyedActorIds, ["patrol-ship:first", "patrol-ship:second"]);
  assert.deepEqual(result.pilots.map((pilot) => ({
    id: pilot.playerId, kills: pilot.kills, assists: pilot.assists, credits: pilot.credits,
  })), [
    { id: "human-leader", kills: 0, assists: 1, credits: 0 },
    { id: "human-wingman", kills: 0, assists: 1, credits: 0 },
  ]);
  assert.throws(() => combat.addAlliedNpc({ ...npc, id: "too-late" }, 7), /open universe patrol/);
});

test("NPC assistance cannot impersonate an account, become bounty fodder or join the enemy faction", () => {
  const combat = encounter();
  assert.throws(() => combat.addAlliedNpc({ ...npc, playerId: "invented-human" }, 1), /Invalid allied NPC/);
  assert.throws(() => combat.addAlliedNpc({ ...npc, rewardEligible: true }, 1), /Invalid allied NPC/);
  assert.throws(() => combat.addAlliedNpc({ ...npc, faction: "accord" }, 1), /Invalid allied NPC/);
  assert.throws(() => combat.addAlliedNpc({ ...npc, id: "leader" }, 1), /Conflicting allied NPC/);
  assert.throws(() => combat.addAlliedNpc({ ...npc, hull: Infinity }, 1), /Invalid allied NPC/);
  combat.addAlliedNpc(npc, 3);
  assert.throws(() => combat.addAlliedNpc({ ...npc, id: "backdated" }, 2), /Invalid allied NPC/);
});

test("allied NPC admission stays bounded independently of human seats", () => {
  const combat = encounter();
  for (let index = 0; index < 125; index++) {
    combat.addAlliedNpc({ ...npc, id: `escort-${index}` }, 1);
  }
  assert.throws(() => combat.addAlliedNpc({ ...npc, id: "overflow" }, 1), /Invalid allied NPC roster/);
  assert.equal(readExplorationReceipt(combat.finalize(2, "aborted", false)).pilots.length, 1);
});

test("AI-only kills persist enemy casualties once and never mint a human kill bounty", async () => {
  const combat = encounter();
  combat.addAlliedNpc(npc, 1);
  for (const [index, target] of ["patrol-ship:first", "patrol-ship:second"].entries()) {
    combat.recordDamage({ eventId: `escort-hit-${index}`, tick: index + 2,
      attackerActorId: npc.id, targetActorId: target, hullDamage: 10 });
  }
  const receipt = combat.finalize(4, "completed", true);
  const profiles = new Map([["human-leader", { credits: 90, revision: 0 }]]);
  const ledger = new Map<string, ExplorationLedgerRecord>();
  const applied: string[][] = [];
  const store: ExplorationRewardStore = {
    transaction: async (callback) => callback({
      lockProfiles: async (players) => {
        assert.deepEqual(players, ["human-leader"]);
        return profiles;
      },
      findResult: async (player, key) => ledger.get(`${player}:${key}`) ?? null,
      writeResult: async (player, key, result, award) => {
        profiles.set(player, { credits: award.balanceAfter, revision: award.revision });
        ledger.set(`${player}:${key}`, { version: result.version, fingerprint: result.fingerprint, award });
      },
      applyPatrolOutcome: async (_patrol, _encounter, casualties) => {
        applied.push([...casualties]);
      },
    }),
  };
  const first = await settleExplorationWithStore(receipt, store, true);
  const duplicate = await settleExplorationWithStore(receipt, store, true);
  assert.equal(first.status, "settled");
  assert.equal(duplicate.status, "duplicate");
  assert.deepEqual(applied, [["patrol-ship:first", "patrol-ship:second"]]);
  assert.equal(profiles.get("human-leader")!.credits, 90);
  assert.ok(first.awards.every((award) => award.kills === 0 && award.credits === 0));
});
