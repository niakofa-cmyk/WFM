export type DockingApproachState = {
  x: number;
  y: number;
  z: number;
  speed: number;
  alignmentErrorDeg: number;
};

export type DockingGateResult = {
  canDock: boolean;
  reason: "ready" | "outside-volume" | "speed" | "alignment";
};

export const CINDER_RING_DOCKING_LIMITS = {
  x: 2.8,
  y: 2.2,
  nearZ: -1.2,
  farZ: 5.5,
  maxSpeed: 2.2,
  maxAlignmentErrorDeg: 11,
} as const;

/** Local approach gate only. It confers no server access, rewards, or match authority. */
export function evaluateCinderRingDockingGate(state: DockingApproachState): DockingGateResult {
  const limits = CINDER_RING_DOCKING_LIMITS;
  const inside =
    Math.abs(state.x) <= limits.x &&
    Math.abs(state.y) <= limits.y &&
    state.z >= limits.nearZ &&
    state.z <= limits.farZ;
  if (!inside) return { canDock: false, reason: "outside-volume" };
  if (!Number.isFinite(state.speed) || state.speed > limits.maxSpeed) {
    return { canDock: false, reason: "speed" };
  }
  if (!Number.isFinite(state.alignmentErrorDeg) || state.alignmentErrorDeg > limits.maxAlignmentErrorDeg) {
    return { canDock: false, reason: "alignment" };
  }
  return { canDock: true, reason: "ready" };
}
