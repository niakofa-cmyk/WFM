import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, playerProgressTable, playerWorldStateTable, progressionEventsTable, worldDiscoveriesTable } from "@workspace/db";
import { lockedPlayerRows } from "./world";
import { SECTOR_MISSIONS, sectorMission, type SectorProgress } from "./sector-missions";
import { validSectorCompletion, type CompletedSectorMission } from "./sector-completion";

const discoveryId = (id: string) => `flight:${id}`;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function progressInTransaction(tx: Transaction, userId: string): Promise<SectorProgress> {
  const rows = await tx.select({ locationId: worldDiscoveriesTable.locationId })
    .from(worldDiscoveriesTable).where(eq(worldDiscoveriesTable.userId, userId));
  return {
    completed: SECTOR_MISSIONS.filter(mission => rows.some(row => row.locationId === discoveryId(mission.id))).map(m => m.id),
    persistenceAvailable: true,
  };
}
/** A read only: users without a profile see an empty chain, not another identity. */
export async function loadSectorProgress(userId: string): Promise<SectorProgress> {
  return db.transaction(tx => progressInTransaction(tx, userId));
}
export async function settleSectorDiscovery(result: CompletedSectorMission) {
  if (!validSectorCompletion(result)) throw new Error("sector_completion_not_verified");
  return db.transaction(async tx => {
    const { profile, world } = await lockedPlayerRows(tx, result.userId);
    const mission = sectorMission(result.missionId)!;
    const progress = await progressInTransaction(tx, result.userId);
    if (progress.completed.includes(mission.id)) return { progress, replayed: true };
    if (mission.prerequisite && !progress.completed.includes(mission.prerequisite)) {
      throw new Error("sector_prerequisite_not_verified");
    }
    const key = `sector-discovery:${mission.id}`;
    const [previous] = await tx.select().from(progressionEventsTable).where(and(
      eq(progressionEventsTable.userId, result.userId),
      eq(progressionEventsTable.idempotencyKey, key),
    ));
    if (previous) throw new Error("sector_discovery_ledger_conflict");
    await tx.insert(worldDiscoveriesTable).values({
      id: randomUUID(), userId: result.userId, locationId: discoveryId(mission.id),
    });
    // Discovery and access are the launch reward; no new credit amount is invented.
    await tx.insert(progressionEventsTable).values({
      userId: result.userId, idempotencyKey: key, kind: "world_exploration",
      amount: 0, balanceBefore: profile.credits, balanceAfter: profile.credits,
      result: {
        action: "sector_mission", targetId: mission.id, mode: "cooperative-sector",
        matchId: result.matchId, rulesVersion: result.rulesVersion,
        title: `${mission.title} — discovery verified`, elapsed: result.elapsed,
        creditReward: 0, firstDiscovery: true,
      },
    });
    await tx.update(playerProgressTable).set({ revision: profile.revision + 1, updatedAt: new Date() })
      .where(eq(playerProgressTable.userId, result.userId));
    await tx.update(playerWorldStateTable).set({ revision: world.revision + 1, updatedAt: new Date() })
      .where(eq(playerWorldStateTable.userId, result.userId));
    return { progress: { ...progress, completed: [...progress.completed, mission.id] }, replayed: false };
  });
}
