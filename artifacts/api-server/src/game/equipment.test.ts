import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { eq } from "drizzle-orm";
import { GetEquipmentResponse } from "@workspace/api-zod";
import { db, pool, equipmentItemsTable, equipmentLockersTable, playerProgressTable, progressionEventsTable } from "@workspace/db";
import {
  EQUIPMENT_CATALOG, hullEquipmentRules, validateEquipmentFit, isEquipmentTelemetry,
  type EquippedModule,
} from "@workspace/orbital-sim";
import { fitEquipment, getEquipmentLocker, loadEquipmentFlightFit, recoverEquipment, salvageActors, salvagePackage } from "./equipment";
import { EXPLORATION_CONTRACT } from "./exploration-encounter";
import { equipmentEnabled } from "./equipment-rollout";

after(async () => { await pool.end(); });
const module = (equipmentId: string, hardpointId: string): EquippedModule =>
  ({ instanceId: equipmentId, equipmentId, hardpointId, condition: 100 });
test("staging and production do not query new equipment tables without explicit rollout", () => {
  assert.equal(equipmentEnabled({ NODE_ENV: "production" }), false);
  assert.equal(equipmentEnabled({ NODE_ENV: "development" }), true);
  assert.equal(equipmentEnabled({ NODE_ENV: "development", WFM_MODULAR_EQUIPMENT_ENABLED: "0" }), false);
  assert.equal(equipmentEnabled({ NODE_ENV: "production", WFM_MODULAR_EQUIPMENT_ENABLED: "1" }), true);
});
async function cleanup(user: string) {
  for (const table of [equipmentItemsTable, equipmentLockersTable, progressionEventsTable, playerProgressTable])
    await db.delete(table).where(eq(table.userId, user));
}
test("military equipment defines real weapon resources and protects hull size, kinds, duplicates, and power", () => {
  for (const def of EQUIPMENT_CATALOG) {
    for (const value of [def.damage, def.ammunition, def.magazine, def.roundsPerMinute, def.range,
      def.projectileVelocity, def.tracking, def.lockSeconds, def.reloadSeconds, def.heat, def.durability, def.energy])
      assert.ok(Number.isFinite(value) && value >= 0, def.id);
    assert.ok(def.ammunition >= def.magazine);
  }
  assert.equal(validateEquipmentFit("glide", [module("autocannon", "primary")]), null);
  assert.match(validateEquipmentFit("glide", [module("railgun", "primary")])!, /larger/);
  assert.match(validateEquipmentFit("bastion", [module("capital-cannon", "primary")])!, /larger/);
  assert.match(validateEquipmentFit("bastion", [module("seeker", "primary")])!, /match/);
  assert.match(validateEquipmentFit("glide", [module("emp", "special")])!, /requires/);
  assert.match(validateEquipmentFit("glide", [
    module("autocannon", "primary"), module("autocannon", "primary"),
  ])!, /unique/);
  assert.match(validateEquipmentFit("bastion", [module("sensors", "utility-1"),
    { ...module("sensors", "utility-2"), instanceId: "another-sensor" }])!, /stack/);
  assert.ok(hullEquipmentRules("bastion").hardpoints.length > hullEquipmentRules("glide").hardpoints.length);
  assert.throws(() => hullEquipmentRules("forged-capital"));
  assert.equal(isEquipmentTelemetry({ protocol: 1, primary: null, secondary: null }), true);
  assert.equal(isEquipmentTelemetry({ protocol: 1, primary: { rounds: -1 }, secondary: null }), false);
});
test("initial equipment issuance is idempotent; concurrent fits accept exactly one revision, never clone mounts", async () => {
  const user = `test_equipment_${randomUUID()}`, other = `test_equipment_other_${randomUUID()}`;
  try {
    const initial = await Promise.all(Array.from({ length: 4 }, () => getEquipmentLocker(user)));
    assert.doesNotThrow(() => GetEquipmentResponse.parse(initial[0]));
    assert.ok(initial.every(s => s.items.length === 6 && s.revision === 0));
    const locker = initial[0]!, gun = locker.items.find(item => item.equipmentId === "autocannon")!;
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => fitEquipment(user, {
      shipId: "glide", hardpointId: "primary", itemId: gun.id, expectedRevision: locker.revision,
    })));
    assert.equal(attempts.filter(attempt => attempt.status === "fulfilled").length, 1);
    let next = await getEquipmentLocker(user);
    assert.equal(next.revision, 1);
    assert.equal(next.items.filter(item => item.shipId !== null).length, 1);
    const foreign = await getEquipmentLocker(other);
    await assert.rejects(fitEquipment(other, { shipId: "glide", hardpointId: "primary", itemId: gun.id, expectedRevision: foreign.revision }), /not owned/);
    await assert.rejects(fitEquipment(user, { shipId: "bastion", hardpointId: "primary", itemId: gun.id, expectedRevision: 1 }), /Unequip/);
    const issued = await loadEquipmentFlightFit(user, "glide");
    next = await fitEquipment(user, { shipId: "glide", hardpointId: "primary", itemId: null, expectedRevision: 1 });
    next = await fitEquipment(user, { shipId: "bastion", hardpointId: "primary", itemId: gun.id, expectedRevision: next.revision });
    assert.equal(next.items.find(item => item.id === gun.id)?.shipId, "bastion");
    assert.equal(issued[0]?.hardpointId, "primary", "issued loadout is not mutated by account updates");
    assert.equal((await loadEquipmentFlightFit(user, "glide")).length, 0);
  } finally { await cleanup(user); await cleanup(other); }
});
test("invalid size, mount and resource budgets roll back without changing the locker", async () => {
  const user = `test_equipment_limits_${randomUUID()}`;
  try {
    let locker = await getEquipmentLocker(user);
    const [capital] = await db.insert(equipmentItemsTable).values({ userId: user, equipmentId: "capital-cannon", sourceKey: "test-capital" }).returning();
    await assert.rejects(fitEquipment(user, { shipId: "glide", hardpointId: "primary", itemId: capital!.id, expectedRevision: 0 }), /larger/);
    const seeker = locker.items.find(item => item.equipmentId === "seeker")!;
    await assert.rejects(fitEquipment(user, { shipId: "glide", hardpointId: "primary", itemId: seeker.id, expectedRevision: 0 }), /match/);
    const before = await getEquipmentLocker(user);
    assert.equal(before.revision, 0);
    const powerModules = [
      ["railgun", "primary"], ["seeker", "secondary"], ["plasma", "special"],
      ["hardened-decoys", "defensive"], ["shield", "utility-1"], ["ew", "utility-2"],
    ] as const;
    for (const [equipmentId, hardpointId] of powerModules) {
      const [item] = await db.insert(equipmentItemsTable).values({ userId: user, equipmentId, sourceKey: `test-${hardpointId}` }).returning();
      const action = () => fitEquipment(user, { shipId: "mandjet", hardpointId, itemId: item!.id, expectedRevision: locker.revision });
      if (hardpointId === "utility-2") await assert.rejects(action(), /power/);
      else locker = await action();
    }
    assert.equal((await getEquipmentLocker(user)).revision, locker.revision, "rejected power overload is atomic");
  } finally { await cleanup(user); }
});
test("only owned authoritative patrol kills issue salvage, concurrently and permanently idempotently", async () => {
  const user = `test_equipment_salvage_${randomUUID()}`, other = `test_equipment_salvage_other_${randomUUID()}`;
  const eventId = randomUUID(), actorId = "verified-patrol-ship";
  const result = { mode: EXPLORATION_CONTRACT, patrol: { patrolId: "verified-patrol" }, fingerprint: "verified-server-fingerprint",
    award: { playerId: user, rewardableNpcKills: 1, destroyedActorIds: [actorId] } };
  try {
    await getEquipmentLocker(user); await getEquipmentLocker(other);
    await db.insert(progressionEventsTable).values({ id: eventId, userId: user, idempotencyKey: `equipment-test:${eventId}`,
      kind: "world_exploration", amount: 0, balanceBefore: 90, balanceAfter: 90, result });
    const opportunities = (await getEquipmentLocker(user)).salvage;
    assert.equal(opportunities.length, 1);
    assert.deepEqual(salvagePackage(eventId, actorId), salvagePackage(eventId, actorId));
    await assert.rejects(recoverEquipment(other, { eventId, actorId }), /No server-verified/);
    await assert.rejects(recoverEquipment(user, { eventId, actorId: "forged-target" }), /No server-verified/);
    await Promise.all(Array.from({ length: 8 }, () => recoverEquipment(user, { eventId, actorId })));
    const locker = await getEquipmentLocker(user);
    assert.doesNotThrow(() => GetEquipmentResponse.parse(locker));
    assert.equal(locker.items.length, 7);
    assert.equal(locker.revision, 1);
    assert.equal(locker.salvage.length, 0);
    const recovered = locker.items.find(item => item.condition < 100)!;
    assert.ok(recovered.condition >= 55 && recovered.condition <= 90);
    assert.equal(recovered.shipId, null);
    assert.deepEqual(salvageActors(user, { ...result, mode: "online-wing" }), []);
    assert.deepEqual(salvageActors(other, result), []);
    assert.deepEqual(salvageActors(user, { ...result, patrol: undefined }), []);
    assert.deepEqual(salvageActors(user, { ...result, award: { ...result.award, rewardableNpcKills: 0 } }), []);
  } finally { await cleanup(user); await cleanup(other); }
});
