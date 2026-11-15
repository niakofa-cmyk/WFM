import assert from "node:assert/strict";
import test from "node:test";
import { ExplorationEncounter, readExplorationReceipt } from "./exploration-encounter";
function battle() {
  return new ExplorationEncounter({
    encounterId: "hull-recovery", missionId: "universe-patrol", sectorId: "phobos-yard",
    runtime: "orbital-v5", authority: "server", mode: "universe-exploration",
    patrol: { patrolId: "hull-patrol", locationId: "phobos-yard", faction: "accord" },
    actors: [
      { id: "pilot", playerId: "human", faction: "ussf", hull: 100 },
      { id: "enemy", faction: "accord", hull: 20, rewardEligible: true },
    ],
    rewardPolicy: { id: "hull-policy", creditsPerNpcKill: 12, completionCredits: 0, maxCreditsPerEncounter: 48 },
  });
}
test("partial damage survives checkpoint recovery and final patrol receipt reproduces exactly", () => {
  const original = battle();
  original.recordDamage({ eventId: "partial-hit", tick: 1, attackerActorId: "pilot", targetActorId: "enemy", hullDamage: 12 });
  const resumed = ExplorationEncounter.restore(original.snapshot());
  resumed.recordDamage({ eventId: "finishing-hit", tick: 2, attackerActorId: "pilot", targetActorId: "enemy", hullDamage: 8 });
  const result = readExplorationReceipt(resumed.finalize(3, "completed", true));
  assert.deepEqual(result.patrolDestroyedActorIds, ["enemy"]);
  assert.equal(result.pilots[0]!.kills, 1);
  const recovered = ExplorationEncounter.restore(resumed.snapshot());
  assert.equal(readExplorationReceipt(recovered.finalize(3, "completed", true)).fingerprint, result.fingerprint);
});
test("invalid hull checkpoints fail closed and legacy human death records retain receipt validation", () => {
  const original = battle();
  original.recordDamage({ eventId: "lethal-hit", tick: 1, attackerActorId: "pilot", targetActorId: "enemy", hullDamage: 20 });
  const result = readExplorationReceipt(original.finalize(2, "completed", true));
  const saved = original.snapshot();
  for (const actorHulls of [[["enemy", -1]], [["pilot", 101], ["enemy", 0]], [["pilot", 100], ["pilot", 100]]] as Array<Array<[string, number]>>)
    assert.throws(() => ExplorationEncounter.restore({ ...saved, actorHulls }), /checkpoint/);
  const legacy = { ...saved }; delete legacy.actorHulls;
  assert.equal(readExplorationReceipt(ExplorationEncounter.restore(legacy).finalize(2, "completed", true)).fingerprint, result.fingerprint);
  assert.throws(() => ExplorationEncounter.restore({ ...saved, resultFingerprint: "0".repeat(64) }), /fingerprint/);
});

test("AI-only hostile destruction restores the same receipt without granting a human kill", () => {
  const original = battle();
  original.addAlliedNpc({ id: "defender", faction: "ussf", hull: 100, rewardEligible: false }, 0);
  original.recordDamage({ eventId: "defender-kill", tick: 1, attackerActorId: "defender", targetActorId: "enemy", hullDamage: 20 });
  const result = readExplorationReceipt(original.finalize(2, "completed", true));
  assert.equal(result.pilots[0]!.kills, 0);
  assert.equal(result.pilots[0]!.credits, 0);
  assert.deepEqual(result.patrolDestroyedActorIds, ["enemy"]);
  const resumed = ExplorationEncounter.restore(original.snapshot());
  assert.equal(readExplorationReceipt(resumed.finalize(2, "completed", true)).fingerprint, result.fingerprint);
});
