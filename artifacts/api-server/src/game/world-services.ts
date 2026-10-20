import { and, eq } from "drizzle-orm";
import { db, marketGoodsTable, playerInventoryTable, playerProgressTable, playerWorldStateTable, progressionEventsTable, type TradeGoodId } from "@workspace/db";
import type { WorldServiceInput, WorldServiceResult } from "@workspace/api-zod";
import { findActionEvent, lockedPlayerRows, worldSnapshotInTransaction, WorldError } from "./world";
import { clampStanding } from "./world-rules";
import { migrateLegacyCargo } from "./market";

export async function executeWorldService(userId: string, input: WorldServiceInput): Promise<WorldServiceResult> {
  return db.transaction(async (tx) => {
    const locked = await lockedPlayerRows(tx, userId);
    const profile = await migrateLegacyCargo(tx, locked.profile);
    const world = locked.world;
    const target = `${input.locationId}:${input.serviceId}:${input.cycleDate}`;
    const previous = await findActionEvent(tx, userId, input.idempotencyKey, "service", target);
    if (previous) return {
      world: await worldSnapshotInTransaction(tx, userId), credits: profile.credits, refit: profile.refit,
      message: `${String(previous.result.title)} already confirmed; no additional charge or reward.`, replayed: true,
    };
    if (world.currentLocation !== input.locationId) throw new WorldError("Travel to this station before requesting its services.", 400);
    const snapshot = await worldSnapshotInTransaction(tx, userId);
    if (snapshot.event.cycleDate.toISOString().slice(0, 10) !== input.cycleDate) {
      throw new WorldError("The world cycle changed. Review the new opportunity before submitting it.", 409);
    }
    const activity = snapshot.activities.find((item) => item.id === input.serviceId);
    if (!activity) throw new WorldError("That service is not offered at this location.", 404);
    if (!activity.available) throw new WorldError(activity.reason ?? "Service unavailable.", 400);
    if (input.creditLimit !== undefined && activity.creditCost > input.creditLimit) throw new WorldError("Service cost changed. Review the current material and credit requirements.", 409);
    const credits = profile.credits - activity.creditCost + activity.rewardCredits;
    if (credits < 0 || credits > 2_000_000_000) throw new WorldError("That action exceeds the permitted credit balance.", 400);
    for (const goodId of ["dust", "iron", "resin", "salt"] as TradeGoodId[]) {
      const cost = activity.costs.find((item) => item.goodId === goodId)?.quantity ?? 0;
      const reward = activity.rewards.find((item) => item.goodId === goodId)?.quantity ?? 0;
      if (!cost && !reward) continue;
      const [held] = await tx.select().from(playerInventoryTable).where(and(eq(playerInventoryTable.userId, userId), eq(playerInventoryTable.goodId, goodId))).for("update");
      const quantity = (held?.quantity ?? 0) - cost + reward;
      if (quantity < 0 || quantity > 1_000_000) throw new WorldError("Material balance is outside permitted limits.", 400);
      await tx.insert(playerInventoryTable).values({ userId, goodId, quantity })
        .onConflictDoUpdate({ target: [playerInventoryTable.userId, playerInventoryTable.goodId], set: { quantity, updatedAt: new Date() } });
      // Supply contracts change the actual shared stock, not just a descriptive counter.
      if (input.serviceId.includes("contract") && cost > 0) {
        const [good] = await tx.select().from(marketGoodsTable).where(eq(marketGoodsTable.goodId, goodId)).for("update");
        if (!good || good.stock + cost > 1000) throw new WorldError("The exchange cannot accept more of this supply.", 409);
        await tx.update(marketGoodsTable).set({ stock: good.stock + cost, revision: good.revision + 1, updatedAt: new Date() }).where(eq(marketGoodsTable.goodId, goodId));
      }
    }
    const own = profile.faction === "ussf" ? "ussfReputation" : "accordReputation";
    const rival = own === "ussfReputation" ? "accordReputation" : "ussfReputation";
    const refit = input.serviceId === "material-refit" ? profile.refit + 1 : profile.refit;
    await tx.update(playerProgressTable).set({ credits, refit, revision: profile.revision + 1, updatedAt: new Date() }).where(eq(playerProgressTable.userId, userId));
    await tx.update(playerWorldStateTable).set({
      [own]: clampStanding(world[own] + activity.reputationDelta),
      [rival]: clampStanding(world[rival] + activity.rivalReputationDelta),
      hyperdriveTier: input.serviceId === "hyperdrive" ? world.hyperdriveTier + 1 : world.hyperdriveTier,
      revision: world.revision + 1, updatedAt: new Date(),
    }).where(eq(playerWorldStateTable.userId, userId));
    await tx.insert(progressionEventsTable).values({
      userId, idempotencyKey: input.idempotencyKey, kind: "world_service",
      amount: credits - profile.credits, balanceBefore: profile.credits, balanceAfter: credits,
      result: { action: "service", targetId: target, serviceId: input.serviceId, locationId: input.locationId, cycleDate: input.cycleDate, title: activity.title, costs: activity.costs, rewards: activity.rewards },
    });
    return { world: await worldSnapshotInTransaction(tx, userId), credits, refit, message: `${activity.title} confirmed by station ledger.`, replayed: false };
  });
}
