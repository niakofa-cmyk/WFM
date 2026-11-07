import { rotate, type OrbitalFlight } from "@workspace/orbital-sim";
import { ORIGIN_SECTOR, type UniverseSectorAddress, positionInCurrentSector } from "./universe-sectors";

/**
 * Local Orbital universe session (offline, no rewards, deterministic streamed sectors).
 * Pure state machine + pose helpers. Arena owns the single renderer/rAF loop
 * and applies the side effects these transitions describe.
 * This is NOT multiplayer, account-persistent location, or world authority.
 */

export const UNIVERSE_MODE_ID = "orbital-universe-local" as const;
export type UniversePhase = "exploration" | "docked" | "training" | "debrief";

/** Arena renders crafts at world y = 0.9 + flight y. */
export const UNIVERSE_RENDER_Y_OFFSET = 0.9;
export const UNIVERSE_SPAWN = { x: 0, y: 0, z: 0, yaw: 0 } as const;

/** Fixed physical Cinder Ring location (simulation coordinates): dead ahead of spawn on the
 * spawn flight plane, ring facing +Z, so forward-only throttle reaches the gate. */
export const CINDER_STATION = {
  x: 0,
  y: 0,
  z: -118,
  rotationY: 0,
  interactionRadius: 22,
  maxClosureSpeed: 4,
  headingGateDeg: 35,
} as const;

export function cinderStationTransform() {
  return {
    position: { x: CINDER_STATION.x, y: CINDER_STATION.y + UNIVERSE_RENDER_Y_OFFSET, z: CINDER_STATION.z },
    rotationY: CINDER_STATION.rotationY,
  };
}

type PoseCraft = {
  x: number; z: number; yaw: number; pitch: number; speed: number; steer: number;
  hull: number; hullMax: number; alive: boolean; space?: OrbitalFlight;
};

export type PilotPose = {
  x: number; z: number; yaw: number; pitch: number; speed: number; steer: number;
  hull: number; alive: boolean; space: OrbitalFlight;
};

const finite = (...values: number[]) => values.every(Number.isFinite);

/** True only when every pose, velocity and quaternion component is a finite number. */
export function isFinitePilotState(craft: Pick<PoseCraft, "x" | "z" | "yaw" | "pitch" | "speed" | "space">): boolean {
  const s = craft.space;
  if (!s || !Array.isArray(s.q) || s.q.length !== 4) return false;
  return finite(craft.x, craft.z, craft.yaw, craft.pitch, craft.speed, s.y, s.vx, s.vy, s.vz, ...s.q) &&
    Math.hypot(...s.q) > 1e-6;
}

export function clonePilotPose(pose: PilotPose): PilotPose {
  return { ...pose, space: { ...pose.space, q: [...pose.space.q] as OrbitalFlight["q"] } };
}

export function capturePilotPose(craft: PoseCraft): PilotPose {
  if (!craft.space) throw new Error("Universe pose capture requires spatial flight state.");
  return {
    x: craft.x, z: craft.z, yaw: craft.yaw, pitch: craft.pitch, speed: craft.speed, steer: craft.steer,
    hull: craft.hull, alive: craft.alive,
    space: { ...craft.space, q: [...craft.space.q] as OrbitalFlight["q"] },
  };
}

export function restorePilotPose(craft: PoseCraft, pose: PilotPose) {
  if (!isFinitePilotState(pose)) throw new Error("Refusing to restore a non-finite pilot pose.");
  craft.x = pose.x; craft.z = pose.z; craft.yaw = pose.yaw; craft.pitch = pose.pitch;
  craft.speed = pose.speed; craft.steer = pose.steer; craft.hull = pose.hull; craft.alive = pose.alive;
  craft.space = { ...pose.space, q: [...pose.space.q] as OrbitalFlight["q"] };
}

/** Place the pilot at the bounded-sector spawn, facing the Cinder Ring, at rest. */
export function placeAtSpawn(craft: PoseCraft) {
  if (!craft.space) throw new Error("Universe spawn requires spatial flight state.");
  const half = UNIVERSE_SPAWN.yaw / 2;
  craft.x = UNIVERSE_SPAWN.x; craft.z = UNIVERSE_SPAWN.z; craft.yaw = UNIVERSE_SPAWN.yaw;
  craft.pitch = 0; craft.speed = 0; craft.steer = 0;
  craft.space.y = UNIVERSE_SPAWN.y; craft.space.vx = 0; craft.space.vy = 0; craft.space.vz = 0;
  craft.space.q = [0, Math.sin(half), 0, Math.cos(half)];
}

export type DockReason = "ready" | "range" | "closure" | "heading" | "inactive";
export type DockEvaluation = { eligible: boolean; reason: DockReason; distance: number; closure: number; headingDeg: number };

export function evaluateCinderDock(craft: PoseCraft, sectorAddress: UniverseSectorAddress = ORIGIN_SECTOR): DockEvaluation {
  const s = craft.space;
  if (!s || !craft.alive || !isFinitePilotState(craft)) return { eligible: false, reason: "inactive", distance: Infinity, closure: 0, headingDeg: 180 };
  const station = positionInCurrentSector(sectorAddress, ORIGIN_SECTOR, CINDER_STATION, 1_000_000);
  if (!station) {
    return { eligible: false, reason: "range", distance: 1_000_000_000_000, closure: Math.hypot(s.vx, s.vy, s.vz), headingDeg: 180 };
  }
  const dx = station.x - craft.x; const dy = station.y - s.y; const dz = station.z - craft.z;
  const distance = Math.hypot(dx, dy, dz);
  const closure = Math.hypot(s.vx, s.vy, s.vz);
  const f = rotate(s.q, 0, 0, -1);
  // Approach axis points into the ring face (ring faces +Z rotated by rotationY).
  const ax = -Math.sin(CINDER_STATION.rotationY); const az = -Math.cos(CINDER_STATION.rotationY);
  const fl = Math.hypot(f.x, f.y, f.z);
  const dot = fl > 0 ? Math.max(-1, Math.min(1, (f.x * ax + f.z * az) / fl)) : -1;
  const headingDeg = Math.acos(dot) * 180 / Math.PI;
  const reason: DockReason = distance > CINDER_STATION.interactionRadius ? "range"
    : closure > CINDER_STATION.maxClosureSpeed ? "closure"
      : headingDeg > CINDER_STATION.headingGateDeg ? "heading" : "ready";
  if (!finite(distance, closure, headingDeg)) return { eligible: false, reason: "inactive", distance: Infinity, closure: 0, headingDeg: 180 };
  return { eligible: reason === "ready", reason, distance, closure, headingDeg };
}

export type UniverseDebrief = { outcome: "win" | "loss" | "draw" | "aborted"; kills: number; reason: string };
export type UniverseSession = {
  phase: UniversePhase;
  sectorAddress: UniverseSectorAddress;
  scannedAnomalies: string[];
  retained: PilotPose | null;
  debrief: UniverseDebrief | null;
  trainingRuns: number;
};
export type UniverseEvent =
  | { type: "dock"; pose: PilotPose; dock: DockEvaluation; rendererReady: boolean }
  | { type: "undock" }
  | { type: "launch-training" }
  | { type: "training-outcome"; debrief: UniverseDebrief }
  | { type: "abort-training" }
  | { type: "scan-anomaly"; id: string }
  | { type: "return-from-debrief" };

export function createUniverseSession(): UniverseSession {
  return { phase: "exploration", sectorAddress: ORIGIN_SECTOR, scannedAnomalies: [], retained: null, debrief: null, trainingRuns: 0 };
}

/** Returns the same object when an event is not valid for the current phase. */
export function transitionUniverse(session: UniverseSession, event: UniverseEvent): UniverseSession {
  switch (event.type) {
    case "dock":
      if (session.phase !== "exploration" || !event.dock.eligible || !event.rendererReady) return session;
      if (!isFinitePilotState(event.pose)) return session;
      // Deep copy so later flight mutation can never alias the retained pose.
      return { ...session, phase: "docked", retained: clonePilotPose(event.pose), debrief: null };
    case "undock":
      return session.phase === "docked" ? { ...session, phase: "exploration" } : session;
    case "launch-training":
      return session.phase === "docked" && session.retained
        ? { ...session, phase: "training", trainingRuns: session.trainingRuns + 1, debrief: null }
        : session;
    case "training-outcome":
      return session.phase === "training" ? { ...session, phase: "debrief", debrief: event.debrief } : session;
    case "abort-training":
      return session.phase === "training"
        ? { ...session, phase: "debrief", debrief: { outcome: "aborted", kills: 0, reason: "Training aborted. Nothing was recorded." } }
        : session;
    case "scan-anomaly":
      if (session.phase !== "exploration" || !event.id || session.scannedAnomalies.includes(event.id) || session.scannedAnomalies.length >= 128) return session;
      return { ...session, scannedAnomalies: [...session.scannedAnomalies, event.id] };
    case "return-from-debrief":
      return session.phase === "debrief" ? { ...session, phase: "docked" } : session;
  }
}

/** Phases where the local simulation is frozen behind a station overlay. */
export const universeFrozen = (phase: UniversePhase) => phase === "docked" || phase === "debrief";
