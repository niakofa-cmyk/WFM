import { integrateSpatialFlight, normalizeFlightControls } from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import type { Match, StepInput } from "./sim";
import {
  capturePilotPose, evaluateCinderDock, restorePilotPose, transitionUniverse,
  UNIVERSE_BOUNDARY_RADIUS, UNIVERSE_COLLIDERS,
  type UniverseEvent, type UniverseSession,
} from "./orbital-universe-session";

/** UI commands carry no caller-supplied pose, eligibility, kills or outcome. */
export type LocalUniverseCommand =
  | Exclude<UniverseEvent, { type: "dock" | "training-outcome" }>
  | { type: "dock"; rendererReady: boolean }
  | { type: "training-outcome" };

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
      pose: capturePilotPose(match.player), dock: evaluateCinderDock(match.player),
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
export function advanceLocalUniverseFlight(match: Match, session: UniverseSession, input: StepInput, dt: number): void {
  if (session.phase !== "exploration") return;
  const pilot = match.player;
  const controls = normalizeFlightControls(input);
  integrateSpatialFlight(pilot, {
    throttle: controls.throttle, yaw: controls.yaw, strafe: controls.strafe,
    pitch: controls.pitch, roll: controls.roll, vertical: controls.vertical,
    boost: controls.boost, brake: controls.brake, drift: controls.drift,
    inertial: controls.inertial,
    ...(controls.maneuver ? { maneuver: controls.maneuver } : {}),
  }, dt, 1, UNIVERSE_COLLIDERS, SHIPS[pilot.ship], { boundaryRadius: UNIVERSE_BOUNDARY_RADIUS });
}
