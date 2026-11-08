import assert from "node:assert/strict";
import test from "node:test";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import {
  decideFactionContact, ExplorationEncounter, readExplorationReceipt,
  type ExplorationEncounterSpec, type ExplorationReceipt,
} from "./exploration-encounter";

const contact = (overrides: Partial<Parameters<typeof decideFactionContact>[0]> = {}) =>
  decideFactionContact({
    actorFaction: "ussf", pilotFaction: "accord", territory: "contested",
    transponder: "broadcast", distanceMeters: 1000, sensorRangeMeters: 2100,
    speedMetersPerSecond: 0, speedLimitMetersPerSecond: 60,
    lineOfSight: true, weaponsHot: false, targeting: false,
    recentHostileAction: false, warningTicks: 0, tick: 10,
    ...overrides,
  });

test("late allied pilots earn only subsequent contributions, never every participant's kills", () => {
  const battle = new ExplorationEncounter({
    encounterId: "shared-patrol-battle", missionId: "universe-patrol",
    sectorId: "phobos-yard", runtime: ORBITAL_RUNTIME_ID,
    authority: "server", mode: "universe-exploration",
    patrol: { patrolId: "shared-patrol", locationId: "phobos-yard", faction: "accord" },
    actors: [
      { id: "lead-actor", playerId: "lead-pilot", faction: "ussf", hull: 100 },
      { id: "enemy-one", faction: "accord", hull: 100, rewardEligible: true },
      { id: "enemy-two", faction: "accord", hull: 100, rewardEligible: true },
    ],
    rewardPolicy: { id: "universe-patrol-bounty-v1", creditsPerNpcKill: 12,
      completionCredits: 0, maxCreditsPerEncounter: 48 },
  });
  battle.recordDamage({ eventId: "before-assist", tick: 1, attackerActorId: "lead-actor",
    targetActorId: "enemy-one", hullDamage: 100 });
  const ally = { id: "ally-actor", playerId: "ally-pilot", faction: "ussf" as const, hull: 100 };
  assert.equal(battle.addPilot(ally, 2), true);
  assert.equal(battle.addPilot(ally, 2), false);
  assert.throws(() => battle.addPilot({ ...ally, id: "duplicate-actor" }, 2), /roster/);
  assert.throws(() => battle.addPilot({ ...ally, id: "hostile-actor", faction: "accord" }, 2), /Invalid/);
  battle.addPilot({ ...ally, id: "observer-actor", playerId: "observer-pilot" }, 2);
  battle.recordDamage({ eventId: "lead-assists", tick: 3, attackerActorId: "lead-actor",
    targetActorId: "enemy-two", hullDamage: 10 });
  battle.recordDamage({ eventId: "ally-finishes", tick: 4, attackerActorId: "ally-actor",
    targetActorId: "enemy-two", hullDamage: 90 });
  const result = readExplorationReceipt(battle.finalize(5, "completed", true));
  assert.deepEqual(result.pilots.map((p) => [p.playerId, p.kills, p.assists, p.credits]), [
    ["ally-pilot", 1, 0, 12], ["lead-pilot", 1, 1, 12], ["observer-pilot", 0, 0, 0],
  ]);
  assert.throws(() => battle.addPilot({ ...ally, id: "too-late", playerId: "late-pilot" }, 6), /open/);
});

test("USSF patrol investigates, challenges, warns, then intercepts or requests support from server state", () => {
  assert.equal(contact().action, "scan");
  assert.equal(contact({ transponder: "silent" }).action, "challenge");
  assert.equal(contact({ transponder: "silent", warningTicks: 180 }).action, "intercept");
  assert.equal(contact({ weaponsHot: true }).action, "warn");
  assert.equal(contact({ weaponsHot: true, warningTicks: 180 }).action, "intercept");
  assert.equal(contact({ territory: "ussf" }).reason, "restricted_territory");
  assert.equal(contact({ recentHostileAction: true }).action, "request_reinforcements");
  assert.equal(contact({ lineOfSight: false }).stage, "unaware");
  assert.equal(contact({ distanceMeters: 2200 }).action, "none");
});

test("Accord patrol shadows silent contacts and intercepts high-threat approaches symmetrically", () => {
  assert.equal(contact({ actorFaction: "accord", pilotFaction: "ussf" }).action, "scan");
  assert.equal(contact({
    actorFaction: "accord", pilotFaction: "ussf", transponder: "silent", distanceMeters: 1600,
  }).action, "shadow");
  assert.equal(contact({
    actorFaction: "accord", pilotFaction: "ussf", transponder: "silent", distanceMeters: 1200,
  }).action, "intercept");
  assert.equal(contact({ actorFaction: "accord", pilotFaction: "ussf", weaponsHot: true }).action, "intercept");
  assert.equal(contact({ actorFaction: "accord", pilotFaction: "ussf", targeting: true }).action, "intercept");
  assert.equal(contact({ actorFaction: "accord", pilotFaction: "ussf", speedMetersPerSecond: 45 }).action, "intercept");
  assert.equal(contact({ actorFaction: "accord", pilotFaction: "ussf", territory: "accord" }).reason, "restricted_territory");
  assert.equal(contact({ actorFaction: "accord", pilotFaction: "ussf", recentHostileAction: true }).action, "request_reinforcements");
});

test("faction contact rules reject impossible or malformed server observations", () => {
  assert.throws(() => contact({ actorFaction: "ussf", pilotFaction: "ussf" }), /Invalid/);
  assert.throws(() => contact({ speedMetersPerSecond: Number.NaN }), /Invalid/);
  assert.throws(() => contact({ transponder: "forged" as "silent" }), /Invalid/);
});

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
