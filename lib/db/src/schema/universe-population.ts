import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** One locked row serializes world-wide balancing epochs across socket replicas. */
export const universePopulationStateTable = pgTable(
  "universe_population_state",
  {
    controllerId: text("controller_id").primaryKey(),
    epoch: integer("epoch").notNull().default(0),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    lastCensusAt: timestamp("last_census_at", { withTimezone: true }),
    activeUssfPilots: integer("active_ussf_pilots").notNull().default(0),
    activeAccordPilots: integer("active_accord_pilots").notNull().default(0),
    targetUssfShareBps: integer("target_ussf_share_bps").notNull().default(5_000),
    actualUssfHullCount: integer("actual_ussf_hull_count").notNull().default(0),
    actualAccordHullCount: integer("actual_accord_hull_count").notNull().default(0),
    lastAddedPatrolIds: jsonb("last_added_patrol_ids").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("universe_population_singleton", sql`${table.controllerId} = 'global'`),
    check("universe_population_epoch_nonnegative", sql`${table.epoch} >= 0`),
    check("universe_population_pilots_nonnegative", sql`${table.activeUssfPilots} >= 0 and ${table.activeAccordPilots} >= 0`),
    check("universe_population_target_range", sql`${table.targetUssfShareBps} between 0 and 10000`),
    check("universe_population_hulls_nonnegative", sql`${table.actualUssfHullCount} >= 0 and ${table.actualAccordHullCount} >= 0`),
    check("universe_population_added_ids_array", sql`jsonb_typeof(${table.lastAddedPatrolIds}) = 'array'`),
  ],
);

/** Append-only receipt of each epoch that actually created reserve fleets. */
export const universePopulationEpochsTable = pgTable(
  "universe_population_epochs",
  {
    epoch: integer("epoch").primaryKey(),
    censusCapturedAt: timestamp("census_captured_at", { withTimezone: true }).notNull(),
    activeUssfPilots: integer("active_ussf_pilots").notNull(),
    activeAccordPilots: integer("active_accord_pilots").notNull(),
    targetUssfShareBps: integer("target_ussf_share_bps").notNull(),
    ussfHullsBefore: integer("ussf_hulls_before").notNull(),
    accordHullsBefore: integer("accord_hulls_before").notNull(),
    addedFaction: text("added_faction").$type<"ussf" | "accord">().notNull(),
    addedHullCount: integer("added_hull_count").notNull(),
    patrolIds: jsonb("patrol_ids").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("universe_population_epoch_positive", sql`${table.epoch} > 0`),
    check("universe_population_epoch_pilots_nonnegative", sql`${table.activeUssfPilots} >= 0 and ${table.activeAccordPilots} >= 0`),
    check("universe_population_epoch_target_range", sql`${table.targetUssfShareBps} between 0 and 10000`),
    check("universe_population_epoch_hulls_nonnegative", sql`${table.ussfHullsBefore} >= 0 and ${table.accordHullsBefore} >= 0`),
    check("universe_population_epoch_added_faction", sql`${table.addedFaction} in ('ussf', 'accord')`),
    check("universe_population_epoch_added_hulls", sql`${table.addedHullCount} between 2 and 8`),
    check("universe_population_epoch_patrol_ids_array", sql`jsonb_typeof(${table.patrolIds}) = 'array'`),
  ],
);
