import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const operationInstanceStatus = pgEnum("operation_instance_status", ["active", "closed"]);
export const operationInstanceVisibility = pgEnum("operation_instance_visibility", ["public", "unlisted"]);
export const operationInstancePhase = pgEnum("operation_instance_phase", ["assembling", "ready", "active", "complete", "closed"]);
export type OperationInstancePhase = typeof operationInstancePhase.enumValues[number];

/**
 * Minimal registration/lifecycle record in the existing PostgreSQL database.
 * It is not a combat snapshot, player table, or reward ledger.
 */
export const operationInstancesTable = pgTable(
  "operation_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: text("operation_id").notNull(),
    locationId: text("location_id").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    runtimeId: text("runtime_id").notNull(),
    rulesetId: text("ruleset_id").notNull(),
    status: operationInstanceStatus("status").notNull().default("active"),
    visibility: operationInstanceVisibility("visibility").notNull().default("unlisted"),
    phase: operationInstancePhase("phase").notNull().default("active"),
    currentPlayers: integer("current_players").notNull().default(1),
    capacity: integer("capacity").notNull().default(1),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("operation_instances_owner_idempotency_uq").on(table.ownerUserId, table.idempotencyKey),
    uniqueIndex("operation_instances_one_active_owner_uq").on(table.ownerUserId).where(sql`${table.status} = 'active'`),
    index("operation_instances_public_active_idx").on(table.status, table.visibility, table.expiresAt),
    check("operation_instances_identity_nonempty", sql`length(${table.operationId}) > 0 and length(${table.locationId}) > 0 and length(${table.runtimeId}) > 0 and length(${table.rulesetId}) > 0`),
    check("operation_instances_expiry_after_registration", sql`${table.expiresAt} > ${table.registeredAt}`),
    check("operation_instances_capacity_bounds", sql`${table.capacity} between 1 and 200 and ${table.currentPlayers} between 0 and ${table.capacity}`),
  ],
);

export type OperationInstanceRecord = typeof operationInstancesTable.$inferSelect;
