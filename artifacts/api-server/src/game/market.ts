import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  marketGoodsTable,
  marketTransactionsTable,
  playerInventoryTable,
  playerProgressTable,
  playerWorldStateTable,
  universeEventsTable,
  type MarketGood,
  type MarketTransaction,
  type TradeGoodId,
  type UniverseEvent,
} from "@workspace/db";
import type { MarketListing, MarketSnapshot, MarketTradeInput } from "@workspace/api-zod";
import { orderUnitPrice } from "./market-pricing";
import { worldEventRules } from "./world-event-rules";
import { cargoCapacity, cargoUsed, cargoFits } from "./economy-rules";
import { recentRejections, recordRejection } from "./economy-audit";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const GOOD_INFO: Record<TradeGoodId, { name: string; basePrice: number; stock: number }> = {
  salt: { name: "Solar salt", basePrice: 40, stock: 100 },
  iron: { name: "Void iron", basePrice: 70, stock: 80 },
  dust: { name: "Relic dust", basePrice: 110, stock: 60 },
  resin: { name: "Med resin", basePrice: 55, stock: 100 },
};
const GOOD_IDS = Object.keys(GOOD_INFO) as TradeGoodId[];
const MAX_STOCK = 1000;
const MAX_CREDITS = 2_000_000_000;

const DAILY_EVENTS = [
  {
    eventId: "relay-boom",
    title: "Relay traffic surge",
    description: "Beacon crews are buying more salt and iron to keep the relay line powered.",
    marketModifiersBps: { salt: 10_500, iron: 10_500 },
  },
  {
    eventId: "dust-embargo",
    title: "Dust-lane embargo",
    description: "Convoys are avoiding the dust lane; resin and relic dust are scarce at the yard.",
    marketModifiersBps: { dust: 12_000, resin: 11_000 },
  },
  {
    eventId: "salvage-bounty",
    title: "Salvage bounty",
    description: "The yard is paying crews to move surplus metal and medical resin.",
    marketModifiersBps: { iron: 9_000, resin: 9_500 },
  },
] as const;

export class MarketError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MarketError";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function utcCycle(now = new Date()) {
  const cycleDate = now.toISOString().slice(0, 10);
  const start = new Date(`${cycleDate}T00:00:00.000Z`);
  return { cycleDate, startsAt: start, endsAt: new Date(start.getTime() + 86_400_000) };
}

export async function ensureMarketSeed(tx: DbTransaction) {
  await tx
    .insert(marketGoodsTable)
    .values(
      GOOD_IDS.map((goodId) => ({
        goodId,
        basePrice: GOOD_INFO[goodId].basePrice,
        stock: GOOD_INFO[goodId].stock,
        targetStock: GOOD_INFO[goodId].stock,
      })),
    )
    .onConflictDoNothing();
}

export async function ensureCurrentWorldEvent(tx: DbTransaction, now = new Date()): Promise<UniverseEvent> {
  await ensureMarketSeed(tx);
  const { cycleDate, startsAt, endsAt } = utcCycle(now);
  const cycleNumber = Math.floor(startsAt.getTime() / 86_400_000);
  const event = DAILY_EVENTS[((cycleNumber % DAILY_EVENTS.length) + DAILY_EVENTS.length) % DAILY_EVENTS.length];
  await tx
    .insert(universeEventsTable)
    .values({ cycleDate, ...event, startsAt, endsAt })
    .onConflictDoNothing();
  const activated = await tx.update(universeEventsTable).set({ supplyApplied: true })
    .where(and(eq(universeEventsTable.cycleDate, cycleDate), eq(universeEventsTable.supplyApplied, false))).returning();
  if (activated.length) {
    const changes = worldEventRules(event.eventId).stockDelta;
    for (const goodId of [...GOOD_IDS].sort()) {
      const delta = changes[goodId] ?? 0;
      if (!delta) continue;
      const [good] = await tx.select().from(marketGoodsTable).where(eq(marketGoodsTable.goodId, goodId)).for("update");
      if (good) await tx.update(marketGoodsTable).set({
        stock: clamp(good.stock + delta, 0, MAX_STOCK), revision: good.revision + 1, updatedAt: new Date(),
      }).where(eq(marketGoodsTable.goodId, goodId));
    }
  }
  const [stored] = await tx
    .select()
    .from(universeEventsTable)
    .where(eq(universeEventsTable.cycleDate, cycleDate));
  if (!stored) throw new Error("The current universe event could not be loaded.");
  return stored;
}

export async function migrateLegacyCargo(tx: DbTransaction, profile: typeof playerProgressTable.$inferSelect) {
  if (profile.inventoryMigrated) return profile;
  const legacyGood = profile.hold as TradeGoodId | null;
  if (legacyGood && GOOD_IDS.includes(legacyGood)) {
    const [holding] = await tx
      .select()
      .from(playerInventoryTable)
      .where(
        and(
          eq(playerInventoryTable.userId, profile.userId),
          eq(playerInventoryTable.goodId, legacyGood),
        ),
      )
      .for("update");
    if (holding) {
      await tx
        .update(playerInventoryTable)
        .set({ quantity: holding.quantity + 1, updatedAt: new Date() })
        .where(
          and(
            eq(playerInventoryTable.userId, profile.userId),
            eq(playerInventoryTable.goodId, legacyGood),
          ),
        );
    } else {
      await tx.insert(playerInventoryTable).values({
        userId: profile.userId,
        goodId: legacyGood,
        quantity: 1,
      });
    }
  }
  const [migrated] = await tx
    .update(playerProgressTable)
    .set({
      hold: null,
      paid: 0,
      inventoryMigrated: true,
      revision: profile.revision + 1,
      updatedAt: new Date(),
    })
    .where(eq(playerProgressTable.userId, profile.userId))
    .returning();
  if (!migrated) throw new Error("Legacy cargo could not be moved into the player inventory.");
  return migrated;
}

function toListing(good: MarketGood, event: UniverseEvent): MarketListing {
  const modifiers = event.marketModifiersBps ?? {};
  const modifierBps = modifiers[good.goodId as TradeGoodId] ?? 10_000;
  return {
    goodId: good.goodId as TradeGoodId,
    name: GOOD_INFO[good.goodId as TradeGoodId].name,
    basePrice: good.basePrice,
    price: orderUnitPrice(good, modifierBps, "buy", 1),
    sellPrice: orderUnitPrice(good, modifierBps, "sell", 1),
    buyTotals: Array.from({ length: 50 }, (_, i) => orderUnitPrice(good, modifierBps, "buy", i + 1) * (i + 1)),
    sellTotals: Array.from({ length: 50 }, (_, i) => orderUnitPrice(good, modifierBps, "sell", i + 1) * (i + 1)),
    purpose: {
      salt: "Beacon fuel, refinery catalyst, hyperdrive coils and material refits.",
      iron: "Refinery feedstock, structural refits and hyperdrive components.",
      dust: "Research, hyperdrive calibration and restricted contracts.",
      resin: "Medical contracts, material refits and synthesis research.",
    }[good.goodId as TradeGoodId],
    restricted: worldEventRules(event.eventId).restrictedGoods.includes(good.goodId as TradeGoodId),
    restrictionReason: worldEventRules(event.eventId).restrictedGoods.includes(good.goodId as TradeGoodId) ? "Relic dust trading is suspended during the dust-lane embargo. Crafting and authorized dispatches remain available." : null,
    stock: good.stock,
    targetStock: good.targetStock,
    demandScore: good.demandScore,
    modifierBps,
    revision: good.revision,
    updatedAt: good.updatedAt,
  };
}

export function toMarketTransaction(row: MarketTransaction) {
  return {
    id: row.id,
    goodId: row.goodId as TradeGoodId,
    side: row.side,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    total: row.total,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    inventoryBefore: row.inventoryBefore,
    inventoryAfter: row.inventoryAfter,
    stockBefore: row.stockBefore,
    stockAfter: row.stockAfter,
    marketRevision: row.marketRevision,
    createdAt: row.createdAt,
  };
}

export async function marketSnapshotInTransaction(
  tx: DbTransaction,
  userId: string,
  profile?: typeof playerProgressTable.$inferSelect,
): Promise<MarketSnapshot> {
  await ensureMarketSeed(tx);
  const event = await ensureCurrentWorldEvent(tx);
  const [player] = profile
    ? [profile]
    : await tx.select().from(playerProgressTable).where(eq(playerProgressTable.userId, userId));
  if (!player) throw new Error("Player profile could not be loaded.");
  const goods = await tx.select().from(marketGoodsTable).orderBy(marketGoodsTable.goodId);
  const holdings = await tx
    .select()
    .from(playerInventoryTable)
    .where(eq(playerInventoryTable.userId, userId));
  const transactions = await tx
    .select()
    .from(marketTransactionsTable)
    .where(eq(marketTransactionsTable.userId, userId))
    .orderBy(desc(marketTransactionsTable.createdAt))
    .limit(12);
  return {
    credits: player.credits,
    cargoUsed: cargoUsed(holdings), cargoCapacity: cargoCapacity(player),
    rejections: await recentRejections(tx, userId),
    inventory: GOOD_IDS.map((goodId) => ({
      goodId,
      quantity: holdings.find((row) => row.goodId === goodId)?.quantity ?? 0,
    })),
    listings: goods.map((row) => toListing(row, event)),
    transactions: transactions.map(toMarketTransaction),
    event: {
      eventId: event.eventId,
      title: event.title,
      description: `${event.description} ${worldEventRules(event.eventId).summary}`,
      cycleDate: new Date(`${event.cycleDate}T00:00:00.000Z`),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    },
  };
}

export async function getMarketSnapshot(userId: string): Promise<MarketSnapshot> {
  return db.transaction(async (tx) => {
    await tx.insert(playerProgressTable).values({ userId }).onConflictDoNothing();
    const [profile] = await tx
      .select()
      .from(playerProgressTable)
      .where(eq(playerProgressTable.userId, userId))
      .for("update");
    if (!profile) throw new Error("Player profile could not be loaded.");
    const migrated = await migrateLegacyCargo(tx, profile);
    return marketSnapshotInTransaction(tx, userId, migrated);
  });
}

export async function tradeMarket(userId: string, input: MarketTradeInput) {
  try { return await tradeMarketTransaction(userId, input); }
  catch (error) {
    if (error instanceof MarketError) await recordRejection(userId, input.idempotencyKey, "trade", `${input.side}:${input.goodId}`, error.message);
    throw error;
  }
}
async function tradeMarketTransaction(userId: string, input: MarketTradeInput) {
  if (!GOOD_IDS.includes(input.goodId) || !["buy", "sell"].includes(input.side)) throw new MarketError("Unknown trade good or transaction side.", 400);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) {
    throw new MarketError("Order quantities must be whole numbers from 1 to 50.", 400);
  }
  return db.transaction(async (tx) => {
    await tx.insert(playerProgressTable).values({ userId }).onConflictDoNothing();
    const [lockedProfile] = await tx
      .select()
      .from(playerProgressTable)
      .where(eq(playerProgressTable.userId, userId))
      .for("update");
    if (!lockedProfile) throw new Error("Player profile could not be loaded.");
    const profile = await migrateLegacyCargo(tx, lockedProfile);
    const [prior] = await tx
      .select()
      .from(marketTransactionsTable)
      .where(
        and(
          eq(marketTransactionsTable.userId, userId),
          eq(marketTransactionsTable.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (prior) {
      if (
        prior.side !== input.side ||
        prior.goodId !== input.goodId ||
        prior.quantity !== input.quantity
      ) {
        throw new MarketError("This request key was already used for a different trade.", 409);
      }
      return {
        market: await marketSnapshotInTransaction(tx, userId, profile),
        transaction: toMarketTransaction(prior),
        replayed: true,
      };
    }

    await tx.insert(playerWorldStateTable).values({ userId }).onConflictDoNothing();
    const [world] = await tx.select().from(playerWorldStateTable).where(eq(playerWorldStateTable.userId, userId));
    if (!world || !["phobos-yard", "outer-fringe"].includes(world.currentLocation)) {
      throw new MarketError("Travel to Phobos Yard or Outer Fringe to trade.", 400);
    }
    const standing = profile.faction === "ussf" ? world.ussfReputation : world.accordReputation;
    if (standing <= -50 || (world.currentLocation === "outer-fringe" && (standing < 10 || world.hyperdriveTier < 2))) {
      throw new MarketError("This exchange requires restored faction standing and the route's hyperdrive clearance.", 403);
    }
    await ensureMarketSeed(tx);
    const event = await ensureCurrentWorldEvent(tx);
    const [good] = await tx
      .select()
      .from(marketGoodsTable)
      .where(eq(marketGoodsTable.goodId, input.goodId))
      .for("update");
    if (!good) throw new MarketError("That good is not listed at this station.", 404);
    const [holding] = await tx
      .select()
      .from(playerInventoryTable)
      .where(
        and(
          eq(playerInventoryTable.userId, userId),
          eq(playerInventoryTable.goodId, input.goodId),
        ),
      )
      .for("update");
    const inventoryBefore = holding?.quantity ?? 0;
    const stockBefore = good.stock;
    const modifierBps = event.marketModifiersBps?.[input.goodId] ?? 10_000;
    if (worldEventRules(event.eventId).restrictedGoods.includes(input.goodId)) throw new MarketError("Relic dust trading is suspended during this world event. Crafting and authorized dispatches remain available.", 403);
    const unitPrice = orderUnitPrice(good, modifierBps, input.side, input.quantity);
    const total = unitPrice * input.quantity;
    if (input.totalLimit !== undefined && (input.side === "buy" ? total > input.totalLimit : total < input.totalLimit)) {
      throw new MarketError("The quote moved beyond your accepted total. Review the fresh price before placing another order.", 409);
    }
    let inventoryAfter = inventoryBefore;
    let stockAfter = stockBefore;
    let creditsAfter = profile.credits;
    let demandAfter = good.demandScore;

    if (input.side === "buy") {
      const contents = await tx.select().from(playerInventoryTable).where(eq(playerInventoryTable.userId, userId));
      const used = cargoUsed(contents);
      if (!cargoFits(used, used + input.quantity, cargoCapacity(profile))) throw new MarketError("Cargo hold capacity exceeded. Sell or consume goods, or install cargo expansion at Phobos.", 400);
      if (stockBefore < input.quantity) throw new MarketError("The station does not have enough stock.", 409);
      if (profile.credits < total) throw new MarketError("Not enough credits for that order.", 400);
      inventoryAfter += input.quantity;
      stockAfter -= input.quantity;
      creditsAfter -= total;
      demandAfter = clamp(demandAfter + input.quantity * 2, -100, 100);
    } else {
      if (inventoryBefore < input.quantity) throw new MarketError("You do not have enough of that good to sell.", 400);
      if (stockBefore + input.quantity > MAX_STOCK) {
        throw new MarketError("The station cannot accept that much stock right now.", 409);
      }
      inventoryAfter -= input.quantity;
      stockAfter += input.quantity;
      creditsAfter += total;
      demandAfter = clamp(demandAfter - input.quantity * 2, -100, 100);
      if (creditsAfter > MAX_CREDITS) throw new MarketError("That sale would exceed the credit balance limit.", 400);
    }

    const [updatedProfile] = await tx
      .update(playerProgressTable)
      .set({
        credits: creditsAfter,
        revision: profile.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerProgressTable.userId, userId))
      .returning();
    if (!updatedProfile) throw new Error("Player balance could not be updated.");
    if (inventoryAfter > 0) {
      await tx
        .insert(playerInventoryTable)
        .values({ userId, goodId: input.goodId, quantity: inventoryAfter })
        .onConflictDoUpdate({
          target: [playerInventoryTable.userId, playerInventoryTable.goodId],
          set: { quantity: inventoryAfter, updatedAt: new Date() },
        });
    } else if (holding) {
      await tx
        .delete(playerInventoryTable)
        .where(
          and(
            eq(playerInventoryTable.userId, userId),
            eq(playerInventoryTable.goodId, input.goodId),
          ),
        );
    }
    const [updatedGood] = await tx
      .update(marketGoodsTable)
      .set({
        stock: stockAfter,
        demandScore: demandAfter,
        revision: good.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(marketGoodsTable.goodId, input.goodId))
      .returning();
    if (!updatedGood) throw new Error("Shared market stock could not be updated.");

    const [transaction] = await tx
      .insert(marketTransactionsTable)
      .values({
        id: randomUUID(),
        userId,
        idempotencyKey: input.idempotencyKey,
        goodId: input.goodId,
        side: input.side,
        quantity: input.quantity,
        unitPrice,
        total,
        balanceBefore: profile.credits,
        balanceAfter: creditsAfter,
        inventoryBefore,
        inventoryAfter,
        stockBefore,
        stockAfter,
        marketRevision: updatedGood.revision,
      })
      .returning();
    if (!transaction) throw new Error("The market transaction was not recorded.");
    return {
      market: await marketSnapshotInTransaction(tx, userId, updatedProfile),
      transaction: toMarketTransaction(transaction),
      replayed: false,
    };
  });
}
