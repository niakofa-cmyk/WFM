import { and, desc, eq, inArray } from "drizzle-orm";
import { db, economyRejectionsTable, playerProgressTable } from "@workspace/db";
import type { DbTransaction } from "./market";

export async function recentRejections(tx: DbTransaction, userId: string) {
  const rows = await tx.select().from(economyRejectionsTable)
    .where(eq(economyRejectionsTable.userId, userId))
    .orderBy(desc(economyRejectionsTable.createdAt), desc(economyRejectionsTable.id)).limit(8);
  return rows.map((row) => ({ id: row.id, action: row.action as "trade" | "service", targetId: row.targetId, reason: row.reason, createdAt: row.createdAt }));
}

export async function recordRejection(userId: string, key: string, action: "trade" | "service", target: string, reason: string) {
  // A rejection must survive rollback of the original mutation, so use a separate transaction.
  await db.transaction(async (tx) => {
    await tx.insert(playerProgressTable).values({ userId }).onConflictDoNothing();
    await tx.select().from(playerProgressTable).where(eq(playerProgressTable.userId, userId)).for("update");
    await tx.insert(economyRejectionsTable).values({
      userId, idempotencyKey: key, action, targetId: String(target).slice(0, 120), reason: reason.slice(0, 500),
    }).onConflictDoNothing();
    const old = await tx.select({ id: economyRejectionsTable.id }).from(economyRejectionsTable)
      .where(eq(economyRejectionsTable.userId, userId)).orderBy(desc(economyRejectionsTable.createdAt), desc(economyRejectionsTable.id)).offset(50);
    if (old.length) await tx.delete(economyRejectionsTable).where(and(eq(economyRejectionsTable.userId, userId), inArray(economyRejectionsTable.id, old.map((row) => row.id))));
  });
}
