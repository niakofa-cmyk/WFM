import { createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, equipmentItemsTable, equipmentLockersTable, progressionEventsTable, type EquipmentItem } from "@workspace/db";
import { EQUIPMENT_CATALOG, hullEquipmentRules, validateEquipmentFit, type EquippedModule } from "@workspace/orbital-sim";
import { getPlayerProfile } from "./progression";
import { SHIPS } from "./ships";
import { EXPLORATION_CONTRACT } from "./exploration-encounter";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class EquipmentError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
const STARTER = ["autocannon", "rotary-gun", "seeker", "flares", "sensors", "power"];
const salvagePool = EQUIPMENT_CATALOG.filter(item => item.id !== "capital-cannon");
export function salvagePackage(eventId: string, actorId: string) {
  const digest = createHash("sha256").update(`equipment-v1:${eventId}:${actorId}`).digest();
  return { equipmentId: salvagePool[digest.readUInt16BE(0) % salvagePool.length]!.id, condition: 55 + digest[2]! % 36 };
}
/** Stored server ledger only: client-reported kills and PvP cannot create equipment. */
export function salvageActors(userId: string, result: Record<string, unknown>): string[] {
  const award = result.award as Record<string, unknown> | undefined;
  if (result.mode !== EXPLORATION_CONTRACT || !result.patrol ||
      typeof result.fingerprint !== "string" || award?.playerId !== userId ||
      !Number.isSafeInteger(award.rewardableNpcKills) || (award.rewardableNpcKills as number) <= 0 ||
      !Array.isArray(award.destroyedActorIds) ||
      award.destroyedActorIds.length !== award.rewardableNpcKills ||
      !award.destroyedActorIds.every(id => typeof id === "string" && id.length > 0 && id.length <= 160)) return [];
  return [...new Set(award.destroyedActorIds as string[])];
}
async function locker(tx: Tx, userId: string) {
  const created = await tx.insert(equipmentLockersTable).values({ userId }).onConflictDoNothing().returning();
  const [locked] = await tx.select().from(equipmentLockersTable).where(eq(equipmentLockersTable.userId, userId)).for("update");
  if (!locked) throw new EquipmentError("Equipment locker unavailable.");
  if (created.length) await tx.insert(equipmentItemsTable).values(STARTER.map(equipmentId => ({
    userId, equipmentId, sourceKey: `issued-v1:${equipmentId}`, condition: 100,
  }))).onConflictDoNothing();
  return locked;
}
function equipped(items: readonly EquipmentItem[], shipId: string): EquippedModule[] {
  return items.filter(item => item.shipId === shipId && item.hardpointId !== null).map(item => ({
    instanceId: item.id, equipmentId: item.equipmentId, hardpointId: item.hardpointId!, condition: item.condition,
  }));
}
async function snapshot(tx: Tx, userId: string) {
  const [state] = await tx.select().from(equipmentLockersTable).where(eq(equipmentLockersTable.userId, userId));
  const items = await tx.select().from(equipmentItemsTable).where(eq(equipmentItemsTable.userId, userId)).orderBy(asc(equipmentItemsTable.createdAt), asc(equipmentItemsTable.id));
  const events = await tx.select({ id: progressionEventsTable.id, result: progressionEventsTable.result }).from(progressionEventsTable)
    .where(and(eq(progressionEventsTable.userId, userId), eq(progressionEventsTable.kind, "world_exploration"),
      sql`${progressionEventsTable.result}->>'mode' = ${EXPLORATION_CONTRACT}`))
    .orderBy(desc(progressionEventsTable.createdAt)).limit(30);
  const claimed = new Set(items.map(item => item.sourceKey));
  const salvage = events.flatMap(event => salvageActors(userId, event.result)
    .filter(actorId => !claimed.has(`${event.id}:${actorId}`))
    .map(actorId => ({ eventId: event.id, actorId, equipmentId: salvagePackage(event.id, actorId).equipmentId })));
  return { revision: state!.revision, catalog: [...EQUIPMENT_CATALOG], hulls: Object.keys(SHIPS).map(hullEquipmentRules),
    items: items.map(({ id, equipmentId, condition, shipId, hardpointId }) => ({ id, equipmentId, condition, shipId, hardpointId })), salvage };
}
export async function getEquipmentLocker(userId: string) {
  await getPlayerProfile(userId);
  return db.transaction(async tx => { await locker(tx, userId); return snapshot(tx, userId); });
}
export async function fitEquipment(userId: string, input: {
  shipId: string; hardpointId: string; itemId: string | null; expectedRevision: number;
}) {
  if (!Object.hasOwn(SHIPS, input.shipId)) throw new EquipmentError("Unknown hull.", 400);
  await getPlayerProfile(userId);
  return db.transaction(async tx => {
    const state = await locker(tx, userId);
    if (state.revision !== input.expectedRevision) throw new EquipmentError("Equipment changed in another session. Refresh and retry.");
    const hull = hullEquipmentRules(input.shipId);
    if (!hull.hardpoints.some(slot => slot.id === input.hardpointId)) throw new EquipmentError("Unknown hardpoint.", 400);
    const items = await tx.select().from(equipmentItemsTable).where(eq(equipmentItemsTable.userId, userId));
    const item = input.itemId === null ? null : items.find(row => row.id === input.itemId);
    if (input.itemId !== null && !item) throw new EquipmentError("Equipment is not owned by this pilot.");
    if (item?.shipId && (item.shipId !== input.shipId || item.hardpointId !== input.hardpointId))
      throw new EquipmentError("Unequip this physical item from its current mount before moving it.");
    const candidate = equipped(items, input.shipId).filter(row => row.hardpointId !== input.hardpointId);
    if (item) candidate.push({ instanceId: item.id, equipmentId: item.equipmentId, hardpointId: input.hardpointId, condition: item.condition });
    const reason = validateEquipmentFit(input.shipId, candidate);
    if (reason) throw new EquipmentError(reason);
    await tx.update(equipmentItemsTable).set({ shipId: null, hardpointId: null }).where(and(
      eq(equipmentItemsTable.userId, userId), eq(equipmentItemsTable.shipId, input.shipId), eq(equipmentItemsTable.hardpointId, input.hardpointId)));
    if (item) await tx.update(equipmentItemsTable).set({ shipId: input.shipId, hardpointId: input.hardpointId })
      .where(and(eq(equipmentItemsTable.id, item.id), eq(equipmentItemsTable.userId, userId)));
    await tx.update(equipmentLockersTable).set({ revision: state.revision + 1 }).where(eq(equipmentLockersTable.userId, userId));
    return snapshot(tx, userId);
  });
}
export async function recoverEquipment(userId: string, input: { eventId: string; actorId: string }) {
  await getPlayerProfile(userId);
  return db.transaction(async tx => {
    const state = await locker(tx, userId);
    const [event] = await tx.select().from(progressionEventsTable).where(and(
      eq(progressionEventsTable.id, input.eventId), eq(progressionEventsTable.userId, userId),
      eq(progressionEventsTable.kind, "world_exploration")));
    if (!event || !salvageActors(userId, event.result).includes(input.actorId))
      throw new EquipmentError("No server-verified recoverable enemy destruction belongs to this pilot.");
    const result = await tx.insert(equipmentItemsTable).values({
      userId, ...salvagePackage(event.id, input.actorId), sourceKey: `${event.id}:${input.actorId}`,
    }).onConflictDoNothing().returning({ id: equipmentItemsTable.id });
    if (result.length) await tx.update(equipmentLockersTable).set({ revision: state.revision + 1 }).where(eq(equipmentLockersTable.userId, userId));
    return snapshot(tx, userId);
  });
}
/** A new flight captures this immutable fit. Reconnect restores checkpointed equipment instead. */
export async function loadEquipmentFlightFit(userId: string, shipId: string): Promise<EquippedModule[]> {
  const items = await db.select().from(equipmentItemsTable).where(and(
    eq(equipmentItemsTable.userId, userId), eq(equipmentItemsTable.shipId, shipId)));
  const fit = equipped(items, shipId);
  const reason = validateEquipmentFit(shipId, fit);
  if (reason) throw new EquipmentError(`Stored equipment fit is invalid: ${reason}`);
  return fit;
}
