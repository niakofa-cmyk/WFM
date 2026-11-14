export const FREE_FLIGHT_TACTICS_PROTOCOL_V1 = "orbital-freeflight-tactics-v1" as const;

export type FreeFlightTacticalRoleV1 =
  | "command" | "escort" | "interceptor" | "missile-platform" | "recon";
export type FreeFlightTacticalFleetV1 = {
  fleetId: string;
  faction: "ussf" | "accord";
  callsign: string;
  formation: "screen" | "pursuit" | "dispersed";
  mission: "patrol" | "intercept" | "search" | "assist" | "withdraw" | "destroyed";
  detectionState: "clear" | "contact" | "searching";
  combatState: "idle" | "engaged" | "retreating" | "destroyed";
  encounterPhase: "idle" | "active" | "settling" | "settlement-unavailable" | "complete";
  threatLevel: number;
  commandActorId: string | null;
  units: Array<{
    actorId: string;
    shipId: string;
    role: FreeFlightTacticalRoleV1;
    alive: boolean;
    hull: number;
    hullMax: number;
    shield: number;
    shieldMax: number;
    distanceMeters: number;
  }>;
  alliedPilotCount: number;
  alliedAiCount: number;
};
export type FreeFlightTacticalSnapshotV1 = {
  protocol: typeof FREE_FLIGHT_TACTICS_PROTOCOL_V1;
  sessionInstanceId: string;
  tick: number;
  incomingHostileMissileCount: number;
  fleets: FreeFlightTacticalFleetV1[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const boundedString = (value: unknown, max: number) =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const finiteRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Validates the bounded, read-only tactical view sent beside the flight snapshot. */
export function isFreeFlightTacticalSnapshotV1(value: unknown): value is FreeFlightTacticalSnapshotV1 {
  if (!isRecord(value) || value.protocol !== FREE_FLIGHT_TACTICS_PROTOCOL_V1 ||
      !boundedString(value.sessionInstanceId, 64) ||
      !Number.isSafeInteger(value.tick) || (value.tick as number) < 0 ||
      !Number.isSafeInteger(value.incomingHostileMissileCount) ||
      (value.incomingHostileMissileCount as number) < 0 ||
      (value.incomingHostileMissileCount as number) > 512 ||
      !Array.isArray(value.fleets) || value.fleets.length > 32) return false;

  const fleetIds = new Set<string>();
  for (const raw of value.fleets) {
    if (!isRecord(raw)) return false;
    const fleetId = raw.fleetId;
    if (!boundedString(fleetId, 128) || typeof fleetId !== "string" || fleetIds.has(fleetId) ||
        (raw.faction !== "ussf" && raw.faction !== "accord") ||
        !boundedString(raw.callsign, 80) ||
        !["screen", "pursuit", "dispersed"].includes(String(raw.formation)) ||
        !["patrol", "intercept", "search", "assist", "withdraw", "destroyed"].includes(String(raw.mission)) ||
        !["clear", "contact", "searching"].includes(String(raw.detectionState)) ||
        !["idle", "engaged", "retreating", "destroyed"].includes(String(raw.combatState)) ||
        !["idle", "active", "settling", "settlement-unavailable", "complete"].includes(String(raw.encounterPhase)) ||
        !finiteRange(raw.threatLevel, 0, 1) ||
        (raw.commandActorId !== null && !boundedString(raw.commandActorId, 128)) ||
        !Array.isArray(raw.units) || raw.units.length > 32 ||
        !Number.isSafeInteger(raw.alliedPilotCount) || (raw.alliedPilotCount as number) < 0 ||
        (raw.alliedPilotCount as number) > 24 ||
        !Number.isSafeInteger(raw.alliedAiCount) || (raw.alliedAiCount as number) < 0 ||
        (raw.alliedAiCount as number) > 32) return false;
    fleetIds.add(fleetId);

    const unitIds = new Set<string>();
    for (const unit of raw.units) {
      if (!isRecord(unit)) return false;
      const actorId = unit.actorId;
      if (!boundedString(actorId, 128) || typeof actorId !== "string" || unitIds.has(actorId) ||
          !/^[a-z0-9-]{1,32}$/i.test(String(unit.shipId)) ||
          !["command", "escort", "interceptor", "missile-platform", "recon"].includes(String(unit.role)) ||
          typeof unit.alive !== "boolean" ||
          !finiteRange(unit.hull, 0, 1_000) || !finiteRange(unit.hullMax, 1, 1_000) ||
          (unit.hull as number) > (unit.hullMax as number) ||
          !finiteRange(unit.shield, 0, 1_000) || !finiteRange(unit.shieldMax, 1, 1_000) ||
          (unit.shield as number) > (unit.shieldMax as number) ||
          !finiteRange(unit.distanceMeters, 0, 2_500)) return false;
      unitIds.add(actorId);
    }
    if (raw.commandActorId !== null && !unitIds.has(raw.commandActorId as string)) return false;
  }
  return true;
}
