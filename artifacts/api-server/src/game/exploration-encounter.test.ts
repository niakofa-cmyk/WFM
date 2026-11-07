import assert from "node:assert/strict";
import test from "node:test";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import {
  ExplorationEncounter, readExplorationReceipt,
  type ExplorationEncounterSpec, type ExplorationReceipt,
} from "./exploration-encounter";

export function encounterSpec(encounterId = "encounter-test"): ExplorationEncounterSpec {
  return {
    encounterId, sectorId: "mars:0:0", authority: "server",
    mode: "universe-exploration", runtime: ORBITAL_RUNTIME_ID,
    // Test-only policy; no production payout policy is enabled by this fixture.
    rewardPolicy: { id: "test-policy", creditsPerNpcKill: 7, completionCredits: 3, maxCreditsPerEncounter: 9 },
    actors: [
      { id: "pilot-a", playerId: "user_a", faction: "ussf", hull: 100 },
      { id: "pilot-b", playerId: "user_b", faction: "ussf", hull: 100 },
      { id: "scout", faction: "accord", hull: 20, rewardEligible: true },
      { id: "friendly", faction: "ussf", hull: 10, rewardEligible: true },
    ],
  };
}

test("server hull transitions attribute one kill and contributing assists, with capped rewards", () => {
  const encounter = new ExplorationEncounter(encounterSpec());
  const event = { eventId: "hit-a", tick: 1, attackerActorId: "pilot-a", targetActorId: "scout", hullDamage: 5 };
  assert.equal(encounter.recordDamage(event), true);
  assert.equal(encounter.recordDamage(event), false);
  assert.throws(() => encounter.recordDamage({ ...event, hullDamage: 99 }), /Conflicting/);
  encounter.recordDamage({ ...event, eventId: "hit-b", tick: 2, attackerActorId: "pilot-b", hullDamage: 15 });
  assert.throws(() => encounter.recordDamage({ ...event, eventId: "dead-target", tick: 3 }), /actors/);
  const receipt = encounter.finalize(3, "completed", true);
  assert.equal(encounter.finalize(3, "completed", true), receipt);
  const result = readExplorationReceipt(receipt);
  assert.equal(result.pilots[0].kills, 0);
  assert.equal(result.pilots[0].assists, 1);
  assert.equal(result.pilots[1].kills, 1);
  assert.deepEqual(result.pilots[1].destroyedActorIds, ["scout"]);
  assert.equal(result.pilots[1].credits, 9);
  assert.throws(() => encounter.finalize(4, "completed", true), /Conflicting/);
  assert.throws(() => encounter.recordDamage(event), /finalized/);
  assert.throws(() => (result.pilots[1].destroyedActorIds as string[]).push("forged"));
});

test("no friendly-fire kill credits, forged receipt, unsupported authority or stale tick", () => {
  const encounter = new ExplorationEncounter(encounterSpec());
  encounter.recordDamage({ eventId: "friendly-fire", tick: 5, attackerActorId: "pilot-a", targetActorId: "friendly", hullDamage: 10 });
  assert.throws(() => encounter.recordDamage({ eventId: "stale", tick: 4, attackerActorId: "pilot-a", targetActorId: "scout", hullDamage: 10 }), /Invalid/);
  assert.throws(() => encounter.recordDamage({ eventId: "nan", tick: 6, attackerActorId: "pilot-a", targetActorId: "scout", hullDamage: NaN }), /Invalid/);
  const result = readExplorationReceipt(encounter.finalize(6, "completed", false));
  assert.equal(result.pilots[0].kills, 0);
  assert.equal(result.pilots[0].credits, 0);
  assert.throws(() => readExplorationReceipt({ encounterId: result.encounterId } as ExplorationReceipt), /Server-issued/);
  assert.throws(() => new ExplorationEncounter({ ...encounterSpec(), authority: "client" } as unknown as ExplorationEncounterSpec), /Unsupported/);
  assert.throws(() => new ExplorationEncounter({ ...encounterSpec(), runtime: "surface-v1" } as unknown as ExplorationEncounterSpec), /Unsupported/);
});

test("roster/policy snapshots are isolated and an aborted encounter cannot award", () => {
  const spec = encounterSpec();
  const encounter = new ExplorationEncounter(spec);
  spec.rewardPolicy.completionCredits = 999;
  spec.actors[0].faction = "accord";
  encounter.recordDamage({ eventId: "hit", tick: 1, attackerActorId: "pilot-a", targetActorId: "scout", hullDamage: 20 });
  const result = readExplorationReceipt(encounter.finalize(2, "aborted", false));
  assert.equal(result.pilots[0].kills, 1);
  assert.equal(result.pilots[0].credits, 0);
  const invalid = encounterSpec();
  invalid.actors = [...invalid.actors, { ...invalid.actors[0], id: "duplicate-player" }];
  assert.throws(() => new ExplorationEncounter(invalid), /Duplicate/);
});

test("replayed server events regenerate the same settlement fingerprint", () => {
  const run = (reordered = false) => {
    const spec = encounterSpec();
    if (reordered) {
      spec.actors = [...spec.actors].reverse();
      const { id, creditsPerNpcKill, completionCredits, maxCreditsPerEncounter } = spec.rewardPolicy;
      spec.rewardPolicy = { maxCreditsPerEncounter, completionCredits, creditsPerNpcKill, id };
    }
    const encounter = new ExplorationEncounter(spec);
    encounter.recordDamage({ eventId: "hit", tick: 1, attackerActorId: "pilot-a", targetActorId: "scout", hullDamage: 20 });
    return readExplorationReceipt(encounter.finalize(2, "completed", false));
  };
  assert.equal(run().fingerprint, run(true).fingerprint);
});

test("opposing player destruction is tallied but cannot use NPC kill payouts", () => {
  const spec = encounterSpec();
  spec.actors = [...spec.actors, { id: "opposing-player", faction: "accord", hull: 10, playerId: "user_c" }];
  const encounter = new ExplorationEncounter(spec);
  encounter.recordDamage({ eventId: "pvp", tick: 1, attackerActorId: "pilot-a", targetActorId: "opposing-player", hullDamage: 10 });
  const pilot = readExplorationReceipt(encounter.finalize(2, "completed", false)).pilots[0];
  assert.equal(pilot.kills, 1);
  assert.equal(pilot.rewardableNpcKills, 0);
  assert.equal(pilot.credits, 0);
});

test("a validated projectile can credit its pilot after the firing hull is destroyed", () => {
  const encounter = new ExplorationEncounter(encounterSpec());
  encounter.recordDamage({ eventId: "pilot-destroyed", tick: 1, attackerActorId: "scout", targetActorId: "pilot-a", hullDamage: 100 });
  encounter.recordDamage({ eventId: "missile-arrival", tick: 2, attackerActorId: "pilot-a", targetActorId: "scout", hullDamage: 20 });
  const result = readExplorationReceipt(encounter.finalize(3, "completed", false));
  assert.equal(result.pilots[0].kills, 1);
});
