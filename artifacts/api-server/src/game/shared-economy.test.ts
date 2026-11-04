import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, economyRejectionsTable, marketGoodsTable, marketTransactionsTable, playerInventoryTable, playerProgressTable, playerWorldStateTable, progressionEventsTable, strikeRunsTable, universeEventsTable, worldDiscoveriesTable } from "@workspace/db";
import { getMarketSnapshot, tradeMarket } from "./market";
import { getWorldSnapshot, travelToWorldLocation } from "./world";
import { executeWorldService } from "./world-services";
import { getPlayerProfile, startPlayerStrike } from "./progression";
import { createMatch, step, type StepInput } from "./sim";
import { SHIPS } from "./ships";
import { cargoUsed } from "./economy-rules";
import { StartStrikeBody } from "@workspace/api-zod";

after(async () => { await pool.end(); });
async function fixture() {
  const user = `test_economy_${randomUUID()}`;
  await getMarketSnapshot(user);
  await db.update(playerProgressTable).set({ credits: 100000, cleared: 4 }).where(eq(playerProgressTable.userId, user));
  await db.insert(playerWorldStateTable).values({ userId: user, accordReputation: 55 }).onConflictDoNothing();
  return user;
}
async function clean(user: string) {
  for (const table of [economyRejectionsTable, marketTransactionsTable, playerInventoryTable, worldDiscoveriesTable, progressionEventsTable, strikeRunsTable, playerWorldStateTable, playerProgressTable]) await db.delete(table).where(eq(table.userId, user));
}
async function restore(rows: typeof marketGoodsTable.$inferSelect[]) {
  for (const row of rows) await db.update(marketGoodsTable).set(row).where(eq(marketGoodsTable.goodId, row.goodId));
}
async function service(user: string, serviceId: string, idempotencyKey = randomUUID()) {
  const world = await getWorldSnapshot(user);
  return executeWorldService(user, { serviceId, locationId: world.currentLocation, cycleDate: world.event.cycleDate.toISOString().slice(0, 10), idempotencyKey });
}

test("ten simultaneous same-account orders contend for one mixed-goods cargo hold without double spending", async () => {
  const user = await fixture();
  const original = await db.select().from(marketGoodsTable);
  try {
    await db.insert(playerInventoryTable).values([{ userId: user, goodId: "salt", quantity: 48 }, { userId: user, goodId: "resin", quantity: 47 }]);
    await db.update(marketGoodsTable).set({ stock: 1000, demandScore: 0 }).where(eq(marketGoodsTable.goodId, "iron"));
    const orders = Array.from({ length: 10 }, () => ({ idempotencyKey: randomUUID(), side: "buy" as const, goodId: "iron" as const, quantity: 1 }));
    const results = await Promise.allSettled(orders.map((order) => tradeMarket(user, order)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
    assert.equal(results.filter((result) => result.status === "rejected").length, 5);
    const snapshot = await getMarketSnapshot(user);
    const paid = snapshot.transactions.reduce((sum, row) => sum + row.total, 0);
    assert.equal(snapshot.cargoUsed, 100);
    assert.equal(snapshot.cargoCapacity, 100);
    assert.equal(snapshot.credits, 100000 - paid);
    assert.equal(snapshot.listings.find((good) => good.goodId === "iron")!.stock, 995);
    assert.equal(snapshot.rejections.length, 5);
    const successful = orders[results.findIndex((result) => result.status === "fulfilled")]!;
    // Discard the committed result, then recover the identical request.
    const recovered = await tradeMarket(user, successful);
    assert.equal(recovered.replayed, true);
    assert.equal(recovered.market.credits, snapshot.credits);
    assert.equal(recovered.market.cargoUsed, 100);
    assert.equal(recovered.market.transactions.length, 5);
    for (const quantity of [0, -1, 1.5, Infinity, NaN, 51]) {
      await assert.rejects(tradeMarket(user, { ...successful, idempotencyKey: randomUUID(), quantity }), /whole numbers/);
    }
  } finally { await restore(original); await clean(user); }
});

test("ten orders across two accounts conserve shared stock, personal goods and credits", async () => {
  const a = await fixture(), b = await fixture();
  const original = await db.select().from(marketGoodsTable);
  try {
    await db.update(marketGoodsTable).set({ stock: 3, demandScore: 0 }).where(eq(marketGoodsTable.goodId, "iron"));
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => tradeMarket(index % 2 ? a : b, { idempotencyKey: randomUUID(), side: "buy", goodId: "iron", quantity: 1 })));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 3);
    assert.equal(results.filter((result) => result.status === "rejected").length, 7);
    const left = await getMarketSnapshot(a), right = await getMarketSnapshot(b);
    assert.equal(left.cargoUsed + right.cargoUsed, 3);
    assert.equal(left.listings.find((good) => good.goodId === "iron")!.stock, 0);
    assert.deepEqual(left.listings, right.listings);
    const trades = [...left.transactions, ...right.transactions];
    assert.equal(trades.length, 3);
    assert.equal(left.credits + right.credits, 200000 - trades.reduce((sum, row) => sum + row.total, 0));
    assert.equal(left.rejections.length + right.rejections.length, 7);
    assert.equal(left.rejections.some((row) => right.rejections.some((other) => other.id === row.id)), false);
  } finally { await restore(original); await clean(a); await clean(b); }
});

test("specialist upgrades install atomically once, persist and affect real cargo, fares and stored combat configuration", async () => {
  const user = await fixture();
  try {
    await db.insert(playerInventoryTable).values([{ userId: user, goodId: "iron", quantity: 40 }, { userId: user, goodId: "dust", quantity: 10 }, { userId: user, goodId: "salt", quantity: 10 }]);
    await assert.rejects(service(user, "drive-efficiency"), /Hyperdrive tier 2/);
    const key = randomUUID();
    const installed = await service(user, "cargo-expansion", key);
    assert.equal(installed.credits, 97500);
    assert.equal(installed.world.cargoCapacity, 150);
    assert.equal(installed.world.cargoUsed, 40);
    const replayed = await service(user, "cargo-expansion", key);
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.credits, installed.credits);
    await assert.rejects(service(user, "cargo-expansion"), /Already installed/);
    const shields = await Promise.allSettled([service(user, "shield-mk2"), service(user, "shield-mk2")]);
    assert.equal(shields.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await getPlayerProfile(user)).shieldMk2, true);
    await db.update(playerWorldStateTable).set({ hyperdriveTier: 2 }).where(eq(playerWorldStateTable.userId, user));
    const before = await getWorldSnapshot(user);
    const result = await service(user, "drive-efficiency");
    assert.equal(result.credits, 95500);
    assert.deepEqual(result.world.installedUpgrades.sort(), ["cargo-expansion", "drive-efficiency", "shield-mk2"]);
    const fare = result.world.routes.find((route) => route.destinationId === "rust-disc")!.costCredits;
    assert.equal(fare, Math.ceil(before.routes.find((route) => route.destinationId === "rust-disc")!.costCredits * .75));
    const travelled = await travelToWorldLocation(user, "rust-disc", randomUUID(), fare);
    assert.equal(travelled.credits, result.credits - fare);
    const start = { shipId: "mandjet" as const, faction: "accord" as const, scheme: "arc" as const, pace: "practice" as const, mission: "contact" as const, tech: null };
    assert.equal(StartStrikeBody.strict().safeParse({ ...start, shieldMk2: true }).success, false);
    const run = await startPlayerStrike(user, start);
    assert.equal(run.config.shieldMk2, true);
    const persisted = await getWorldSnapshot(user);
    assert.equal(persisted.installedUpgrades.length, 3);
  } finally { await clean(user); }
});

test("cargo rewards cannot bypass capacity and legacy over-capacity cargo is preserved with safe exits", async () => {
  const user = await fixture();
  try {
    await db.insert(playerInventoryTable).values([{ userId: user, goodId: "iron", quantity: 98 }, { userId: user, goodId: "salt", quantity: 1 }, { userId: user, goodId: "dust", quantity: 1 }]);
    await db.update(playerWorldStateTable).set({ currentLocation: "rust-disc" }).where(eq(playerWorldStateTable.userId, user));
    await db.insert(worldDiscoveriesTable).values({ id: randomUUID(), userId: user, locationId: "rust-disc" });
    const key = randomUUID();
    await assert.rejects(service(user, "salvage", key), /Cargo hold capacity/);
    assert.equal((await getWorldSnapshot(user)).cargoUsed, 100);
    await db.update(playerWorldStateTable).set({ currentLocation: "phobos-yard" }).where(eq(playerWorldStateTable.userId, user));
    const refined = await service(user, "refine");
    assert.equal(refined.world.cargoUsed, 98);
    await db.update(playerInventoryTable).set({ quantity: 151 }).where(eq(playerInventoryTable.userId, user)); // Deliberately model a legacy over-capacity save.
    const legacy = await getMarketSnapshot(user);
    assert.equal(legacy.cargoUsed, 453);
    await assert.rejects(tradeMarket(user, { idempotencyKey: randomUUID(), goodId: "iron", side: "buy", quantity: 1 }), /Cargo hold capacity/);
    const expanded = await service(user, "cargo-expansion");
    assert.equal(expanded.world.cargoCapacity, 150);
    assert.equal(expanded.world.cargoUsed, 433);
    // Refining/selling still reduces legacy cargo rather than deleting or resetting it.
    await service(user, "refine");
    assert.equal((await getWorldSnapshot(user)).cargoUsed, 431);
  } finally { await clean(user); }
});

test("event restrictions reject both directions, reset with the event and never invalidate prior committed receipts", async () => {
  const user = await fixture();
  const original = await db.select().from(marketGoodsTable);
  const world = await getWorldSnapshot(user);
  const cycle = world.event.cycleDate.toISOString().slice(0, 10);
  const [oldEvent] = await db.select().from(universeEventsTable).where(eq(universeEventsTable.cycleDate, cycle));
  try {
    await db.update(universeEventsTable).set({ eventId: "relay-boom", marketModifiersBps: {}, supplyApplied: true }).where(eq(universeEventsTable.cycleDate, cycle));
    const order = { idempotencyKey: randomUUID(), goodId: "dust" as const, side: "buy" as const, quantity: 1 };
    const bought = await tradeMarket(user, order);
    await db.update(universeEventsTable).set({ eventId: "dust-embargo" }).where(eq(universeEventsTable.cycleDate, cycle));
    const restricted = await getMarketSnapshot(user);
    assert.equal(restricted.listings.find((item) => item.goodId === "dust")!.restricted, true);
    for (const side of ["buy", "sell"] as const) await assert.rejects(tradeMarket(user, { ...order, side, idempotencyKey: randomUUID() }), /suspended/);
    const receipt = await tradeMarket(user, order);
    assert.equal(receipt.replayed, true);
    assert.equal(receipt.market.credits, bought.market.credits);
    await db.update(universeEventsTable).set({ eventId: "relay-boom" }).where(eq(universeEventsTable.cycleDate, cycle));
    assert.equal((await getMarketSnapshot(user)).listings.find((item) => item.goodId === "dust")!.restricted, false);
  } finally {
    if (oldEvent) await db.update(universeEventsTable).set(oldEvent).where(eq(universeEventsTable.cycleDate, cycle));
    await restore(original); await clean(user);
  }
});

test("rejections survive rollback, deduplicate and retain at most fifty entries per account", async () => {
  const user = await fixture();
  try {
    const key = randomUUID();
    for (let index = 0; index < 3; index++) await assert.rejects(tradeMarket(user, { idempotencyKey: key, goodId: "iron", side: "buy", quantity: 0 }));
    assert.equal((await db.select().from(economyRejectionsTable).where(eq(economyRejectionsTable.userId, user))).length, 1);
    for (let index = 0; index < 52; index++) await assert.rejects(tradeMarket(user, { idempotencyKey: randomUUID(), goodId: "iron", side: "buy", quantity: 0 }));
    assert.equal((await db.select().from(economyRejectionsTable).where(eq(economyRejectionsTable.userId, user))).length, 50);
    assert.equal((await getMarketSnapshot(user)).credits, 100000);
    assert.equal(cargoUsed((await getMarketSnapshot(user)).inventory), 0);
  } finally { await clean(user); }
});

test("solo shield upgrade scales all eight ship roles and persists through power allocation", () => {
  const idle: StepInput = { throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null };
  for (const id of Object.keys(SHIPS) as (keyof typeof SHIPS)[]) {
    const faction = SHIPS[id].faction;
    const base = createMatch(id, faction, 0, "practice", { seed: 731 });
    const server = createMatch(id, faction, 0, "practice", { seed: 731, shieldMk2: true });
    assert.equal(server.player.baseShield, base.player.baseShield * 1.25);
    assert.equal(server.player.hullMax, base.player.hullMax);
    for (let tick = 0; tick < 60; tick++) { step(server, idle, 1 / 60); step(base, idle, 1 / 60); }
    assert.equal(server.player.shieldMax, base.player.shieldMax * 1.25);
    assert.equal(server.player.baseShield, base.player.baseShield * 1.25);
  }
});
