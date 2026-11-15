import assert from "node:assert/strict";
import test from "node:test";
import { newFlight, type EquippedModule, type SpatialCraft } from "@workspace/orbital-sim";
import { canFireEquipment, consumeEquipmentShot, equipmentWeaponsState, modularMissile,
  modularMissileDamage, modularPrimary, stepEquipmentWeapons, validEquipmentWeapons, type ModularPilot } from "./modular-weapons";

const fit = (equipmentId: string, hardpointId: string): EquippedModule =>
  ({ instanceId: equipmentId, equipmentId, hardpointId, condition: 100 });
function pilot(equipment: EquippedModule[]): ModularPilot {
  return { shipId: "mandjet", equipment, equipmentWeapons: equipmentWeaponsState(equipment),
    craft: { alive: true, root: 0, space: newFlight(0) } as SpatialCraft };
}
test("modular primary fire uses condition, energy, finite rounds, heat and a bounded reload", () => {
  const actor = pilot([fit("railgun", "primary"), fit("plasma", "special")]);
  const resource = actor.equipmentWeapons!.primary!;
  assert.equal(resource.rounds, 12); assert.equal(resource.reserve, 108);
  assert.equal(modularPrimary(actor).speed, 260);
  assert.equal(modularPrimary(actor).interval, 1);
  assert.ok(Math.abs(modularPrimary(actor).damage - 28.8) < 1e-10);
  let fired = 0;
  while (canFireEquipment(actor, "primary")) { consumeEquipmentShot(actor, "primary"); fired++; }
  assert.equal(fired, 5);
  assert.equal(resource.heat, 100);
  assert.equal(resource.rounds, 7);
  assert.equal(actor.craft.space!.energy, 60);
  stepEquipmentWeapons(actor, 4);
  assert.equal(resource.overheated, false);
  actor.craft.space!.energy = 0;
  assert.equal(canFireEquipment(actor, "primary"), false);
  actor.craft.space!.energy = 100;
  resource.rounds = 0;
  stepEquipmentWeapons(actor, .1);
  assert.equal(resource.reload, 4);
  assert.equal(canFireEquipment(actor, "primary"), false);
  const checkpoint = structuredClone(actor);
  assert.equal(validEquipmentWeapons(checkpoint.equipment!, checkpoint.equipmentWeapons), true);
  stepEquipmentWeapons(checkpoint, 4);
  assert.equal(checkpoint.equipmentWeapons!.primary!.rounds, 12);
  assert.equal(checkpoint.equipmentWeapons!.primary!.reserve, 96);
  assert.equal(resource.rounds, 0, "recovered state cannot mutate its saved predecessor");
  const damaged = pilot([{ ...fit("railgun", "primary"), condition: 60 }]);
  assert.ok(modularPrimary(damaged).damage < modularPrimary(pilot([fit("railgun", "primary")])).damage);
});
test("missile packages define guidance, acquisition, reload, and special-warhead damage", () => {
  const actor = pilot([fit("seeker", "secondary"), fit("sensors", "utility-1")]);
  const missile = modularMissile(actor);
  assert.equal(missile.maxLockRange, 200);
  assert.equal(missile.lockSeconds, .8);
  assert.equal(missile.launchSpeed, 48);
  assert.equal(missile.turnRateRadiansPerSecond, 3.4);
  assert.equal(modularMissileDamage(actor), 52);
  consumeEquipmentShot(actor, "secondary"); consumeEquipmentShot(actor, "secondary");
  assert.equal(canFireEquipment(actor, "secondary"), false);
  stepEquipmentWeapons(actor, .1); stepEquipmentWeapons(actor, 5);
  assert.equal(actor.equipmentWeapons!.secondary!.rounds, 2);
  assert.equal(actor.equipmentWeapons!.secondary!.reserve, 8);
  const rocket = pilot([fit("rocket", "secondary")]);
  assert.equal(modularMissile(rocket).lockSeconds, 0);
  assert.equal(modularMissile(rocket).turnRateRadiansPerSecond, 0);
  assert.equal(modularMissileDamage(pilot([fit("torpedo", "secondary"), fit("warhead", "special")])), 137.5);
});
test("auxiliary power and checkpoint validation cannot mint ammunition or accept invalid resources", () => {
  const actor = pilot([fit("power", "utility-1"), fit("autocannon", "primary")]);
  actor.craft.space!.energy = 10;
  stepEquipmentWeapons(actor, 1);
  assert.equal(actor.craft.space!.energy, 13);
  assert.equal(validEquipmentWeapons(actor.equipment!, actor.equipmentWeapons), true);
  actor.equipmentWeapons!.primary!.reserve = 999999;
  assert.equal(validEquipmentWeapons(actor.equipment!, actor.equipmentWeapons), false);
  actor.equipmentWeapons!.primary!.reserve = 20;
  actor.equipmentWeapons!.primary!.heat = NaN;
  assert.equal(validEquipmentWeapons(actor.equipment!, actor.equipmentWeapons), false);
  assert.equal(validEquipmentWeapons(actor.equipment!, undefined), false);
});
