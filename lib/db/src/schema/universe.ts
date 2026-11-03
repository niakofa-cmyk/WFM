import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tradeGoodIds = ["salt", "iron", "dust", "resin"] as const;
export type TradeGoodId = (typeof tradeGoodIds)[number];
export type WorldMarketModifiers = Partial<Record<TradeGoodId, number>>;

export const marketTradeSide = pgEnum("market_trade_side", ["buy", "sell"]);
export const playerQuestStatus = pgEnum("player_quest_status", ["accepted", "claimed"]);

export const marketGoodsTable = pgTable(
  "market_goods",
  {
    goodId: text("good_id").primaryKey(),
    basePrice: integer("base_price").notNull(),
    stock: integer("stock").notNull(),
    targetStock: integer("target_stock").notNull(),
    demandScore: integer("demand_score").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("market_goods_positive_price", sql`${table.basePrice} > 0`),
    check("market_goods_nonnegative_stock", sql`${table.stock} >= 0`),
    check("market_goods_positive_target", sql`${table.targetStock} > 0`),
    check("market_goods_demand_range", sql`${table.demandScore} between -100 and 100`),
  ],
);

export const playerInventoryTable = pgTable(
  "player_inventory",
  {
    userId: text("user_id").notNull(),
    goodId: text("good_id").notNull(),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.goodId] }),
    check("player_inventory_nonnegative_quantity", sql`${table.quantity} >= 0`),
  ],
);

export const marketTransactionsTable = pgTable(
  "market_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    goodId: text("good_id").notNull(),
    side: marketTradeSide("side").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    inventoryBefore: integer("inventory_before").notNull(),
    inventoryAfter: integer("inventory_after").notNull(),
    stockBefore: integer("stock_before").notNull(),
    stockAfter: integer("stock_after").notNull(),
    marketRevision: integer("market_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("market_transactions_user_key_uq").on(table.userId, table.idempotencyKey),
    index("market_transactions_user_created_idx").on(table.userId, table.createdAt),
    check("market_transactions_positive_quantity", sql`${table.quantity} > 0`),
    check("market_transactions_positive_price", sql`${table.unitPrice} > 0`),
    check("market_transactions_nonnegative_balance", sql`${table.balanceBefore} >= 0 and ${table.balanceAfter} >= 0`),
    check("market_transactions_nonnegative_stock", sql`${table.stockBefore} >= 0 and ${table.stockAfter} >= 0`),
  ],
);

export const universeEventsTable = pgTable("universe_events", {
  cycleDate: date("cycle_date", { mode: "string" }).primaryKey(),
  eventId: text("event_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  marketModifiersBps: jsonb("market_modifiers_bps")
    .$type<WorldMarketModifiers>()
    .notNull()
    .default({}),
  supplyApplied: boolean("supply_applied").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerWorldStateTable = pgTable("player_world_state", {
  userId: text("user_id").primaryKey(),
  currentLocation: text("current_location").notNull().default("phobos-yard"),
  accordReputation: integer("accord_reputation").notNull().default(0),
  ussfReputation: integer("ussf_reputation").notNull().default(0),
  hyperdriveTier: integer("hyperdrive_tier").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("world_hyperdrive_tier_range", sql`${table.hyperdriveTier} between 1 and 3`),
  check("world_accord_standing_range", sql`${table.accordReputation} between -100 and 100`),
  check("world_ussf_standing_range", sql`${table.ussfReputation} between -100 and 100`),
]);

export const worldDiscoveriesTable = pgTable(
  "world_discoveries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    locationId: text("location_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("world_discoveries_user_location_uq").on(table.userId, table.locationId),
    index("world_discoveries_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const playerQuestsTable = pgTable(
  "player_quests",
  {
    userId: text("user_id").notNull(),
    questId: text("quest_id").notNull(),
    status: playerQuestStatus("status").notNull().default("accepted"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.questId] }),
    index("player_quests_user_status_idx").on(table.userId, table.status),
  ],
);

export const insertMarketGoodSchema = createInsertSchema(marketGoodsTable);
export const insertMarketTransactionSchema = createInsertSchema(marketTransactionsTable);
export const insertUniverseEventSchema = createInsertSchema(universeEventsTable);
export type MarketGood = typeof marketGoodsTable.$inferSelect;
export type MarketTransaction = typeof marketTransactionsTable.$inferSelect;
export type UniverseEvent = typeof universeEventsTable.$inferSelect;
