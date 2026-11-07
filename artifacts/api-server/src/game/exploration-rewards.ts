import { and, asc, eq, inArray } from "drizzle-orm";
import { db, playerProgressTable, progressionEventsTable } from "@workspace/db";
import { EXPLORATION_CONTRACT, type ExplorationReceipt } from "./exploration-encounter";
import { settleExplorationWithStore, type ExplorationLedgerRecord, type ExplorationRewardStore } from "./exploration-settlement";

// Reuse the existing world-exploration ledger kind. Namespaced keys and result
// mode isolate this contract from travel/discovery and from Wing rewards.
const databaseStore: ExplorationRewardStore = {
  transaction: (callback) => db.transaction(async (tx) => {
    const locked = new Map<string, { credits: number; revision: number }>();
    return callback({
      lockProfiles: async (playerIds) => {
        if (!playerIds.length) return locked;
        const rows = await tx.select({
          userId: playerProgressTable.userId, credits: playerProgressTable.credits,
          revision: playerProgressTable.revision,
        }).from(playerProgressTable).where(inArray(playerProgressTable.userId, [...playerIds].sort()))
          .orderBy(asc(playerProgressTable.userId)).for("update");
        for (const row of rows) locked.set(row.userId, { credits: row.credits, revision: row.revision });
        return locked;
      },
      findResult: async (playerId, key) => {
        const [row] = await tx.select({ kind: progressionEventsTable.kind, result: progressionEventsTable.result })
          .from(progressionEventsTable)
          .where(and(eq(progressionEventsTable.userId, playerId), eq(progressionEventsTable.idempotencyKey, key))).limit(1);
        if (!row) return null;
        const result = row.result;
        if (row.kind !== "world_exploration" || result.mode !== EXPLORATION_CONTRACT || typeof result.fingerprint !== "string" ||
            !result.award || typeof result.award !== "object" || Array.isArray(result.award)) throw new Error("Invalid exploration ledger result.");
        const award = result.award as ExplorationLedgerRecord["award"];
        if (award.playerId !== playerId || !Number.isSafeInteger(award.balanceAfter) || !Number.isSafeInteger(award.revision)) throw new Error("Invalid exploration ledger award.");
        return { version: EXPLORATION_CONTRACT, fingerprint: result.fingerprint, award };
      },
      writeResult: async (playerId, key, result, award) => {
        const profile = locked.get(playerId);
        if (!profile || award.balanceAfter !== profile.credits + award.credits || award.revision !== profile.revision + 1) throw new Error("Exploration profile lock required.");
        const [updated] = await tx.update(playerProgressTable).set({
          credits: award.balanceAfter, revision: award.revision, updatedAt: new Date(),
        }).where(eq(playerProgressTable.userId, playerId)).returning({ userId: playerProgressTable.userId });
        if (!updated) throw new Error("Exploration profile update failed.");
        await tx.insert(progressionEventsTable).values({
          userId: playerId, idempotencyKey: key, kind: "world_exploration",
          amount: award.credits, balanceBefore: profile.credits, balanceAfter: award.balanceAfter,
          result: { mode: EXPLORATION_CONTRACT, encounterId: result.encounterId, sectorId: result.sectorId,
            runtime: result.runtime, policyId: result.policyId, rewardPolicy: result.rewardPolicy,
            finalTick: result.finalTick, outcome: result.outcome, objectiveCompleted: result.objectiveCompleted,
            fingerprint: result.fingerprint, award },
        });
        await tx.insert(progressionEventsTable).values({
          userId: playerId,
          idempotencyKey: `sector-scout-reward:${result.encounterId}`,
          kind: "world_exploration",
          amount: 0,
          balanceBefore: award.balanceAfter,
          balanceAfter: award.balanceAfter,
          result: {
            action: "server_scout_result",
            mode: "orbital-scout-result-v1",
            encounterId: result.encounterId,
            missionId: "pale-beacons",
            sectorId: result.sectorId,
            runtime: result.runtime,
            policyId: result.policyId,
            outcome: result.outcome,
            finalTick: result.finalTick,
            objectiveCompleted: result.objectiveCompleted,
            kills: award.kills,
            assists: award.assists,
            destroyedActorIds: award.destroyedActorIds,
            rewardableNpcKills: award.rewardableNpcKills,
            creditsAwarded: award.credits,
            fingerprint: result.fingerprint,
          },
        });
      },
    });
  }),
};

/** Internal authoritative-runtime integration point; disabled unless explicitly enabled. */
export function settleCompletedExploration(receipt: ExplorationReceipt, enabled = false) {
  return settleExplorationWithStore(receipt, databaseStore, enabled);
}
