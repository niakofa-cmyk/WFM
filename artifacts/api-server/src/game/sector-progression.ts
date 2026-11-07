import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { db, playerProgressTable, playerWorldStateTable, progressionEventsTable, worldDiscoveriesTable } from "@workspace/db";
import { lockedPlayerRows } from "./world";
import { SECTOR_MISSIONS, sectorMission, type SectorProgress, type SectorScoutResult } from "./sector-missions";
import { validSectorCompletion, type CompletedSectorMission } from "./sector-completion";

const discoveryId = (id: string) => `flight:${id}`;
function sameScoutResult(value: Record<string, unknown>, result: SectorScoutResult): boolean {
  return value.action === "server_scout_result" &&
    value.mode === "orbital-scout-result-v1" &&
    value.encounterId === result.encounterId &&
    value.missionId === result.missionId &&
    value.sectorId === result.sectorId &&
    value.runtime === result.runtime &&
    value.policyId === result.policyId &&
    value.outcome === result.outcome &&
    value.finalTick === result.finalTick &&
    value.objectiveCompleted === result.objectiveCompleted &&
    value.kills === result.kills &&
    value.assists === result.assists &&
    value.rewardableNpcKills === result.rewardableNpcKills &&
    value.creditsAwarded === result.creditsAwarded &&
    value.fingerprint === result.fingerprint &&
    Array.isArray(value.destroyedActorIds) &&
    JSON.stringify([...value.destroyedActorIds].sort()) === JSON.stringify([...result.destroyedActorIds].sort());
}
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
    if (!progress.completed.includes(mission.id) && mission.prerequisite && !progress.completed.includes(mission.prerequisite)) {
      throw new Error("sector_prerequisite_not_verified");
    }
    const alreadyCompleted = progress.completed.includes(mission.id);
    if (!alreadyCompleted) {
      await tx.insert(worldDiscoveriesTable).values({
        id: randomUUID(), userId: result.userId, locationId: discoveryId(mission.id),
      });
      // Discovery and access are the launch reward; no new credit amount is invented.
      await tx.insert(progressionEventsTable).values({
        userId: result.userId, idempotencyKey: `sector-discovery:${mission.id}`, kind: "world_exploration",
        amount: 0, balanceBefore: profile.credits, balanceAfter: profile.credits,
        result: {
          action: "sector_mission", targetId: mission.id, mode: "cooperative-sector",
          matchId: result.matchId, rulesVersion: result.rulesVersion,
          title: `${mission.title} — discovery verified`, elapsed: result.elapsed,
          creditReward: 0, firstDiscovery: true,
        },
      });
    }
    if (!alreadyCompleted) {
      await tx.update(playerProgressTable).set({ revision: profile.revision + 1, updatedAt: new Date() })
        .where(eq(playerProgressTable.userId, result.userId));
      await tx.update(playerWorldStateTable).set({ revision: world.revision + 1, updatedAt: new Date() })
        .where(eq(playerWorldStateTable.userId, result.userId));
    }
    return {
      progress: alreadyCompleted ? progress : { ...progress, completed: [...progress.completed, mission.id] },
      replayed: alreadyCompleted,
    };
  });
}

/** Save an aborted partial tally; completed encounters must use atomic reward settlement. */
export async function saveSectorScoutResults(entries: readonly { userId: string; result: SectorScoutResult }[]): Promise<void> {
  if (!entries.length || entries.length > 8) throw new Error("invalid_sector_scout_results");
  const encounterId = entries[0]!.result.encounterId;
  if (!/^[0-9a-f-]{36}$/i.test(encounterId) ||
      entries.some(({ userId, result }) => !userId || result.encounterId !== encounterId ||
        result.missionId !== "pale-beacons" || !/^[0-9a-f]{64}$/.test(result.fingerprint) ||
        result.sectorId !== "pale-beacons-v1" || result.policyId !== "pale-beacon-npc-bounty-v1" ||
        result.outcome !== "aborted" || result.objectiveCompleted !== false || result.creditsAwarded !== 0 ||
        !Number.isSafeInteger(result.finalTick) || result.finalTick < 0 ||
        !Number.isSafeInteger(result.kills) || result.kills < 0 ||
        !Number.isSafeInteger(result.assists) || result.assists < 0 ||
        !Number.isSafeInteger(result.rewardableNpcKills) || result.rewardableNpcKills < 0 ||
        result.kills !== result.destroyedActorIds.length ||
        new Set(result.destroyedActorIds).size !== result.destroyedActorIds.length ||
        result.destroyedActorIds.some((actorId) => typeof actorId !== "string" || actorId.length < 1 || actorId.length > 128))) {
    throw new Error("invalid_sector_scout_results");
  }
  const first = entries[0]!.result;
  if (entries.some(({ result }) => result.fingerprint !== first.fingerprint ||
      result.sectorId !== first.sectorId || result.runtime !== first.runtime ||
      result.policyId !== first.policyId || result.outcome !== first.outcome ||
      result.finalTick !== first.finalTick || result.objectiveCompleted !== first.objectiveCompleted)) {
    throw new Error("conflicting_sector_scout_results");
  }
  const uniqueUsers = new Set(entries.map(({ userId }) => userId));
  if (uniqueUsers.size !== entries.length) throw new Error("duplicate_sector_scout_pilot");
  await db.transaction(async (tx) => {
    const userIds = [...uniqueUsers].sort();
    const locked = await tx.select({ userId: playerProgressTable.userId })
      .from(playerProgressTable).where(inArray(playerProgressTable.userId, userIds))
      .orderBy(asc(playerProgressTable.userId)).for("update");
    const found = new Set(locked.map(({ userId }) => userId));
    if (userIds.some((id) => !found.has(id))) throw new Error("sector_scout_profile_missing");
    for (const { userId, result } of [...entries].sort((a, b) => a.userId.localeCompare(b.userId))) {
      const key = `sector-scout-result:${encounterId}`;
      const record = { action: "server_scout_result", mode: "orbital-scout-result-v1", ...result };
      const [previous] = await tx.select({ result: progressionEventsTable.result })
        .from(progressionEventsTable)
        .where(and(eq(progressionEventsTable.userId, userId), eq(progressionEventsTable.idempotencyKey, key)));
      if (previous) {
        if (!sameScoutResult(previous.result, result)) throw new Error("sector_scout_result_conflict");
        continue;
      }
      const [profile] = await tx.select({ credits: playerProgressTable.credits })
        .from(playerProgressTable).where(eq(playerProgressTable.userId, userId)).limit(1);
      if (!profile) throw new Error("sector_scout_profile_missing");
      await tx.insert(progressionEventsTable).values({
        userId, idempotencyKey: key, kind: "world_exploration",
        amount: 0, balanceBefore: profile.credits, balanceAfter: profile.credits,
        result: record,
      });
    }
  });
}

export async function getRecentSectorScoutResults(userId: string): Promise<Array<SectorScoutResult & { recordedAt: string }>> {
  const rows = await db.select({
    idempotencyKey: progressionEventsTable.idempotencyKey,
    result: progressionEventsTable.result,
    recordedAt: progressionEventsTable.createdAt,
  }).from(progressionEventsTable)
    .where(and(
      eq(progressionEventsTable.userId, userId),
      or(
        like(progressionEventsTable.idempotencyKey, "sector-scout-result:%"),
        like(progressionEventsTable.idempotencyKey, "sector-scout-reward:%"),
      ),
    ))
    .orderBy(desc(progressionEventsTable.createdAt)).limit(20);
  const byEncounter = new Map<string, SectorScoutResult & { recordedAt: string }>();
  for (const { idempotencyKey, result, recordedAt } of rows) {
    const creditsAwarded =
      result.creditsAwarded === undefined && result.policyId === "scout-result-only-v1"
        ? 0
        : result.creditsAwarded;
    if (result.mode !== "orbital-scout-result-v1" || result.action !== "server_scout_result" ||
        result.missionId !== "pale-beacons" || typeof result.encounterId !== "string" ||
        typeof result.sectorId !== "string" || typeof result.runtime !== "string" ||
        typeof result.policyId !== "string" || !["completed", "aborted"].includes(String(result.outcome)) ||
        !Number.isSafeInteger(result.finalTick) || Number(result.finalTick) < 0 ||
        typeof result.objectiveCompleted !== "boolean" ||
        !Number.isSafeInteger(result.kills) || Number(result.kills) < 0 ||
        !Number.isSafeInteger(result.assists) || Number(result.assists) < 0 ||
        !Number.isSafeInteger(result.rewardableNpcKills) || Number(result.rewardableNpcKills) < 0 ||
        !Number.isSafeInteger(creditsAwarded) || Number(creditsAwarded) < 0 ||
        !Array.isArray(result.destroyedActorIds) || result.destroyedActorIds.length > 128 ||
        result.destroyedActorIds.some((id) => typeof id !== "string" || !id || id.length > 128) ||
        Number(result.kills) !== result.destroyedActorIds.length ||
        Number(result.rewardableNpcKills) > Number(result.kills) ||
         typeof result.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(result.fingerprint) ||
         typeof result.policyId !== "string" ||
         !["scout-result-only-v1", "pale-beacon-npc-bounty-v1"].includes(result.policyId)) return [];
    const { action: _action, mode: _mode, ...safeResult } = result;
    const entry = {
      ...safeResult,
      creditsAwarded: Number(creditsAwarded),
      recordedAt: recordedAt.toISOString(),
    } as SectorScoutResult & { recordedAt: string };
    const existing = byEncounter.get(entry.encounterId);
    const isRewardRecord = idempotencyKey.startsWith("sector-scout-reward:");
    if (!existing || isRewardRecord) byEncounter.set(entry.encounterId, entry);
  }
  return [...byEncounter.values()].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)).slice(0, 10);
}
