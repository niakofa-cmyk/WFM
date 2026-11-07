import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type PatrolFaction = "ussf" | "accord";
export type PatrolObjective = "recon" | "route-security" | "escort" | "supply-screen";
export type PatrolHullId =
  | "mandjet"
  | "shakuna"
  | "sundara"
  | "tripura"
  | "duskbreaker"
  | "sentinel"
  | "splitter"
  | "glide";

export type PersistentPatrolShip = {
  id: string;
  hullId: PatrolHullId;
  name: string;
  callsign: string;
};

/**
 * Sparse, server-owned strategic fleet state. Rows are materialized only for
 * regions around authenticated pilots; movement is advanced from timestamps,
 * not by a per-process timer.
 */
export const universePatrolsTable = pgTable(
  "universe_patrols",
  {
    patrolId: text("patrol_id").primaryKey(),
    originLocationId: text("origin_location_id").notNull(),
    currentLocationId: text("current_location_id").notNull(),
    faction: text("faction").$type<PatrolFaction>().notNull(),
    objective: text("objective").$type<PatrolObjective>().notNull(),
    callsign: text("callsign").notNull(),
    shipRoster: jsonb("ship_roster").$type<PersistentPatrolShip[]>().notNull(),
    route: jsonb("route").$type<string[]>().notNull(),
    routeIndex: integer("route_index").notNull().default(0),
    lastMovedAt: timestamp("last_moved_at", { withTimezone: true }).notNull(),
    revision: integer("revision").notNull().default(0),
    activeEncounterId: text("active_encounter_id"),
    encounterLeaseExpiresAt: timestamp("encounter_lease_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("universe_patrols_current_location_idx").on(table.currentLocationId),
    index("universe_patrols_origin_location_idx").on(table.originLocationId),
    check("universe_patrols_location_nonempty", sql`length(${table.currentLocationId}) > 0 and length(${table.originLocationId}) > 0`),
    check("universe_patrols_faction_valid", sql`${table.faction} in ('ussf', 'accord')`),
    check("universe_patrols_objective_valid", sql`${table.objective} in ('recon', 'route-security', 'escort', 'supply-screen')`),
    check("universe_patrols_route_index_nonnegative", sql`${table.routeIndex} >= 0`),
    check("universe_patrols_revision_nonnegative", sql`${table.revision} >= 0`),
    check(
      "universe_patrols_encounter_lease_pair",
      sql`(${table.activeEncounterId} is null) = (${table.encounterLeaseExpiresAt} is null)`,
    ),
    check("universe_patrols_callsign_nonempty", sql`length(${table.callsign}) > 0`),
    check("universe_patrols_roster_is_array", sql`jsonb_typeof(${table.shipRoster}) = 'array'`),
    check("universe_patrols_route_is_array", sql`jsonb_typeof(${table.route}) = 'array'`),
  ],
);

export type UniversePatrol = typeof universePatrolsTable.$inferSelect;
