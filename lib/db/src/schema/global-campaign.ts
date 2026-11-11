import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const universeCampaignTable = pgTable("universe_campaign", {
  id: text("id").primaryKey(),
  completedOperations: integer("completed_operations").notNull().default(0),
  targetOperations: integer("target_operations").notNull(),
  concludedAt: timestamp("concluded_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("universe_campaign_bounds",
  sql`${table.completedOperations} >= 0 AND ${table.targetOperations} > 0 AND ${table.completedOperations} <= ${table.targetOperations}`)]);
export const insertUniverseCampaignSchema = createInsertSchema(universeCampaignTable);
export type UniverseCampaign = typeof universeCampaignTable.$inferSelect;
