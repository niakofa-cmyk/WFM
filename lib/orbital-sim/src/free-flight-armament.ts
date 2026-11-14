import { FREE_FLIGHT_MAX_ACTORS } from "./free-flight-contract";
import { equipmentDefinition, validateEquipmentFit, type EquippedModule } from "./equipment";

export const ARMAMENT_PRESENTATION_PROTOCOL = 1;
export const ARMAMENT_PRESENTATION_INTERVAL_TICKS = 15;
export const MAX_VISIBLE_HARDPOINTS = 8;
/** Public fitted appearance only: never inventory instance IDs or cargo. */
export type VisibleArmamentActor = {
  actorId: string;
  shipId: string;
  mounts: Array<{ hardpointId: string; equipmentId: string }>;
};
export type ArmamentSnapshot = {
  protocol: 1; sessionInstanceId: string; tick: number; actors: VisibleArmamentActor[];
};
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(v).length === allowed.length && Object.keys(v).every(k => allowed.includes(k));
export function isVisibleArmamentActor(value: unknown): value is VisibleArmamentActor {
  if (!object(value) || !keys(value, ["actorId", "shipId", "mounts"]) ||
      typeof value.actorId !== "string" || !/^[a-zA-Z0-9:_-]{1,160}$/.test(value.actorId) ||
      typeof value.shipId !== "string" || !Array.isArray(value.mounts) ||
      value.mounts.length > MAX_VISIBLE_HARDPOINTS) return false;
  const fit: EquippedModule[] = [];
  for (const mount of value.mounts) {
    if (!object(mount) || !keys(mount, ["hardpointId", "equipmentId"]) ||
        typeof mount.hardpointId !== "string" || mount.hardpointId.length > 40 ||
        typeof mount.equipmentId !== "string" || mount.equipmentId.length > 60) return false;
    const def = equipmentDefinition(mount.equipmentId);
    if (!def) return false;
    fit.push({ instanceId: mount.hardpointId, hardpointId: mount.hardpointId,
      equipmentId: mount.equipmentId, condition: def.durability });
  }
  try { return validateEquipmentFit(value.shipId, fit) === null; }
  catch { return false; }
}
export function isArmamentSnapshot(value: unknown): value is ArmamentSnapshot {
  if (!object(value) || !keys(value, ["protocol", "sessionInstanceId", "tick", "actors"]) ||
      value.protocol !== ARMAMENT_PRESENTATION_PROTOCOL ||
      typeof value.sessionInstanceId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.sessionInstanceId) ||
      !Number.isSafeInteger(value.tick) || (value.tick as number) < 0 ||
      !Array.isArray(value.actors) || value.actors.length > FREE_FLIGHT_MAX_ACTORS) return false;
  const ids = new Set<string>();
  return value.actors.every(actor => {
    if (!isVisibleArmamentActor(actor) || ids.has(actor.actorId)) return false;
    ids.add(actor.actorId);
    return true;
  });
}
export function readArmamentSnapshot(value: unknown, sessionInstanceId: string | null, previousTick = -1): ArmamentSnapshot | null {
  return object(value) && value.sessionInstanceId === sessionInstanceId &&
    typeof value.tick === "number" && value.tick > previousTick && isArmamentSnapshot(value) ? value : null;
}
