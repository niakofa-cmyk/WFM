import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  marketGoodsTable,
  marketTransactionsTable,
  playerInventoryTable,
  playerProgressTable,
  playerQuestsTable,
  playerWorldStateTable,
  progressionEventsTable,
  pool,
  worldDiscoveriesTable,
} from "@workspace/db";
import { MarketError, getMarketSnapshot, tradeMarket } from "./market";
import {
  actOnWorldQuest,
  exploreWorldLocation,
  getWorldSnapshot,
  travelToWorldLocation,
  WorldError,
} from "./world";

after(async () => {
  await pool.end();
});

async function cleanUser(userId: string) {
  await db.delete(marketTransactionsTable).where(eq(marketTransactionsTable.userId, userId));
  await db.delete(playerInventoryTable).where(eq(playerInventoryTable.userId, userId));
  await db.delete(playerQuestsTable).where(eq(playerQuestsTable.userId, userId));
  await db.delete(worldDiscoveriesTable).where(eq(worldDiscoveriesTable.userId, userId));
  await db.delete(playerWorldStateTable).where(eq(playerWorldStateTable.userId, userId));
  await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, userId));
  await db.delete(playerProgressTable).where(eq(playerProgressTable.userId, userId));
}

test("shared market serializes competing purchases and replays trades exactly once", async () => {
  const firstUser = `test_market_${randomUUID()}`;
  const secondUser = `test_market_${randomUUID()}`;
  const seedUser = `test_market_seed_${randomUUID()}`;
  let originalSalt: typeof marketGoodsTable.$inferSelect | undefined;
  try {
    await getMarketSnapshot(seedUser);
    [originalSalt] = await db
      .select()
      .from(marketGoodsTable)
      .where(eq(marketGoodsTable.goodId, "salt"));
    assert.ok(originalSalt);
    await db
      .insert(playerProgressTable)
      .values([
        { userId: firstUser, credits: 10_000 },
        { userId: secondUser, credits: 10_000 },
      ])
      .onConflictDoNothing();
    await db
      .update(marketGoodsTable)
      .set({ stock: 10, demandScore: 0, revision: originalSalt.revision + 1 })
      .where(eq(marketGoodsTable.goodId, "salt"));

    const firstRequest = {
      idempotencyKey: randomUUID(),
      goodId: "salt" as const,
      side: "buy" as const,
      quantity: 1,
    };
    const bought = await tradeMarket(firstUser, firstRequest);
    assert.equal(bought.replayed, false);
    assert.equal(bought.market.inventory.find((item) => item.goodId === "salt")?.quantity, 1);
    const repeated = await tradeMarket(firstUser, firstRequest);
    assert.equal(repeated.replayed, true);
    assert.equal(repeated.market.credits, bought.market.credits);
    assert.equal(repeated.market.inventory.find((item) => item.goodId === "salt")?.quantity, 1);
    await assert.rejects(
      tradeMarket(firstUser, { ...firstRequest, goodId: "iron" }),
      (error: unknown) => error instanceof MarketError && error.status === 409,
    );

    const sale = await tradeMarket(firstUser, {
      idempotencyKey: randomUUID(),
      goodId: "salt",
      side: "sell",
      quantity: 1,
    });
    assert.equal(sale.market.inventory.find((item) => item.goodId === "salt")?.quantity, 0);
    assert.equal(sale.transaction.side, "sell");
    assert.equal(sale.market.transactions.length, 2);

    await db
      .update(marketGoodsTable)
      .set({ stock: 1, demandScore: 0, revision: originalSalt.revision + 10 })
      .where(eq(marketGoodsTable.goodId, "salt"));
    const race = await Promise.allSettled([
      tradeMarket(firstUser, {
        idempotencyKey: randomUUID(),
        goodId: "salt",
        side: "buy",
        quantity: 1,
      }),
      tradeMarket(secondUser, {
        idempotencyKey: randomUUID(),
        goodId: "salt",
        side: "buy",
        quantity: 1,
      }),
    ]);
    assert.equal(race.filter((item) => item.status === "fulfilled").length, 1);
    const rejected = race.find((item) => item.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.ok(rejected.reason instanceof MarketError);
    const [afterRace] = await db
      .select()
      .from(marketGoodsTable)
      .where(eq(marketGoodsTable.goodId, "salt"));
    assert.equal(afterRace.stock, 0);

    const firstView = await getMarketSnapshot(firstUser);
    const secondView = await getMarketSnapshot(secondUser);
    assert.equal(
      firstView.listings.find((item) => item.goodId === "salt")?.stock,
      secondView.listings.find((item) => item.goodId === "salt")?.stock,
    );
  } finally {
    if (originalSalt) {
      await db
        .update(marketGoodsTable)
        .set({
          basePrice: originalSalt.basePrice,
          stock: originalSalt.stock,
          targetStock: originalSalt.targetStock,
          demandScore: originalSalt.demandScore,
          revision: originalSalt.revision,
          updatedAt: originalSalt.updatedAt,
        })
        .where(eq(marketGoodsTable.goodId, "salt"));
    }
    await cleanUser(firstUser);
    await cleanUser(secondUser);
    await cleanUser(seedUser);
  }
});

test("world discoveries, quests, reputation, and global events persist server-side", async () => {
  const firstUser = `test_world_${randomUUID()}`;
  const secondUser = `test_world_${randomUUID()}`;
  try {
    const [first, second] = await Promise.all([
      getWorldSnapshot(firstUser),
      getWorldSnapshot(secondUser),
    ]);
    assert.equal(first.event.eventId, second.event.eventId);
    assert.equal(first.event.cycleDate.getTime(), second.event.cycleDate.getTime());
    assert.equal(first.currentLocation, "phobos-yard");
    assert.deepEqual(first.routes, [{ destinationId: "rust-disc", costCredits: 8, available: true }]);
    assert.equal(first.quests.find((quest) => quest.id === "rust-recording")?.status, "available");
    await assert.rejects(
      exploreWorldLocation(firstUser, "rust-disc", randomUUID()),
      (error: unknown) => error instanceof WorldError && error.status === 400,
    );
    await assert.rejects(
      travelToWorldLocation(firstUser, "pale-beacons", randomUUID()),
      (error: unknown) => error instanceof WorldError && error.status === 400,
    );

    const accepted = await actOnWorldQuest(firstUser, "rust-recording", {
      idempotencyKey: randomUUID(),
      action: "accept",
    });
    assert.equal(accepted.world.quests.find((quest) => quest.id === "rust-recording")?.status, "accepted");

    const travelKey = randomUUID();
    const travelResults = await Promise.all([
      travelToWorldLocation(firstUser, "rust-disc", travelKey),
      travelToWorldLocation(firstUser, "rust-disc", travelKey),
    ]);
    assert.deepEqual(travelResults.map((result) => result.replayed).sort(), [false, true]);
    assert.equal(travelResults[0].world.currentLocation, "rust-disc");
    assert.equal(travelResults[0].credits, 82);
    assert.equal(travelResults[0].travelCost, 8);
    assert.deepEqual(
      travelResults[0].world.routes.map((route) => [route.destinationId, route.available]),
      [["phobos-yard", true], ["pale-beacons", false]],
    );
    await assert.rejects(
      travelToWorldLocation(firstUser, "phobos-yard", travelKey),
      (error: unknown) => error instanceof WorldError && error.status === 409,
    );

    const explorationKey = randomUUID();
    const explored = await exploreWorldLocation(firstUser, "rust-disc", explorationKey);
    assert.equal(explored.newlyExplored, true);
    assert.equal(explored.reputationGain, 1);
    assert.ok(explored.world.discoveries.includes("rust-disc"));
    const exploreRetry = await exploreWorldLocation(firstUser, "rust-disc", explorationKey);
    assert.equal(exploreRetry.newlyExplored, false);
    assert.equal(exploreRetry.world.reputation.accord, 1);

    const claimKey = randomUUID();
    const claimed = await actOnWorldQuest(firstUser, "rust-recording", {
      idempotencyKey: claimKey,
      action: "claim",
    });
    assert.equal(claimed.rewardCredits, 45);
    assert.equal(claimed.credits, 127);
    assert.equal(claimed.world.reputation.accord, 3);
    assert.equal(claimed.world.quests.find((quest) => quest.id === "rust-recording")?.status, "claimed");
    const claimRetry = await actOnWorldQuest(firstUser, "rust-recording", {
      idempotencyKey: claimKey,
      action: "claim",
    });
    assert.equal(claimRetry.replayed, true);
    assert.equal(claimRetry.credits, 127);
    assert.equal(claimRetry.rewardCredits, 45);
    const secondClaim = await actOnWorldQuest(firstUser, "rust-recording", {
      idempotencyKey: randomUUID(),
      action: "claim",
    });
    assert.equal(secondClaim.rewardCredits, 0);
    assert.equal(secondClaim.credits, 127);

    const otherPlayer = await getWorldSnapshot(secondUser);
    assert.equal(otherPlayer.currentLocation, "phobos-yard");
    assert.deepEqual(otherPlayer.discoveries, []);
    assert.equal(otherPlayer.reputation.accord, 0);
  } finally {
    await cleanUser(firstUser);
    await cleanUser(secondUser);
  }
});
