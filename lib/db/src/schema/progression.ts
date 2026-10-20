import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type MarketPrices = { salt: number; iron: number; dust: number; resin: number };

export const strikeRunStatus = pgEnum("strike_run_status", ["open", "claimed", "expired"]);
export const progressionEventKind = pgEnum("progression_event_kind", [
  "strike_reward",
  "market_buy",
  "market_dock",
  "refit",
  "world_exploration",
  "quest_accept",
  "quest_reward",
  "world_travel",
  "world_service",
]);

export const playerProgressTable = pgTable("player_progress", {
  userId: text("user_id").primaryKey(),
  credits: integer("credits").notNull().default(90),
  faction: text("faction").notNull().default("accord"),
  shipId: text("ship_id").notNull().default("mandjet"),
  scheme: text("scheme").notNull().default("arc"),
  refit: integer("refit").notNull().default(0),
  prices: jsonb("prices")
    .$type<MarketPrices>()
    .notNull()
    .default({ salt: 40, iron: 70, dust: 110, resin: 55 }),
  hold: text("hold"),
  paid: integer("paid").notNull().default(0),
  pace: text("pace").notNull().default("practice"),
  mission: text("mission").notNull().default("contact"),
  cleared: integer("cleared").notNull().default(0),
  tech: text("tech"),
  drilled: boolean("drilled").notNull().default(false),
  inventoryMigrated: boolean("inventory_migrated").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayerProgressSchema = createInsertSchema(playerProgressTable);
export type PlayerProgress = typeof playerProgressTable.$inferSelect;
export type InsertPlayerProgress = typeof playerProgressTable.$inferInsert;

export const strikeRunsTable = pgTable(
  "strike_runs",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    status: strikeRunStatus("status").notNull().default("open"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    replayHash: text("replay_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("strike_runs_user_status_idx").on(table.userId, table.status)],
);

export const progressionEventsTable = pgTable(
  "progression_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: progressionEventKind("kind").notNull(),
    amount: integer("amount").notNull(),
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    runId: uuid("run_id"),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("progression_events_user_key_uq").on(table.userId, table.idempotencyKey),
    uniqueIndex("progression_events_run_uq").on(table.runId),
    index("progression_events_user_created_idx").on(table.userId, table.createdAt),
  ],
);
