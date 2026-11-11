import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { universeCampaignTable } from "./global-campaign";
export const universeCampaignParticipantsTable = pgTable("universe_campaign_participants", {
  campaignId: text("campaign_id").notNull().references(() => universeCampaignTable.id),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.campaignId,table.userId] })]);
export const insertUniverseCampaignParticipantSchema = createInsertSchema(universeCampaignParticipantsTable);
export type UniverseCampaignParticipant = typeof universeCampaignParticipantsTable.$inferSelect;
