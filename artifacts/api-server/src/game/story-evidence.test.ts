import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, playerProgressTable, progressionEventsTable, worldDiscoveriesTable,
} from "@workspace/db";
import { narrativeDiscoveryId } from "./campaign-narrative";
import { recoverNarrativeEvidence } from "./story-evidence";

after(async () => { await pool.end(); });

test("physical story evidence is account-scoped and idempotent", async () => {
  const firstUser = `test_story_evidence_${randomUUID()}`;
  const secondUser = `test_story_evidence_${randomUUID()}`;
  const encounterId = randomUUID();
  const rustDiscEncounterId = randomUUID();
  try {
    await db.insert(playerProgressTable).values([{ userId: firstUser }, { userId: secondUser }]);
    assert.equal(await recoverNarrativeEvidence(firstUser, "pale-beacon-record", encounterId), "recovered");
    assert.equal(await recoverNarrativeEvidence(firstUser, "pale-beacon-record", encounterId), "duplicate");
    assert.equal(await recoverNarrativeEvidence(firstUser, "rust-disc-relay-record", rustDiscEncounterId), "recovered");
    assert.equal(await recoverNarrativeEvidence(firstUser, "rust-disc-relay-record", rustDiscEncounterId), "duplicate");
    assert.equal(await recoverNarrativeEvidence(secondUser, "pale-beacon-record", encounterId), "recovered");
    await assert.rejects(recoverNarrativeEvidence(firstUser, "not-a-story-record", encounterId), /Unsupported/);

    const firstDiscoveries = await db.select().from(worldDiscoveriesTable)
      .where(eq(worldDiscoveriesTable.userId, firstUser));
    const secondDiscoveries = await db.select().from(worldDiscoveriesTable)
      .where(eq(worldDiscoveriesTable.userId, secondUser));
    assert.deepEqual(firstDiscoveries.map(item => item.locationId).sort(), [
      narrativeDiscoveryId("pale-beacon-record"),
      narrativeDiscoveryId("rust-disc-relay-record"),
    ].sort());
    assert.deepEqual(secondDiscoveries.map(item => item.locationId), [narrativeDiscoveryId("pale-beacon-record")]);

    const events = await db.select().from(progressionEventsTable)
      .where(inArray(progressionEventsTable.userId, [firstUser, secondUser]));
    assert.equal(events.length, 3, "each recovered record writes one idempotent zero-credit archive event");
    assert.ok(events.every(event => event.amount === 0 && event.balanceBefore === event.balanceAfter));
    assert.ok(events.every(event => event.result &&
      (event.result as { collectionMode?: string }).collectionMode === "server-in-flight"));
  } finally {
    await db.delete(progressionEventsTable).where(inArray(progressionEventsTable.userId, [firstUser, secondUser]));
    await db.delete(worldDiscoveriesTable).where(inArray(worldDiscoveriesTable.userId, [firstUser, secondUser]));
    await db.delete(playerProgressTable).where(inArray(playerProgressTable.userId, [firstUser, secondUser]));
  }
});
