import {
  equipmentDefinition, equipmentHas, isEquipmentTelemetry, MISSILE_CATALOG, PRIMARY_WEAPON_CATALOG,
  type EquippedModule, type EquipmentKind, type EquipmentWeaponsState, type EquipmentWeaponResource,
  type MissileDefinition, type PrimaryWeaponDefinition, type SpatialCraft,
} from "@workspace/orbital-sim";
import { SHIPS, type ShipId } from "./ships";

export type ModularPilot = { shipId: ShipId; equipment?: EquippedModule[]; equipmentWeapons?: EquipmentWeaponsState; craft: SpatialCraft };
export function fittedModule(actor: ModularPilot, kind: EquipmentKind) {
  const item = actor.equipment?.find(item => equipmentDefinition(item.equipmentId)?.kind === kind);
  return item ? { ...equipmentDefinition(item.equipmentId)!, condition: item.condition } : undefined;
}
export function equipmentWeaponsState(equipment: readonly EquippedModule[]): EquipmentWeaponsState {
  const resource = (kind: EquipmentKind): EquipmentWeaponResource | null => {
    const module = equipment.map(item => equipmentDefinition(item.equipmentId)!).find(item => item.kind === kind);
    return module ? { rounds: module.magazine, reserve: module.ammunition - module.magazine, reload: 0, heat: 0, overheated: false } : null;
  };
  return { primary: resource("primary"), secondary: resource("secondary") };
}
export function validEquipmentWeapons(equipment: EquippedModule[], state: EquipmentWeaponsState | undefined) {
  if (!state || !isEquipmentTelemetry({ protocol: 1, ...state })) return false;
  for (const kind of ["primary", "secondary"] as const) {
    const def = equipment.map(item => equipmentDefinition(item.equipmentId)).find(item => item?.kind === kind);
    const resource = state[kind];
    if (!def ? resource !== null : !resource || resource.rounds > def.magazine ||
        resource.rounds + resource.reserve > def.ammunition || resource.reload > def.reloadSeconds) return false;
  }
  return true;
}
export function stepEquipmentWeapons(actor: ModularPilot, dt: number) {
  if (!actor.equipment?.length || !actor.equipmentWeapons) return;
  for (const kind of ["primary", "secondary"] as const) {
    const resource = actor.equipmentWeapons[kind], def = fittedModule(actor, kind);
    if (!resource || !def) continue;
    resource.heat = Math.max(0, resource.heat - 18 * dt);
    if (resource.heat <= 30) resource.overheated = false;
    if (resource.reload > 0) {
      resource.reload = Math.max(0, resource.reload - dt);
      if (resource.reload === 0) {
        const refill = Math.min(def.magazine - resource.rounds, resource.reserve);
        resource.rounds += refill; resource.reserve -= refill;
      }
    } else if (resource.rounds === 0 && resource.reserve > 0) {
      resource.reload = def.reloadSeconds;
    }
  }
  if (equipmentHas(actor.equipment, "power"))
    actor.craft.space!.energy = Math.min(100, actor.craft.space!.energy + 3 * dt);
}
export function canFireEquipment(actor: ModularPilot, kind: "primary" | "secondary") {
  const resource = actor.equipmentWeapons?.[kind];
  const def = fittedModule(actor, kind);
  if (!def || !resource) return true; // Existing stock weapons retain their rules.
  return actor.craft.alive && actor.craft.root <= 0 && resource.rounds > 0 && resource.reload === 0 &&
    !resource.overheated && actor.craft.space!.energy >= equipmentEnergyCost(actor, kind);
}
export function equipmentEnergyCost(actor: ModularPilot, kind: "primary" | "secondary") {
  const special = fittedModule(actor, "special");
  const extra = kind === "primary" && ["emp", "plasma"].includes(special?.effect ?? "") ||
    kind === "secondary" && special?.effect === "warhead" ? special : undefined;
  return (fittedModule(actor, kind)?.energy ?? 0) + (extra?.energy ?? 0);
}
export function consumeEquipmentShot(actor: ModularPilot, kind: "primary" | "secondary") {
  const resource = actor.equipmentWeapons?.[kind], def = fittedModule(actor, kind);
  if (!resource || !def) return;
  const special = fittedModule(actor, "special");
  const extra = kind === "primary" && ["emp", "plasma"].includes(special?.effect ?? "") ||
    kind === "secondary" && special?.effect === "warhead" ? special : undefined;
  resource.rounds -= 1;
  resource.heat = Math.min(100, resource.heat + def.heat + (extra?.heat ?? 0));
  resource.overheated ||= resource.heat >= 100;
  actor.craft.space!.energy = Math.max(0, actor.craft.space!.energy - equipmentEnergyCost(actor, kind));
}
export function modularPrimary(actor: ModularPilot): { definition: PrimaryWeaponDefinition; speed: number; damage: number; interval: number } {
  const stock = SHIPS[actor.shipId], def = fittedModule(actor, "primary");
  const plasma = equipmentHas(actor.equipment, "plasma");
  return {
    definition: def ? { ...PRIMARY_WEAPON_CATALOG[stock.primaryFit], volleyCount: 1,
      damageScale: 1, projectileSpeedScale: 1, projectileLifetimeSeconds: def.range / def.projectileVelocity,
      visualEffect: plasma ? "ion" : def.id === "railgun" ? "precision" : "pulse" } : PRIMARY_WEAPON_CATALOG[stock.primaryFit],
    speed: def?.projectileVelocity ?? stock.shotSpeed,
    damage: (def ? def.damage * (.75 + .25 * def.condition / def.durability) : stock.shotDmg) * (plasma ? 1.2 : 1),
    interval: def ? 60 / def.roundsPerMinute : stock.fireInterval,
  };
}
export function modularMissile(actor: ModularPilot): MissileDefinition {
  const stock = MISSILE_CATALOG[SHIPS[actor.shipId].missileFit], def = fittedModule(actor, "secondary");
  const sensor = equipmentHas(actor.equipment, "sensor");
  return {
    ...stock,
    ...(def ? {
      projectilesPerLaunch: 1, damageScale: 1, spreadRadians: 0,
      launchSpeed: def.projectileVelocity, lifetimeSeconds: def.range / def.projectileVelocity,
      turnRateRadiansPerSecond: def.tracking, cooldownSeconds: 60 / def.roundsPerMinute,
      maxLockRange: def.range, lockSeconds: def.lockSeconds, guidance: "active" as const,
    } : {}),
    maxLockRange: (def?.range ?? stock.maxLockRange) * (sensor ? 1.25 : 1),
    lockSeconds: (def?.lockSeconds ?? stock.lockSeconds) * (sensor ? .8 : 1),
  };
}
export function modularMissileDamage(actor: ModularPilot) {
  const def = fittedModule(actor, "secondary");
  return (def ? def.damage * (.75 + .25 * def.condition / def.durability) : SHIPS[actor.shipId].missileDamage) *
    (equipmentHas(actor.equipment, "warhead") ? 1.25 : 1);
}
