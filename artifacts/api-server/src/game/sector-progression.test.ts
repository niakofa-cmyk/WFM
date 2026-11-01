import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool, playerProgressTable, playerWorldStateTable, worldDiscoveriesTable, progressionEventsTable } from "@workspace/db";
import { loadSectorProgress, settleSectorDiscovery } from "./sector-progression";
import type { CompletedSectorMission } from "./sector-completion";

after(async () => { await pool.end(); });
test("synthetic sector discoveries persist per account, pay no currency, unlock in order and are atomic/idempotent", async () => {
  const a = `test_sector_${randomUUID()}`, b = `test_sector_other_${randomUUID()}`;
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
    await settleSectorDiscovery({ ...result(), missionId: "pale-beacons" });
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
  } finally {
    for (const userId of [a, b]) for (const table of [worldDiscoveriesTable, progressionEventsTable, playerWorldStateTable, playerProgressTable]) {
      await db.delete(table).where(eq(table.userId, userId));
    }
  }
});
