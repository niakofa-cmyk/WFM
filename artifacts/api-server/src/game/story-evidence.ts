import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, playerProgressTable, progressionEventsTable, worldDiscoveriesTable } from "@workspace/db";
import { CAMPAIGN_NARRATIVE_RECORDS, narrativeDiscoveryId } from "./campaign-narrative";

const records: ReadonlyMap<string, (typeof CAMPAIGN_NARRATIVE_RECORDS)[number]> =
  new Map(CAMPAIGN_NARRATIVE_RECORDS.map((record) => [record.id, record]));

/**
 * Persist an in-flight recovery only after the socket runtime has verified the
 * authenticated pilot's position, range, line of sight, and supported site.
 */
export async function recoverNarrativeEvidence(
  userId: string,
  evidenceId: string,
  encounterId: string,
): Promise<"recovered" | "duplicate"> {
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(userId) ||
      !/^[0-9a-f-]{36}$/i.test(encounterId)) {
    throw new Error("Invalid narrative recovery context.");
  }
  const record = records.get(evidenceId);
  if (!record) throw new Error("Unsupported narrative evidence.");

  return db.transaction(async (tx) => {
    const [profile] = await tx.select({
      userId: playerProgressTable.userId,
      credits: playerProgressTable.credits,
    }).from(playerProgressTable)
      .where(eq(playerProgressTable.userId, userId))
      .for("update");
    if (!profile) throw new Error("Narrative recovery profile is unavailable.");

    const locationId = narrativeDiscoveryId(record.id);
    const [discovery] = await tx.insert(worldDiscoveriesTable).values({
      id: randomUUID(),
      userId,
      locationId,
    }).onConflictDoNothing().returning({ locationId: worldDiscoveriesTable.locationId });
    if (!discovery) return "duplicate";

    await tx.insert(progressionEventsTable).values({
      userId,
      idempotencyKey: `narrative-evidence:${record.id}`,
      kind: "world_exploration",
      amount: 0,
      balanceBefore: profile.credits,
      balanceAfter: profile.credits,
      result: {
        action: "verified_narrative_evidence",
        version: "wfm-campaign-evidence-v1",
        evidenceId: record.id,
        missionId: record.missionId,
        collectionMode: "server-in-flight",
        encounterId,
      },
    }).onConflictDoNothing();
    return "recovered";
  });
}
