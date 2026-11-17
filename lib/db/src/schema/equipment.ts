import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const equipmentLockersTable = pgTable("equipment_lockers", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
}, table => [check("equipment_lockers_revision_check", sql`${table.revision} >= 0`)]);
export const equipmentItemsTable = pgTable("equipment_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  equipmentId: text("equipment_id").notNull(),
  sourceKey: text("source_key").notNull(),
  condition: integer("condition").notNull().default(100),
  shipId: text("ship_id"),
  hardpointId: text("hardpoint_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("equipment_items_source_uq").on(table.userId, table.sourceKey),
  uniqueIndex("equipment_items_mount_uq").on(table.userId, table.shipId, table.hardpointId),
  check("equipment_items_condition_check", sql`${table.condition} BETWEEN 0 AND 100`),
  check("equipment_mount_pair", sql`(${table.shipId} IS NULL) = (${table.hardpointId} IS NULL)`),
]);
export const insertEquipmentLockerSchema = createInsertSchema(equipmentLockersTable);
export const insertEquipmentItemSchema = createInsertSchema(equipmentItemsTable);
export type EquipmentItem = typeof equipmentItemsTable.$inferSelect;
