import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Private, versioned simulation checkpoints. This table is not an API surface:
 * only the authoritative socket runtime may read or write it.
 */
export const freeFlightCheckpointsTable = pgTable(
  "free_flight_checkpoints",
  {
    sessionKey: text("session_key").primaryKey(),
    stateVersion: integer("state_version").notNull(),
    fencingToken: bigint("fencing_token", { mode: "number" }).notNull(),
    checkpointSequence: bigint("checkpoint_sequence", { mode: "number" }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("free_flight_checkpoints_updated_idx").on(table.updatedAt),
    check("free_flight_checkpoints_session_key_nonempty", sql`length(${table.sessionKey}) between 2 and 128`),
    check("free_flight_checkpoints_state_version_supported", sql`${table.stateVersion} = 1`),
    check("free_flight_checkpoints_fencing_token_positive", sql`${table.fencingToken} > 0`),
    check("free_flight_checkpoints_sequence_nonnegative", sql`${table.checkpointSequence} >= 0`),
    check("free_flight_checkpoints_snapshot_object", sql`jsonb_typeof(${table.snapshot}) = 'object'`),
  ],
);

export type FreeFlightCheckpoint = typeof freeFlightCheckpointsTable.$inferSelect;
