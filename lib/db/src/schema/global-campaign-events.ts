import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { universeCampaignTable } from "./global-campaign";
export const universeCampaignEventsTable = pgTable("universe_campaign_events", {
  campaignId: text("campaign_id").notNull().references(() => universeCampaignTable.id),
  encounterId: text("encounter_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.campaignId,table.encounterId] })]);
export const insertUniverseCampaignEventSchema = createInsertSchema(universeCampaignEventsTable);
export type UniverseCampaignEvent = typeof universeCampaignEventsTable.$inferSelect;
