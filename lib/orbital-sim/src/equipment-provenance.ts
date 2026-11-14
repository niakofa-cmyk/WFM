import { equipmentDefinition, validateEquipmentFit, type EquippedModule } from "./equipment";
import { subsystemEfficiency, validShipSubsystems, type ShipSubsystemState } from "./ship-subsystems";

export type EnemyEquipmentManifest = {
  version: 1; fleetId: string; shipId: string; hullId: string; modules: EquippedModule[];
};
export type EnemyEquipmentOutcome = {
  version: 2; actorId: string; manifest: EnemyEquipmentManifest; systems?: ShipSubsystemState;
  items: Array<{ hardpointId: string; equipmentId: string; condition: number; status: "intact" | "damaged" | "destroyed" }>;
};
export type EquipmentSalvageLedger = { version: 2; actors: EnemyEquipmentOutcome[]; legacyActorIds: string[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const identity = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_:-]{1,128}$/.test(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
/** Conservative initial AI fit: no invented capital gear or extra utility buffs. */
export function issueEnemyEquipment(fleetId: string, shipId: string, hullId: string): EnemyEquipmentManifest {
  const manifest: EnemyEquipmentManifest = {
    version: 1, fleetId, shipId, hullId, modules: [
      { instanceId: `ai-v1:${shipId}:primary`, hardpointId: "primary", equipmentId: "autocannon", condition: 100 },
      { instanceId: `ai-v1:${shipId}:secondary`, hardpointId: "secondary", equipmentId: "seeker", condition: 100 },
    ],
  };
  if (!validEnemyEquipment(manifest)) throw new Error("Invalid issued AI equipment.");
  return manifest;
}
export function validEnemyEquipment(value: unknown): value is EnemyEquipmentManifest {
  if (!object(value) || !exact(value, ["version", "fleetId", "shipId", "hullId", "modules"]) ||
      value.version !== 1 || !identity(value.fleetId) || !identity(value.shipId) ||
      typeof value.hullId !== "string" || !Array.isArray(value.modules) ||
      value.modules.length < 1 || value.modules.length > 8 ||
      !value.modules.every(m => object(m) &&
        exact(m, ["instanceId", "hardpointId", "equipmentId", "condition"]) &&
        typeof m.instanceId === "string" && m.instanceId === `ai-v1:${value.shipId}:${m.hardpointId}` &&
        typeof m.hardpointId === "string" && typeof m.equipmentId === "string" &&
        ["primary", "secondary"].includes(equipmentDefinition(m.equipmentId)?.kind ?? ""))) return false;
  try { return validateEquipmentFit(value.hullId, value.modules as EquippedModule[]) === null; }
  catch { return false; }
}
function systemFor(equipmentId: string): "weapons" | "missiles" {
  const def = equipmentDefinition(equipmentId)!;
  return def.kind === "primary" ? "weapons" : "missiles";
}
/** Aggregate subsystem survival, not a claim of individual turret collision geometry. */
export function evaluateEnemyEquipment(actorId: string, manifest: EnemyEquipmentManifest,
  systems?: ShipSubsystemState): EnemyEquipmentOutcome {
  if (!identity(actorId) || !validEnemyEquipment(manifest) || systems !== undefined && !validShipSubsystems(systems))
    throw new Error("Invalid AI destruction evidence.");
  return {
    version: 2, actorId, manifest: { ...manifest, modules: manifest.modules.map(item => ({ ...item })) },
    ...(systems ? { systems: { ...systems, health: { ...systems.health } } } : {}),
    items: manifest.modules.map(item => {
      const condition = Math.floor(item.condition * subsystemEfficiency(systems, systemFor(item.equipmentId)));
      return { hardpointId: item.hardpointId, equipmentId: item.equipmentId, condition,
        status: condition === 0 ? "destroyed" : condition < 80 ? "damaged" : "intact" };
    }),
  };
}
export function validEnemyOutcome(value: unknown): value is EnemyEquipmentOutcome {
  if (!object(value) || !exact(value, ["version", "actorId", "manifest", "items", ...(value.systems === undefined ? [] : ["systems"])]) ||
      value.version !== 2 || !identity(value.actorId) || !validEnemyEquipment(value.manifest) ||
      !Array.isArray(value.items) || value.systems !== undefined && !validShipSubsystems(value.systems)) return false;
  const expected = evaluateEnemyEquipment(value.actorId, value.manifest, value.systems as ShipSubsystemState | undefined);
  return value.items.length === expected.items.length && value.items.every((item, i) =>
    object(item) && exact(item, ["hardpointId", "equipmentId", "condition", "status"]) &&
    Object.entries(expected.items[i]!).every(([key, field]) => item[key] === field));
}
export function validEquipmentSalvageLedger(value: unknown): value is EquipmentSalvageLedger {
  if (!object(value) || !exact(value, ["version", "actors", "legacyActorIds"]) || value.version !== 2 ||
      !Array.isArray(value.actors) || !Array.isArray(value.legacyActorIds) ||
      value.actors.length + value.legacyActorIds.length > 128) return false;
  const ids = new Set<string>();
  const instances = new Set<string>();
  for (const actor of value.actors) {
    if (!validEnemyOutcome(actor) || ids.has(actor.actorId)) return false;
    for (const item of actor.manifest.modules) {
      if (instances.has(item.instanceId)) return false;
      instances.add(item.instanceId);
    }
    ids.add(actor.actorId);
  }
  return value.legacyActorIds.every(id => {
    if (!identity(id) || ids.has(id)) return false;
    ids.add(id); return true;
  });
}
/** One allocation per existing event/actor source; no unrelated-catalog fallback. */
export function survivingEquipment(outcome: EnemyEquipmentOutcome) {
  if (!validEnemyOutcome(outcome)) return null;
  const item = outcome.items.find(item => item.condition > 0);
  return item ? { equipmentId: item.equipmentId, condition: item.condition } : null;
}
