import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const economyRejectionsTable = pgTable("economy_rejections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("economy_rejections_user_action_key_uq").on(table.userId, table.action, table.idempotencyKey),
]);
export const insertEconomyRejectionSchema = createInsertSchema(economyRejectionsTable);
