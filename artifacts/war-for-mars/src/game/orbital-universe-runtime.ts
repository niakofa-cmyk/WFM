import { integrateSpatialFlight, normalizeFlightControls } from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import type { Match, StepInput } from "./sim";
import {
  capturePilotPose, evaluateCinderDock, restorePilotPose, transitionUniverse,
  type UniverseEvent, type UniverseSession,
} from "./orbital-universe-session";
import {
  nearestUniverseAnomaly, rebaseUniversePosition, universeSectorColliders,
  type UniverseAnomalySignal, type UniverseSectorAddress,
} from "./universe-sectors";

/** UI commands carry no caller-supplied pose, eligibility, kills or outcome. */
export type LocalUniverseCommand =
  | Exclude<UniverseEvent, { type: "dock" | "training-outcome" | "scan-anomaly" }>
  | { type: "dock"; rendererReady: boolean }
  | { type: "training-outcome" }
  | { type: "scan-anomaly" };

export type LocalAnomalyScan = UniverseAnomalySignal & { scanned: boolean; logFull: boolean; ready: boolean };

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
    event = {
      type: "dock", rendererReady: command.rendererReady,
      pose: capturePilotPose(match.player), dock: evaluateCinderDock(match.player, session.sectorAddress),
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
export function advanceLocalUniverseFlight(match: Match, session: UniverseSession, input: StepInput, dt: number): UniverseSectorAddress | null {
  if (session.phase !== "exploration") return null;
  const pilot = match.player;
  const controls = normalizeFlightControls(input);
  integrateSpatialFlight(pilot, {
    throttle: controls.throttle, yaw: controls.yaw, strafe: controls.strafe,
    pitch: controls.pitch, roll: controls.roll, vertical: controls.vertical,
    boost: controls.boost, brake: controls.brake, drift: controls.drift,
    inertial: controls.inertial,
    ...(controls.maneuver ? { maneuver: controls.maneuver } : {}),
  }, dt, 1, universeSectorColliders(session.sectorAddress), SHIPS[pilot.ship], { boundaryRadius: null });
  const rebased = rebaseUniversePosition(session.sectorAddress, { x: pilot.x, y: pilot.space!.y, z: pilot.z });
  if (!rebased.crossed) return null;
  pilot.x = rebased.local.x;
  pilot.space!.y = rebased.local.y;
  pilot.z = rebased.local.z;
  return rebased.address;
}
