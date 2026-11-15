import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One short-lived, coarse destination lease per signed-in pilot.
 * Public consumers only receive grouped counts, never these rows.
 */
export const universePresenceTable = pgTable(
  "universe_presence",
  {
    userId: text("user_id").primaryKey(),
    locationId: text("location_id").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("universe_presence_location_expiry_idx").on(table.locationId, table.expiresAt),
    index("universe_presence_expiry_idx").on(table.expiresAt),
    check("universe_presence_location_nonempty", sql`length(${table.locationId}) > 0`),
    check("universe_presence_expiry_after_heartbeat", sql`${table.expiresAt} > ${table.lastSeenAt}`),
  ],
);

export type UniversePresenceRecord = typeof universePresenceTable.$inferSelect;
