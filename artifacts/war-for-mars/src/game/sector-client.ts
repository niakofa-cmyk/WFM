import { NEUTRAL_FLIGHT_INPUT, type FlightInput } from "./flight-sector";
import {
  ORBITAL_SECTOR_SIMULATION_CONTRACT, SECTOR_MISSIONS, SECTOR_ORBITAL_PROTOCOL_VERSION,
  SECTOR_PROTOCOL_VERSION, sectorMission,
  type SectorMission, type SectorMissionId, type SectorProgress, type SectorSnapshot, type SectorTacticalCommand,
  type IronEclipseSnapshot, type SectorFactionContact, type SectorProtocolVersion, type SectorScoutResult,
} from "./sector-missions";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { SHIPS, type ShipId } from "./ships";

/** Client-only helpers for the cooperative sector expedition. No storage, no logging. */

export const SECTOR_INPUT_HZ = 20;
export const SECTOR_INPUT_INTERVAL_MS = 1000 / SECTOR_INPUT_HZ;
export const SECTOR_RECONNECT_WINDOW_MS = 5000;
export const SECTOR_MAX_PILOTS = 8;
const ROOM_CODE = /^[A-Za-z0-9-]{6,24}$/;

export function expeditionFeatureEnabled(env: { DEV?: boolean; VITE_WFM_SECTOR_EXPEDITION_ENABLED?: string }): boolean {
  if (env.VITE_WFM_SECTOR_EXPEDITION_ENABLED === "false") return false;
  return env.DEV === true || env.VITE_WFM_SECTOR_EXPEDITION_ENABLED === "true";
}

/** V2 remains opt-in so the existing authenticated compatibility route is the default. */
export function sectorClientProtocolVersion(env: { VITE_WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED?: string }): SectorProtocolVersion {
  return env.VITE_WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED === "true"
    ? SECTOR_ORBITAL_PROTOCOL_VERSION
    : SECTOR_PROTOCOL_VERSION;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
}
export function isValidRoomCode(code: string): boolean { return ROOM_CODE.test(code); }

export function generateRoomCode(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = random(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[bytes[i]! % alphabet.length];
  return `SEC-${s}`;
}

/** Adds only sector + room to the shared resolver result. Never auth material. */
export function sectorSocketUrl(base: URL, missionId: SectorMissionId, room: string): URL {
  if (!sectorMission(missionId)) throw new Error("Unknown sector mission.");
  if (!isValidRoomCode(room)) throw new Error("Invitation codes are 6-24 letters, numbers or hyphens.");
  const url = new URL(base.toString());
  url.searchParams.set("sector", missionId);
  url.searchParams.set("room", room);
  return url;
}

export type MissionLock = "open" | "locked" | "complete" | "unknown";
export function missionLockState(mission: SectorMission, progress: SectorProgress | null): MissionLock {
  if (!progress) return mission.prerequisite ? "unknown" : "open";
  if (progress.completed.includes(mission.id)) return "complete";
  if (mission.prerequisite && !progress.completed.includes(mission.prerequisite)) return "locked";
  return "open";
}
export function missionNumber(id: SectorMissionId): number { return SECTOR_MISSIONS.findIndex(m => m.id === id) + 1; }

function validIronEclipseSnapshot(value: unknown): value is IronEclipseSnapshot {
  if (!value || typeof value !== "object") return false;
  const op = value as Partial<IronEclipseSnapshot>;
  const ids: string[] = ["point-defense", "shield-array", "reactor"];
  const orders = ["attack", "defend", "escort", "regroup"];
  const phases = ["engage", "capital", "extract", "complete", "failed"];
  const vector = (v: unknown) => !!v && typeof v === "object" &&
    ["x", "y", "z"].every(key => typeof (v as Record<string, unknown>)[key] === "number" &&
      Number.isFinite((v as Record<string, number>)[key]) &&
      Math.abs((v as Record<string, number>)[key]) <= 10_000);
  const bar = (item: { hull: number; maxHull: number }) => Number.isFinite(item.hull) &&
    Number.isFinite(item.maxHull) && item.maxHull > 0 && item.hull >= 0 && item.hull <= item.maxHull;
  const subsystems = Array.isArray(op.subsystems) ? op.subsystems : [];
  const subsystemIds = subsystems.map(item => item && typeof item === "object" ? item.id : undefined);
  const wing = Array.isArray(op.wing) ? op.wing : [];
  const wingIds = wing.map(item => item && typeof item === "object" ? item.id : undefined);
  const terminalObjectivesMatch =
    (op.phase !== "complete" || op.objectives?.primary === "complete") &&
    (op.phase !== "failed" || op.objectives?.primary === "missed") &&
    (op.phase !== "complete" && op.phase !== "failed" || op.target === null) &&
    (op.phase !== "extract" || (op.target === null && op.objectives?.primary === "pending"));
  const selectedTargetIsAvailable = op.target === null ||
    (subsystems.some(item => !!item && typeof item === "object" && item.id === op.target && !item.disabled) &&
     (op.target !== "reactor" || subsystems.some(item =>
       !!item && typeof item === "object" && item.id === "point-defense" && item.disabled)));
  return phases.includes(op.phase as string) &&
    (op.target === null || ids.includes(op.target as string)) &&
    orders.includes(op.order as string) && vector(op.capitalPosition) && terminalObjectivesMatch && selectedTargetIsAvailable &&
    subsystems.length === 3 &&
    new Set(subsystemIds).size === 3 && ids.every(id => subsystemIds.some(subsystemId => subsystemId === id)) &&
    subsystems.every(item => !!item && typeof item === "object" && ids.includes(item.id) && typeof item.label === "string" &&
      item.label.length > 0 && item.label.length <= 64 && vector(item.position) && bar(item) && typeof item.disabled === "boolean" &&
      item.disabled === (item.hull === 0)) &&
    wing.length === 3 &&
    new Set(wingIds).size === 3 &&
    wing.every(item => !!item && typeof item === "object" && typeof item.id === "string" && isShipId(item.shipId) &&
      item.id.length > 0 && item.id.length <= 64 &&
      vector(item.position) && bar(item) && typeof item.connected === "boolean" &&
      item.connected === (item.hull > 0)) &&
    !!op.objectives &&
    ["pending", "complete", "missed"].includes(op.objectives.primary) &&
    ["pending", "complete", "missed"].includes(op.objectives.shieldArray) &&
    ["pending", "complete", "missed"].includes(op.objectives.wingSurvival);
}
function validScoutResult(value: unknown): value is SectorScoutResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SectorScoutResult>;
  return result.missionId === "pale-beacons" &&
    typeof result.encounterId === "string" && /^[0-9a-f-]{36}$/i.test(result.encounterId) &&
    typeof result.sectorId === "string" && result.sectorId.length > 0 && result.sectorId.length <= 128 &&
    result.sectorId === "pale-beacons-v1" &&
    result.runtime === ORBITAL_RUNTIME_ID &&
    ["scout-result-only-v1", "pale-beacon-npc-bounty-v1"].includes(result.policyId ?? "") &&
    ["completed", "aborted"].includes(result.outcome as string) &&
    Number.isSafeInteger(result.finalTick) && (result.finalTick ?? -1) >= 0 &&
    typeof result.objectiveCompleted === "boolean" &&
    Number.isSafeInteger(result.kills) && (result.kills ?? -1) >= 0 &&
    Number.isSafeInteger(result.assists) && (result.assists ?? -1) >= 0 &&
    Number.isSafeInteger(result.rewardableNpcKills) && (result.rewardableNpcKills ?? -1) >= 0 &&
    Number.isSafeInteger(result.creditsAwarded) && (result.creditsAwarded ?? -1) >= 0 &&
    Array.isArray(result.destroyedActorIds) && result.destroyedActorIds.length <= 128 &&
    result.destroyedActorIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128) &&
    result.kills === result.destroyedActorIds.length &&
    result.rewardableNpcKills! <= result.kills! &&
    typeof result.fingerprint === "string" && /^[0-9a-f]{64}$/.test(result.fingerprint);
}
function validFactionContact(value: unknown): value is SectorFactionContact {
  if (!value || typeof value !== "object") return false;
  const contact = value as Partial<SectorFactionContact>;
  const stages = ["unaware", "investigating", "shadowing", "challenging", "warning", "intercepting", "reinforcements"];
  const actions = ["none", "scan", "shadow", "challenge", "warn", "intercept", "request_reinforcements"];
  const reasons = ["no_sensor_contact", "passive_contact", "transponder_silent", "restricted_territory",
    "high_speed", "targeting", "weapons_hot", "warning_ignored", "hostile_damage", "close_approach"];
  const keys = ["actorFaction", "stage", "action", "reason", "territory", "transponder",
    "distanceMeters", "sensorRangeMeters", "speedMetersPerSecond", "lineOfSight",
    "weaponsHot", "targeting", "enteredAtTick"];
  return Object.keys(contact).length === keys.length && keys.every(key => Object.hasOwn(contact, key)) &&
    (contact.actorFaction === "ussf" || contact.actorFaction === "accord") &&
    stages.includes(contact.stage as string) && actions.includes(contact.action as string) &&
    reasons.includes(contact.reason as string) &&
    ["ussf", "accord", "neutral", "contested"].includes(contact.territory as string) &&
    (contact.transponder === "broadcast" || contact.transponder === "silent") &&
    Number.isSafeInteger(contact.distanceMeters) && (contact.distanceMeters ?? -1) >= 0 &&
    Number.isSafeInteger(contact.sensorRangeMeters) && (contact.sensorRangeMeters ?? 0) > 0 &&
    Number.isSafeInteger(contact.speedMetersPerSecond) && (contact.speedMetersPerSecond ?? -1) >= 0 &&
    typeof contact.lineOfSight === "boolean" && typeof contact.weaponsHot === "boolean" &&
    typeof contact.targeting === "boolean" &&
    Number.isSafeInteger(contact.enteredAtTick) && (contact.enteredAtTick ?? -1) >= 0;
}

/** Structural validation of the server's typed snapshot. Rejects anything else. */
export function parseSectorSnapshot(
  raw: unknown,
  expectedVersion: SectorProtocolVersion = SECTOR_PROTOCOL_VERSION,
): SectorSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<SectorSnapshot>;
  if (p.type !== "sector_snapshot" || p.version !== expectedVersion) return null;
  if (expectedVersion === SECTOR_ORBITAL_PROTOCOL_VERSION) {
    const simulation = p.simulation as Record<string, unknown> | undefined;
    if (!simulation ||
        Object.keys(simulation).length !== 2 ||
        simulation.runtimeId !== ORBITAL_SECTOR_SIMULATION_CONTRACT.runtimeId ||
        simulation.rulesVersion !== ORBITAL_SECTOR_SIMULATION_CONTRACT.rulesVersion) return null;
  } else if (p.simulation !== undefined) return null;
  if (!sectorMission(p.missionId) || typeof p.roomCode !== "string") return null;
  if (!["lobby", "active", "complete", "interrupted", "failed"].includes(p.phase as string)) return null;
  if (!Array.isArray(p.pilots) || p.pilots.length > SECTOR_MAX_PILOTS) return null;
  if (p.scoutResult !== undefined &&
      (!validScoutResult(p.scoutResult) || p.missionId !== "pale-beacons" ||
       !["pending", "recorded", "unavailable"].includes(p.scoutResultStatus as string))) return null;
  if (p.scoutResultStatus !== undefined &&
      (p.scoutResult === undefined || !["pending", "recorded", "unavailable"].includes(p.scoutResultStatus))) return null;
  if (p.factionContact !== undefined) {
    const ownPilot = p.pilots.find(pilot => pilot.slot === p.ownSlot);
    if (p.missionId !== "pale-beacons" || expectedVersion !== SECTOR_ORBITAL_PROTOCOL_VERSION ||
        !validFactionContact(p.factionContact) || !ownPilot ||
        p.factionContact.actorFaction === SHIPS[ownPilot.shipId].faction ||
        p.factionContact.enteredAtTick > (p.tick ?? -1) ||
        (p.factionContact.stage === "unaware" && p.factionContact.action !== "none") ||
        (!p.factionContact.lineOfSight && p.factionContact.stage !== "unaware")) return null;
  }
  if (typeof p.ownSlot !== "number" || typeof p.hostSlot !== "number" || typeof p.tick !== "number") return null;
  if (!p.progress || !Array.isArray(p.progress.completed) || !p.settlement) return null;
  if (p.capabilities !== undefined &&
      (!p.capabilities || typeof p.capabilities !== "object" ||
       typeof p.capabilities.vectorDrift !== "boolean" ||
        (p.capabilities.tacticalCommands !== undefined && typeof p.capabilities.tacticalCommands !== "boolean") ||
        (p.capabilities.ironEclipse !== undefined && typeof p.capabilities.ironEclipse !== "boolean"))) return null;
  for (const pilot of p.pilots) {
    if (!pilot || typeof pilot.slot !== "number" || !(pilot.shipId in SHIPS) || !pilot.flight) return null;
  }
  if (p.command !== undefined && p.command !== null) {
    const command = p.command as SectorTacticalCommand;
    const hasPilot = (slot: number) => p.pilots!.some(pilot => pilot.slot === slot);
    const commonValid = Number.isSafeInteger(command.issuedBySlot) &&
      command.issuedBySlot === p.hostSlot &&
      Number.isSafeInteger(command.issuedAtTick) && command.issuedAtTick >= 0;
    if (!commonValid) return null;
    if (command.order === "attack") {
      if (command.target !== "drone" || command.targetSlot !== null) return null;
    } else if (["defend", "escort", "regroup"].includes(command.order)) {
      if (command.target !== "pilot" || !Number.isSafeInteger(command.targetSlot) ||
          command.targetSlot < 0 || command.targetSlot >= SECTOR_MAX_PILOTS ||
          !hasPilot(command.targetSlot) ||
          (command.order !== "regroup" && command.targetSlot === command.issuedBySlot) ||
          (command.order === "regroup" && command.targetSlot !== p.hostSlot)) return null;
    } else return null;
  }
  if (p.missionId === "iron-eclipse") {
    if (!validIronEclipseSnapshot(p.operation)) return null;
    if (p.capabilities?.ironEclipse !== true) return null;
  } else if (p.operation !== undefined || p.capabilities?.ironEclipse === true) return null;
  return p as SectorSnapshot;
}

/** Close codes / error codes that must not trigger a reconnect. */
export function isTerminalClose(code: number): boolean {
  return code === 1008 || code === 1003 || (code >= 4000 && code < 4100);
}
const TERMINAL_REASON = /auth|token|policy|forbidden|expired|reservation|locked|prerequisite|full|version|invalid|banned/i;
export function isTerminalError(code: string): boolean { return TERMINAL_REASON.test(code); }

export function createSeqCounter() {
  let seq = 0;
  return { next: () => ++seq, reset: () => { seq = 0; }, get current() { return seq; } };
}

/** What a paused / hidden / disconnected pilot transmits: hold position. */
export function holdInput(): FlightInput { return { ...NEUTRAL_FLIGHT_INPUT, throttle: 0, brake: true }; }

export function sanitizeInput(i: FlightInput): FlightInput {
  const c = (v: number, lo: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(1, v)) : 0);
  const clean: FlightInput = {
    throttle: c(i.throttle, 0), pitch: c(i.pitch, -1), yaw: c(i.yaw, -1), roll: c(i.roll, -1),
    strafe: c(i.strafe ?? 0, -1), vertical: c(i.vertical ?? 0, -1),
    boost: !!i.boost, brake: !!i.brake, fire: !!i.fire, lock: !!i.lock, missile: !!i.missile, countermeasure: !!i.countermeasure,
  };
  if (i.drift === true) clean.drift = true;
  return clean;
}

export function slotLabel(slot: number): string { return `PILOT ${String(slot + 1).padStart(2, "0")}`; }
export function isShipId(v: unknown): v is ShipId { return typeof v === "string" && v in SHIPS; }
