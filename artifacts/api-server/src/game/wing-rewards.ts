import { and, asc, count, eq, gte, inArray, lt } from "drizzle-orm";
import {
  db,
  playerProgressTable,
  progressionEventsTable,
} from "@workspace/db";
import {
  settleWingMatchWithStore,
  type CompletedWingMatch,
  type WingRewardStore,
} from "./wing-reward-policy";

const databaseStore: WingRewardStore = {
  transaction: (callback) =>
    db.transaction(async (tx) => {
      let lockedProfiles = new Map<
        string,
        { credits: number; revision: number }
      >();
      return callback({
        lockProfiles: async (playerIds) => {
          if (playerIds.length === 0) return new Map();
          await tx
            .insert(playerProgressTable)
            .values(playerIds.map((userId) => ({ userId })))
            .onConflictDoNothing();
          const rows = await tx
            .select({
              userId: playerProgressTable.userId,
              credits: playerProgressTable.credits,
              revision: playerProgressTable.revision,
            })
            .from(playerProgressTable)
            .where(inArray(playerProgressTable.userId, playerIds))
            .orderBy(asc(playerProgressTable.userId))
            .for("update");
          lockedProfiles = new Map(
            rows.map((row) => [
              row.userId,
              { credits: row.credits, revision: row.revision },
            ]),
          );
          return new Map(lockedProfiles);
        },
        findExistingReward: async (playerId, idempotencyKey) => {
          const [event] = await tx
            .select({
              amount: progressionEventsTable.amount,
              balanceAfter: progressionEventsTable.balanceAfter,
              result: progressionEventsTable.result,
            })
            .from(progressionEventsTable)
            .where(
              and(
                eq(progressionEventsTable.userId, playerId),
                eq(progressionEventsTable.idempotencyKey, idempotencyKey),
                eq(progressionEventsTable.kind, "wing_reward"),
              ),
            )
            .limit(1);
          if (!event) return null;
          const revision =
            typeof event.result.revision === "number" &&
            Number.isSafeInteger(event.result.revision)
              ? event.result.revision
              : lockedProfiles.get(playerId)?.revision ?? 0;
          return {
            amount: event.amount,
            balanceAfter: event.balanceAfter,
            revision,
          };
        },
        countRewardsInUtcWindow: async (playerId, start, end) => {
          const [row] = await tx
            .select({ total: count() })
            .from(progressionEventsTable)
            .where(
              and(
                eq(progressionEventsTable.userId, playerId),
                eq(progressionEventsTable.kind, "wing_reward"),
                gte(progressionEventsTable.createdAt, start),
                lt(progressionEventsTable.createdAt, end),
              ),
            );
          return Number(row?.total ?? 0);
        },
        writeReward: async (input) => {
          const current = lockedProfiles.get(input.playerId);
          if (!current) {
            throw new Error("Wing reward profile lock was not acquired.");
          }
          const [updated] = await tx
            .update(playerProgressTable)
            .set({
              credits: current.credits + input.amount,
              revision: current.revision + 1,
              updatedAt: new Date(),
            })
            .where(eq(playerProgressTable.userId, input.playerId))
            .returning({
              credits: playerProgressTable.credits,
              revision: playerProgressTable.revision,
            });
          if (!updated) throw new Error("Wing reward profile update failed.");

          await tx.insert(progressionEventsTable).values({
            userId: input.playerId,
            idempotencyKey: input.idempotencyKey,
            kind: "wing_reward",
            amount: input.amount,
            balanceBefore: current.credits,
            balanceAfter: updated.credits,
            result: {
              mode: "online-wing",
              matchId: input.matchId,
              outcome: input.outcome,
              revision: updated.revision,
            },
          });
          lockedProfiles.set(input.playerId, {
            credits: updated.credits,
            revision: updated.revision,
          });
          return {
            balanceBefore: current.credits,
            balanceAfter: updated.credits,
            revision: updated.revision,
          };
        },
      });
    }),
};

export function settleCompletedWingMatch(input: CompletedWingMatch) {
  return settleWingMatchWithStore(input, databaseStore);
}
