import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "@workspace/db";
import { ORBITAL_RUNTIME_ID, issueEnemyEquipment, validEnemyEquipment, evaluateEnemyEquipment,
  survivingEquipment, validEnemyOutcome, newShipSubsystems } from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import { equipmentPackageForResult, salvagePackage } from "./equipment";
import { ExplorationEncounter, readExplorationReceipt } from "./exploration-encounter";
after(async () => { await pool.end(); });

test("issued AI gear is deterministic, compatible with every current hull and has stable physical identity", () => {
  for (const hull of Object.keys(SHIPS)) {
    const manifest = issueEnemyEquipment("fleet-one", `ship-${hull}`, hull);
    assert.ok(validEnemyEquipment(manifest));
    assert.deepEqual(manifest, issueEnemyEquipment("fleet-one", `ship-${hull}`, hull));
    assert.deepEqual(manifest.modules.map(m => m.equipmentId), ["autocannon", "seeker"]);
    const changed = structuredClone(manifest);
    changed.modules[0]!.instanceId = "another-physical-item";
    assert.equal(validEnemyEquipment(changed), false);
  }
  assert.throws(() => issueEnemyEquipment("fleet", "ship", "unsupported-hull"));
});
test("component survival uses only fitted equipment; unknown versions and destroyed gear cannot fall back to random loot", () => {
  const manifest = issueEnemyEquipment("fleet", "ship", "bastion");
  const systems = newShipSubsystems(100);
  systems.health.weapons = 0;
  systems.health.missiles = systems.maximum / 2;
  const outcome = evaluateEnemyEquipment("patrol-ship:ship", manifest, systems);
  assert.equal(outcome.items[0]!.status, "destroyed");
  assert.deepEqual(survivingEquipment(outcome), { equipmentId: "seeker", condition: 50 });
  const result = { patrol: { patrolId: "fleet" }, equipmentSalvage: { version: 2, actors: [outcome], legacyActorIds: [] } };
  assert.deepEqual(equipmentPackageForResult("event", outcome.actorId, result), { equipmentId: "seeker", condition: 50 });
  assert.equal(equipmentPackageForResult("event", "another-actor", result), null);
  const forged = structuredClone(outcome);
  forged.items[0]!.equipmentId = "railgun";
  assert.equal(validEnemyOutcome(forged), false);
  assert.equal(equipmentPackageForResult("event", outcome.actorId, { ...result, equipmentSalvage: { version: 3 } }), null);
  assert.equal(equipmentPackageForResult("event", outcome.actorId, { ...result, patrol: { patrolId: "wrong-fleet" } }), null);
  systems.health.missiles = 0;
  assert.equal(survivingEquipment(evaluateEnemyEquipment(outcome.actorId, manifest, systems)), null);
  assert.deepEqual(equipmentPackageForResult("event", "legacy", {}), salvagePackage("event", "legacy"));
});
test("only a dead rewardable NPC can freeze equipment evidence; checkpoint replay preserves immutable receipt provenance", () => {
  const manifest = issueEnemyEquipment("fleet", "ship", "bastion");
  const battle = new ExplorationEncounter({
    encounterId: "real-equipment-contact", missionId: "universe-patrol", sectorId: "phobos-yard",
    runtime: ORBITAL_RUNTIME_ID, authority: "server", mode: "universe-exploration",
    patrol: { patrolId: "fleet", locationId: "phobos-yard", faction: "accord" },
    actors: [{ id: "pilot", playerId: "user", faction: "ussf", hull: 100 },
      { id: "patrol-ship:ship", faction: "accord", hull: 10, rewardEligible: true, equipmentManifest: manifest }],
    rewardPolicy: { id: "test-policy", creditsPerNpcKill: 12, completionCredits: 0, maxCreditsPerEncounter: 48 },
  });
  assert.throws(() => battle.recordEnemyEquipment("patrol-ship:ship"), /Destroyed/);
  manifest.modules[0]!.equipmentId = "rotary-gun"; // Caller mutation cannot change the issued roster.
  battle.recordDamage({ eventId: "bullet", tick: 1, attackerActorId: "pilot", targetActorId: "patrol-ship:ship", hullDamage: 10 });
  assert.throws(() => battle.recordEnemyEquipment("pilot"), /Destroyed/);
  assert.throws(() => battle.finalize(1, "completed", true), /evidence missing/);
  const systems = newShipSubsystems(100); systems.health.weapons = 0;
  battle.recordEnemyEquipment("patrol-ship:ship", systems);
  const result = readExplorationReceipt(battle.finalize(1, "completed", true));
  assert.equal(result.equipmentSalvage!.actors[0]!.manifest.modules[0]!.equipmentId, "autocannon");
  assert.deepEqual(survivingEquipment(result.equipmentSalvage!.actors[0]!), { equipmentId: "seeker", condition: 100 });
  assert.ok(Object.isFrozen(result.equipmentSalvage!.actors[0]!.manifest.modules[0]));
  const snapshot = battle.snapshot();
  const replay = ExplorationEncounter.restore(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(readExplorationReceipt(replay.finalize(1, "completed", true)).fingerprint, result.fingerprint);
  snapshot.equipmentOutcomes![0]!.items[1]!.condition = 1;
  assert.throws(() => ExplorationEncounter.restore(snapshot), /equipment outcome/);
});
