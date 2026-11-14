import { sectorFlightForward, type SectorFlightState } from "@workspace/orbital-sim";
import { CINDER_STATION } from "./orbital-universe-session";
import type { FlightState } from "./flight-sector";
import type { ShipId } from "./ships";

export type NativeDockReason = "ready" | "range" | "closure" | "heading" | "inactive";
export type NativeDockEvaluation = {
  eligible: boolean;
  reason: NativeDockReason;
  distance: number;
  speed: number;
  headingDeg: number;
};

/** The native scene depicts the same local Cinder gate as the universe session. */
export const NATIVE_CINDER_DOCK_LIMITS = {
  range: CINDER_STATION.interactionRadius,
  maxSpeed: CINDER_STATION.maxClosureSpeed,
  maxHeadingDeg: CINDER_STATION.headingGateDeg,
} as const;

const finite = (...values: number[]) => values.every(Number.isFinite);

/** Local-only capture gate; passing it grants no account, queue, or reward authority. */
export function evaluateNativeCinderDock(
  state: Pick<SectorFlightState<ShipId>, "position" | "velocity" | "orientation" | "stage">,
): NativeDockEvaluation {
  const p = state.position;
  const v = state.velocity;
  const q = state.orientation;
  if (state.stage === "destroyed" ||
      !finite(p.x,p.y,p.z,v.x,v.y,v.z,q.x,q.y,q.z,q.w) ||
      Math.hypot(q.x,q.y,q.z,q.w) < 1e-6) {
    return { eligible: false, reason: "inactive", distance: Infinity, speed: Infinity, headingDeg: 180 };
  }

  const dx = CINDER_STATION.x - p.x;
  const dy = CINDER_STATION.y - p.y;
  const dz = CINDER_STATION.z - p.z;
  const distance = Math.hypot(dx,dy,dz);
  const speed = Math.hypot(v.x,v.y,v.z);
  const directionLength = distance || 1;
  const forward = sectorFlightForward(q);
  const forwardLength = Math.hypot(forward.x,forward.y,forward.z) || 1;
  const dot = Math.max(-1, Math.min(1,
    (forward.x * dx + forward.y * dy + forward.z * dz) / (forwardLength * directionLength)));
  const headingDeg = Math.acos(dot) * 180 / Math.PI;
  if (!finite(distance,speed,headingDeg)) {
    return { eligible: false, reason: "inactive", distance: Infinity, speed: Infinity, headingDeg: 180 };
  }

  const reason: NativeDockReason = distance > NATIVE_CINDER_DOCK_LIMITS.range ? "range"
    : speed > NATIVE_CINDER_DOCK_LIMITS.maxSpeed ? "closure"
      : headingDeg > NATIVE_CINDER_DOCK_LIMITS.maxHeadingDeg ? "heading" : "ready";
  return { eligible: reason === "ready", reason, distance, speed, headingDeg };
}

/** Detach a docked flight before handing control to a separate activity route. */
export function snapshotDockedFlightForTraining(state: FlightState): FlightState | null {
  if (!evaluateNativeCinderDock(state).eligible) return null;
  return {
    ...state,
    position: { ...state.position },
    velocity: { ...state.velocity },
    orientation: { ...state.orientation },
    drone: { ...state.drone, position: { ...state.drone.position } },
    projectiles: state.projectiles.map((projectile) => ({
      ...projectile,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
    })),
  };
}

/** Re-copy on restoration so a later sortie cannot mutate the saved return pose. */
export function restoreDockedFlightSnapshot(snapshot: FlightState, selectedShipId: ShipId): FlightState | null {
  if (snapshot.shipId !== selectedShipId || !evaluateNativeCinderDock(snapshot).eligible) return null;
  return {
    ...snapshot,
    position: { ...snapshot.position },
    velocity: { ...snapshot.velocity },
    orientation: { ...snapshot.orientation },
    drone: { ...snapshot.drone, position: { ...snapshot.drone.position } },
    projectiles: snapshot.projectiles.map((projectile) => ({
      ...projectile,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
    })),
  };
}
