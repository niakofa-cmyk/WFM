import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { eq } from "drizzle-orm";
import {
  db, pool, marketGoodsTable, marketTransactionsTable, playerInventoryTable, playerProgressTable,
  playerWorldStateTable, playerQuestsTable, worldDiscoveriesTable, progressionEventsTable,
} from "@workspace/db";
import { getMarketSnapshot, tradeMarket, ensureCurrentWorldEvent, MarketError } from "./market";
import { getWorldSnapshot, travelToWorldLocation, exploreWorldLocation, WorldError } from "./world";
import { executeWorldService } from "./world-services";
import { worldEventRules } from "./world-event-rules";

after(async () => { await pool.end(); });
async function cleanup(userId: string) {
  for (const table of [marketTransactionsTable, playerInventoryTable, playerQuestsTable, worldDiscoveriesTable, progressionEventsTable, playerWorldStateTable, playerProgressTable]) {
    await db.delete(table).where(eq(table.userId, userId));
  }
}
test("salvage, material refits, hyperdrive gates, contracts and black-market consequences form a persistent server-owned loop", async () => {
  const user = `test_services_${randomUUID()}`;
  const other = `test_services_other_${randomUUID()}`;
  let original: typeof marketGoodsTable.$inferSelect[] = [];
  try {
    await getMarketSnapshot(user);
    original = await db.select().from(marketGoodsTable);
    await db.update(playerProgressTable).set({ credits: 10000, cleared: 4 }).where(eq(playerProgressTable.userId, user));
    await getWorldSnapshot(user);
    await db.update(playerWorldStateTable).set({ accordReputation: 10 }).where(eq(playerWorldStateTable.userId, user));
    let snapshot = await getWorldSnapshot(user);
    const cycleDate = snapshot.event.cycleDate.toISOString().slice(0, 10);
    const service = (serviceId: string, locationId: string, key = randomUUID()) => executeWorldService(user, { serviceId, locationId, cycleDate, idempotencyKey: key });
    await assert.rejects(travelToWorldLocation(user, "outer-fringe", randomUUID()), /Hyperdrive tier 2/);
    await travelToWorldLocation(user, "rust-disc", randomUUID());
    await assert.rejects(service("salvage", "rust-disc"), /discovery/);
    await exploreWorldLocation(user, "rust-disc", randomUUID());
    await assert.rejects(service("refine", "phobos-yard"), /Travel to this station/);
    const key = randomUUID();
    const concurrent = await Promise.all([service("salvage", "rust-disc", key), service("salvage", "rust-disc", key)]);
    assert.deepEqual(concurrent.map((result) => result.replayed).sort(), [false, true]);
    snapshot = concurrent[0].world;
    assert.equal(snapshot.inventory.find((item) => item.goodId === "iron")?.quantity, 3 + worldEventRules(snapshot.event.eventId).salvageBonus);
    await assert.rejects(service("salvage", "rust-disc"), /Completed this UTC cycle/);
    await assert.rejects(service("research", "rust-disc", key), (error: unknown) => error instanceof WorldError && error.status === 409);
    assert.deepEqual((await getWorldSnapshot(other)).inventory, []);
    await assert.rejects(tradeMarket(user, { idempotencyKey: randomUUID(), goodId: "iron", side: "buy", quantity: 1 }), /Travel to Phobos/);
    await travelToWorldLocation(user, "phobos-yard", randomUUID());
    for (const [goodId, quantity] of [["iron", 10], ["salt", 10], ["dust", 10], ["resin", 6]] as const) {
      await tradeMarket(user, { idempotencyKey: randomUUID(), goodId, side: "buy", quantity });
    }
    await service("refine", "phobos-yard");
    const refitKey = randomUUID();
    await assert.rejects(executeWorldService(user, { serviceId: "material-refit", locationId: "phobos-yard", cycleDate, idempotencyKey: randomUUID(), creditLimit: 1 }), /Service cost changed/);
    // The first response is deliberately discarded, as if it was lost after commit.
    await service("material-refit", "phobos-yard", refitKey);
    const recovered = await service("material-refit", "phobos-yard", refitKey);
    assert.equal(recovered.replayed, true);
    assert.equal(recovered.refit, 1);
    const firstDrive = await service("hyperdrive", "phobos-yard");
    assert.equal(firstDrive.world.hyperdriveTier, 2);
    assert.equal(firstDrive.world.routes.find((route) => route.destinationId === "outer-fringe")?.available, true);
    const relief = await service("relief-contract", "phobos-yard");
    assert.ok(relief.world.history.some((row) => row.title.includes("relief")));
    await assert.rejects(service("relief-contract", "phobos-yard"), /Completed this UTC cycle/);
    const secondDrive = await service("hyperdrive", "phobos-yard");
    assert.equal(secondDrive.world.hyperdriveTier, 3);
    await assert.rejects(service("hyperdrive", "phobos-yard"), /already at tier 3/);
    await travelToWorldLocation(user, "outer-fringe", randomUUID());
    await assert.rejects(travelToWorldLocation(user, "deep-nebula", randomUUID()), /50 standing/);
    await db.update(playerWorldStateTable).set({ accordReputation: 55 }).where(eq(playerWorldStateTable.userId, user));
    await travelToWorldLocation(user, "deep-nebula", randomUUID());
    const before = await getWorldSnapshot(user);
    const contraband = await service("black-market", "deep-nebula");
    assert.equal(contraband.world.reputation.accord, before.reputation.accord - 5);
    assert.equal(contraband.world.reputation.ussf, before.reputation.ussf - 5);
    assert.equal(contraband.world.currentLocation, "deep-nebula");
    assert.equal((await getWorldSnapshot(user)).hyperdriveTier, 3);
    assert.ok((await getWorldSnapshot(user)).history.length >= 6);
    await assert.rejects(executeWorldService(user, { serviceId: "research", locationId: "deep-nebula", cycleDate: "2000-01-01", idempotencyKey: randomUUID() }), /cycle changed/);
    // A faction switch/standing loss cannot strand a pilot behind an advanced gate.
    await db.update(playerWorldStateTable).set({ accordReputation: -60 }).where(eq(playerWorldStateTable.userId, user));
    await travelToWorldLocation(user, "outer-fringe", randomUUID());
    await travelToWorldLocation(user, "phobos-yard", randomUUID());
    const restitution = await service("amnesty", "phobos-yard");
    assert.equal(restitution.world.reputation.accord, -50);
  } finally {
    for (const row of original) await db.update(marketGoodsTable).set(row).where(eq(marketGoodsTable.goodId, row.goodId));
    await cleanup(user); await cleanup(other);
  }
});

test("a failed supply delivery rolls back earlier material and shared-stock updates", async () => {
  const user = `test_delivery_rollback_${randomUUID()}`;
  let original: typeof marketGoodsTable.$inferSelect[] = [];
  try {
    await getMarketSnapshot(user);
    original = await db.select().from(marketGoodsTable);
    const snapshot = await getWorldSnapshot(user);
    await db.insert(playerInventoryTable).values([{ userId: user, goodId: "resin", quantity: 1 }, { userId: user, goodId: "salt", quantity: 2 }]);
    await db.update(marketGoodsTable).set({ stock: 999 }).where(eq(marketGoodsTable.goodId, "salt"));
    const before = await getMarketSnapshot(user);
    await assert.rejects(executeWorldService(user, { serviceId: "relief-contract", locationId: "phobos-yard", cycleDate: snapshot.event.cycleDate.toISOString().slice(0, 10), idempotencyKey: randomUUID() }), /cannot accept/);
    const afterFailure = await getMarketSnapshot(user);
    assert.equal(afterFailure.credits, before.credits);
    assert.deepEqual(afterFailure.inventory, before.inventory);
    assert.deepEqual(afterFailure.listings.map((item) => [item.goodId, item.stock]), before.listings.map((item) => [item.goodId, item.stock]));
    assert.equal((await getWorldSnapshot(user)).history.length, 0);
  } finally {
    for (const row of original) await db.update(marketGoodsTable).set(row).where(eq(marketGoodsTable.goodId, row.goodId));
    await cleanup(user);
  }
});

test("shared market prevents round-trip credit creation, concurrent double debit, changed-price consent and duplicate request charges", async () => {
  const user = `test_trade_safety_${randomUUID()}`;
  let original: typeof marketGoodsTable.$inferSelect[] = [];
  try {
    await getMarketSnapshot(user);
    original = await db.select().from(marketGoodsTable);
    await db.update(playerProgressTable).set({ credits: 10000 }).where(eq(playerProgressTable.userId, user));
    await db.update(marketGoodsTable).set({ basePrice: 40, stock: 100, targetStock: 100, demandScore: 0 }).where(eq(marketGoodsTable.goodId, "salt"));
    for (let i = 0; i < 2; i++) {
      await tradeMarket(user, { idempotencyKey: randomUUID(), goodId: "salt", side: "buy", quantity: 50 });
      await tradeMarket(user, { idempotencyKey: randomUUID(), goodId: "salt", side: "sell", quantity: 50 });
    }
    assert.ok((await getMarketSnapshot(user)).credits <= 10000);
    const request = { idempotencyKey: randomUUID(), goodId: "salt" as const, side: "buy" as const, quantity: 1 };
    const duplicate = await Promise.all([tradeMarket(user, request), tradeMarket(user, request)]);
    assert.deepEqual(duplicate.map((result) => result.replayed).sort(), [false, true]);
    const beforeReject = await getMarketSnapshot(user);
    await assert.rejects(tradeMarket(user, { ...request, idempotencyKey: randomUUID(), totalLimit: 1 }), (error: unknown) => error instanceof MarketError && error.status === 409);
    assert.equal((await getMarketSnapshot(user)).credits, beforeReject.credits);
    const quote = beforeReject.listings.find((listing) => listing.goodId === "salt")!.buyTotals[0]!;
    await db.update(playerProgressTable).set({ credits: quote }).where(eq(playerProgressTable.userId, user));
    const debitRace = await Promise.allSettled([tradeMarket(user, { ...request, idempotencyKey: randomUUID() }), tradeMarket(user, { ...request, idempotencyKey: randomUUID() })]);
    assert.equal(debitRace.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await getMarketSnapshot(user)).credits, 0);
  } finally {
    for (const row of original) await db.update(marketGoodsTable).set(row).where(eq(marketGoodsTable.goodId, row.goodId));
    await cleanup(user);
  }
});

test("world event supply activation applies once and rolls back with its transaction", async () => {
  const marker = new Error("intentional fixture rollback");
  await assert.rejects(db.transaction(async (tx) => {
    const before = await tx.select().from(marketGoodsTable);
    const event = await ensureCurrentWorldEvent(tx, new Date("2099-02-17T12:00:00Z"));
    const once = await tx.select().from(marketGoodsTable);
    const changes = worldEventRules(event.eventId).stockDelta;
    for (const row of before) {
      assert.equal(once.find((item) => item.goodId === row.goodId)?.stock, Math.max(0, Math.min(1000, row.stock + (changes[row.goodId as keyof typeof changes] ?? 0))));
    }
    await ensureCurrentWorldEvent(tx, new Date("2099-02-17T23:00:00Z"));
    assert.deepEqual(await tx.select().from(marketGoodsTable), once);
    throw marker;
  }), (error: unknown) => error === marker);
});
