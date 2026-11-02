import { NEUTRAL_FLIGHT_INPUT, type FlightInput } from "./flight-sector";
import {
  SECTOR_MISSIONS, SECTOR_PROTOCOL_VERSION, sectorMission,
  type SectorMission, type SectorMissionId, type SectorProgress, type SectorSnapshot, type SectorTacticalCommand,
} from "./sector-missions";
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

/** Structural validation of the server's typed snapshot. Rejects anything else. */
export function parseSectorSnapshot(raw: unknown): SectorSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<SectorSnapshot>;
  if (p.type !== "sector_snapshot" || p.version !== SECTOR_PROTOCOL_VERSION) return null;
  if (!sectorMission(p.missionId) || typeof p.roomCode !== "string") return null;
  if (!["lobby", "active", "complete", "interrupted"].includes(p.phase as string)) return null;
  if (!Array.isArray(p.pilots) || p.pilots.length > SECTOR_MAX_PILOTS) return null;
  if (typeof p.ownSlot !== "number" || typeof p.hostSlot !== "number" || typeof p.tick !== "number") return null;
  if (!p.progress || !Array.isArray(p.progress.completed) || !p.settlement) return null;
  if (p.capabilities !== undefined &&
      (!p.capabilities || typeof p.capabilities !== "object" ||
       typeof p.capabilities.vectorDrift !== "boolean" ||
       (p.capabilities.tacticalCommands !== undefined && typeof p.capabilities.tacticalCommands !== "boolean"))) return null;
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
    boost: !!i.boost, brake: !!i.brake, fire: !!i.fire, lock: !!i.lock, missile: !!i.missile, countermeasure: !!i.countermeasure,
  };
  if (i.drift === true) clean.drift = true;
  return clean;
}

export function slotLabel(slot: number): string { return `PILOT ${String(slot + 1).padStart(2, "0")}`; }
export function isShipId(v: unknown): v is ShipId { return typeof v === "string" && v in SHIPS; }
