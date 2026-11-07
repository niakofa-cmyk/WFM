import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, playerProgressTable, playerWorldStateTable, worldDiscoveriesTable, progressionEventsTable } from "@workspace/db";
import { getRecentSectorScoutResults, loadSectorProgress, saveSectorScoutResults, settleSectorDiscovery } from "./sector-progression";
import type { CompletedSectorMission } from "./sector-completion";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";

after(async () => { await pool.end(); });
test("synthetic sector discoveries persist per account, pay no currency, unlock in order and are atomic/idempotent", async () => {
  const a = `test_sector_${randomUUID()}`, b = `test_sector_other_${randomUUID()}`, c = `test_iron_eclipse_${randomUUID()}`;
  const result = (userId = a): CompletedSectorMission => ({
    matchId: randomUUID(), userId, missionId: "rust-disc", rulesVersion: 1,
    status: "completed", elapsed: 40, activeTicks: 1000, acceptedInputs: 100,
    discoveries: 1, droneHull: 0, stage: "complete", connectedAtEnd: true,
  });
  try {
    assert.deepEqual((await loadSectorProgress(a)).completed, []);
    await assert.rejects(settleSectorDiscovery({ ...result(), missionId: "mars-approach" }), /prerequisite/);
    assert.deepEqual(await db.select().from(playerProgressTable).where(eq(playerProgressTable.userId, a)), []);
    await assert.rejects(settleSectorDiscovery({ ...result(), connectedAtEnd: false }), /not_verified/);
    const first = result();
    const pair = await Promise.all([settleSectorDiscovery(first), settleSectorDiscovery(first)]);
    assert.deepEqual(pair.map(p => p.replayed).sort(), [false, true]);
    assert.deepEqual((await loadSectorProgress(a)).completed, ["rust-disc"]);
    assert.deepEqual((await loadSectorProgress(b)).completed, []);
    const replay = await settleSectorDiscovery(result());
    assert.equal(replay.replayed, true);
    let events = await db.select().from(progressionEventsTable).where(eq(progressionEventsTable.userId, a));
    assert.equal(events.length, 1);
    assert.equal(events[0]!.amount, 0);
    assert.equal(events[0]!.balanceAfter, events[0]!.balanceBefore);
    await settleSectorDiscovery({ ...result(), missionId: "mars-approach" });
    const pale = result();
    await settleSectorDiscovery({
      ...pale, missionId: "pale-beacons",
      scoutResult: {
        encounterId: pale.matchId, missionId: "pale-beacons", sectorId: "pale-beacons-v1",
        runtime: ORBITAL_RUNTIME_ID, policyId: "scout-result-only-v1",
        outcome: "completed", finalTick: 2000, objectiveCompleted: true,
        kills: 1, assists: 0, destroyedActorIds: ["scout-pale-beacons"],
        rewardableNpcKills: 1, fingerprint: "c".repeat(64),
      },
    });
    assert.deepEqual((await loadSectorProgress(a)).completed, ["rust-disc", "mars-approach", "pale-beacons"]);
    const [profile] = await db.select().from(playerProgressTable).where(eq(playerProgressTable.userId, a));
    assert.equal(profile!.credits, 90);
    assert.equal(profile!.cleared, 0, "flight side missions do not clear unrelated Contact/Beacon/Warden/Cage sorties");
    events = await db.select().from(progressionEventsTable).where(and(
      eq(progressionEventsTable.userId, a), eq(progressionEventsTable.kind, "world_exploration"),
    ));
    assert.equal(events.length, 3);
    assert.ok(events.every(event => event.amount === event.balanceAfter - event.balanceBefore));
    assert.equal((await loadSectorProgress(a)).persistenceAvailable, true);
    const iron = await settleSectorDiscovery({ ...result(c), missionId: "iron-eclipse" });
    assert.equal(iron.replayed, false, "Iron Eclipse is a standalone operation, not a campaign prerequisite");
    assert.deepEqual((await loadSectorProgress(c)).completed, ["iron-eclipse"]);
    const [ironProfile] = await db.select().from(playerProgressTable).where(eq(playerProgressTable.userId, c));
    assert.equal(ironProfile!.credits, 90);
    const ironEvents = await db.select().from(progressionEventsTable).where(eq(progressionEventsTable.userId, c));
    assert.equal(ironEvents.length, 1);
    assert.equal(ironEvents[0]!.amount, 0);
    assert.equal(ironEvents[0]!.balanceAfter, ironEvents[0]!.balanceBefore);
  } finally {
    for (const userId of [a, b, c]) for (const table of [worldDiscoveriesTable, progressionEventsTable, playerWorldStateTable, playerProgressTable]) {
      await db.delete(table).where(eq(table.userId, userId));
    }
  }
});

test("server scout results persist privately and idempotently without changing pilot credits or revisions", async () => {
  const a = `test_scout_${randomUUID()}`, b = `test_scout_other_${randomUUID()}`;
  const encounterId = randomUUID();
  const scoutResult = {
    encounterId, missionId: "pale-beacons" as const, sectorId: "pale-beacons-v1",
    runtime: ORBITAL_RUNTIME_ID, policyId: "scout-result-only-v1",
    outcome: "completed" as const, finalTick: 601, objectiveCompleted: true,
    kills: 1, assists: 0, destroyedActorIds: ["scout-pale-beacons"],
    rewardableNpcKills: 1, fingerprint: "a".repeat(64),
  };
  try {
    await db.insert(playerProgressTable).values([{ userId: a }, { userId: b }]);
    const [before] = await db.select({
      credits: playerProgressTable.credits, revision: playerProgressTable.revision,
    }).from(playerProgressTable).where(eq(playerProgressTable.userId, a));
    await saveSectorScoutResults([{ userId: a, result: scoutResult }]);
    await saveSectorScoutResults([{ userId: a, result: scoutResult }]);
    const mine = await getRecentSectorScoutResults(a);
    assert.equal(mine.length, 1);
    assert.equal(mine[0]!.kills, 1);
    assert.equal(mine[0]!.fingerprint, scoutResult.fingerprint);
    assert.ok(Number.isFinite(Date.parse(mine[0]!.recordedAt)));
    assert.deepEqual(await getRecentSectorScoutResults(b), []);
    const [after] = await db.select({
      credits: playerProgressTable.credits, revision: playerProgressTable.revision,
    }).from(playerProgressTable).where(eq(playerProgressTable.userId, a));
    assert.deepEqual(after, before, "a results-only write must not mutate the economy or profile revision");
    await assert.rejects(saveSectorScoutResults([{
      userId: a, result: { ...scoutResult, fingerprint: "b".repeat(64) },
    }]), /conflict/);
  } finally {
    await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, a));
    await db.delete(playerProgressTable).where(inArray(playerProgressTable.userId, [a, b]));
  }
});
