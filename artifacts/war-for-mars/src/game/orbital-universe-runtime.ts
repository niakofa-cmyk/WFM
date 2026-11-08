import {
  integrateSpatialFlight,
  normalizeFlightControls,
  type AnomalyGravityWellV1,
} from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import type { Match, StepInput } from "./sim";
import {
  capturePilotPose, evaluateUniverseDock, restorePilotPose, RUST_DISC_RELAY, transitionUniverse,
  type UniverseEvent, type UniverseSession,
} from "./orbital-universe-session";
import {
  nearestUniverseAnomaly, positionInCurrentSector, rebaseUniversePosition, universeSectorColliders,
  universeSectorGravityWells, type UniverseAnomalySignal, type UniverseSectorAddress,
} from "./universe-sectors";

/** UI commands carry no caller-supplied pose, eligibility, kills or outcome. */
export type LocalUniverseCommand =
  | Exclude<UniverseEvent, {
      type: "dock" | "training-outcome" | "scan-anomaly" | "scan-rust-relay" | "recover-rust-relay";
    }>
  | { type: "dock"; rendererReady: boolean }
  | { type: "training-outcome" }
  | { type: "scan-anomaly" }
  | { type: "scan-rust-relay" }
  | { type: "recover-rust-relay" };

export type LocalAnomalyScan = UniverseAnomalySignal & { scanned: boolean; logFull: boolean; ready: boolean };
export type LocalRelayInteraction = {
  id: "rust-disc-relay-record";
  label: string;
  distance: number;
  speed: number;
  scanned: boolean;
  recovered: boolean;
  ready: boolean;
  canScan: boolean;
  canRecover: boolean;
};

export function evaluateLocalAnomalyScan(match: Match, session: UniverseSession): LocalAnomalyScan | null {
  const pilot = match.player;
  if (session.phase !== "exploration" || !pilot.alive || !pilot.space) return null;
  const signal = nearestUniverseAnomaly(
    session.sectorAddress,
    { x: pilot.x, y: pilot.space.y, z: pilot.z },
  );
  if (!signal) return null;
  const scanned = session.scannedAnomalies.includes(signal.id);
  const logFull = session.scannedAnomalies.length >= 128;
  const speed = Math.hypot(pilot.space.vx, pilot.space.vy, pilot.space.vz);
  return {
    ...signal,
    scanned,
    logFull,
    ready: !scanned && !logFull && signal.distance <= 24 && speed <= 4,
  };
}

/** Proximity and speed gate the relay interaction; the result remains session-local. */
export function evaluateLocalRelayInteraction(match: Match, session: UniverseSession): LocalRelayInteraction | null {
  const pilot = match.player;
  if (session.phase !== "exploration" || !pilot.alive || !pilot.space) return null;
  const relay = positionInCurrentSector(session.sectorAddress, { x: "0", y: "0", z: "0" }, RUST_DISC_RELAY.position, 1_000_000);
  if (!relay) return null;
  const distance = Math.hypot(relay.x - pilot.x, relay.y - pilot.space.y, relay.z - pilot.z);
  if (!Number.isFinite(distance) || distance > 220) return null;
  const speed = Math.hypot(pilot.space.vx, pilot.space.vy, pilot.space.vz);
  const ready = distance <= 24 && speed <= 4;
  return {
    id: "rust-disc-relay-record",
    label: "RUST DISC · RECOVERED TRANSMISSION",
    distance,
    speed,
    scanned: session.rustRelayScanned,
    recovered: session.rustRelayRecovered,
    ready,
    canScan: ready && !session.rustRelayScanned && !session.rustRelayRecovered,
    canRecover: ready && session.rustRelayScanned && !session.rustRelayRecovered,
  };
}

/**
 * Applies the same activity side effects used by Arena, without owning a
 * renderer, clock, input bus, network connection or animation driver.
 */
export function transitionLocalUniverse(
  match: Match,
  template: Match,
  session: UniverseSession,
  command: LocalUniverseCommand,
): UniverseSession {
  if (!match.orbitalTraining || !template.orbitalTraining || !match.player.space || !template.player.space) {
    throw new Error("Local universe activities require prepared no-reward Orbital training state.");
  }
  let event: UniverseEvent;
  if (command.type === "dock") {
    // Evaluate current simulation state, never stale UI telemetry.
    const dock = evaluateUniverseDock(match.player, session.sectorAddress);
    event = {
      type: "dock",
      rendererReady: command.rendererReady,
      pose: capturePilotPose(match.player),
      dock,
    };
  } else if (command.type === "training-outcome") {
    if (!match.over) return session;
    event = {
      type: "training-outcome",
      debrief: {
        outcome: match.over === "win" ? "win" : match.over === "loss" ? "loss" : "draw",
        kills: match.kills,
        reason: match.over === "win"
          ? "All defenders destroyed. Local training only, no credits or progress recorded."
          : !match.player.alive
            ? "Your ship was destroyed in training. Your universe position was kept."
            : "Training time expired. Your universe position was kept.",
      },
    };
  } else if (command.type === "scan-anomaly") {
    const scan = evaluateLocalAnomalyScan(match, session);
    if (!scan?.ready) return session;
    event = { type: "scan-anomaly", id: scan.id };
  } else if (command.type === "scan-rust-relay") {
    const relay = evaluateLocalRelayInteraction(match, session);
    if (!relay?.canScan) return session;
    event = { type: "scan-rust-relay" };
  } else if (command.type === "recover-rust-relay") {
    const relay = evaluateLocalRelayInteraction(match, session);
    if (!relay?.canRecover) return session;
    event = { type: "recover-rust-relay" };
  } else {
    event = command;
  }
  const next = transitionUniverse(session, event);
  if (next === session) return session;

  if (command.type === "launch-training") {
    Object.assign(match, structuredClone(template));
  } else if ((command.type === "training-outcome" || command.type === "abort-training") && next.retained) {
    // Retain the match object itself: the mounted renderer reads this identity.
    Object.assign(match, structuredClone(template));
    restorePilotPose(match.player, next.retained);
  }
  return next;
}

/** Exploration consumes flight only: combat buttons cannot produce a shot or AI step. */
export function advanceLocalUniverseFlight(
  match: Match,
  session: UniverseSession,
  input: StepInput,
  dt: number,
  sharedGravityWells?: readonly AnomalyGravityWellV1[] | null,
  sharedFlight = false,
): UniverseSectorAddress | null {
  if (session.phase !== "exploration") return null;
  const pilot = match.player;
  const controls = normalizeFlightControls(input);
  const gravityWells = sharedGravityWells === undefined
    ? universeSectorGravityWells(session.sectorAddress)
    : sharedGravityWells ?? [];
  integrateSpatialFlight(pilot, {
    throttle: controls.throttle, yaw: controls.yaw, strafe: controls.strafe,
    pitch: controls.pitch, roll: controls.roll, vertical: controls.vertical,
    boost: controls.boost, brake: controls.brake, drift: controls.drift,
    inertial: controls.inertial,
    ...(controls.maneuver ? { maneuver: controls.maneuver } : {}),
  }, dt, 1, sharedFlight ? [] : universeSectorColliders(session.sectorAddress), SHIPS[pilot.ship], {
    boundaryRadius: null,
    gravityWells,
  });
  const rebased = rebaseUniversePosition(session.sectorAddress, { x: pilot.x, y: pilot.space!.y, z: pilot.z });
  if (!rebased.crossed) return null;
  pilot.x = rebased.local.x;
  pilot.space!.y = rebased.local.y;
  pilot.z = rebased.local.z;
  return rebased.address;
}
