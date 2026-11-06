export type StickSector = "up" | "down" | "left" | "right";
export type ManeuverPulse = { axis: "vertical" | "strafe"; direction: -1 | 1 };
export type DoubleTapState = {
  pending: { sector: StickSector; at: number } | null;
  cooldownUntil: number;
};

export const DOUBLE_TAP_WINDOW_MS = 285;
export const DOUBLE_TAP_MIN_INTERVAL_MS = 55;
export const MANEUVER_PULSE_COOLDOWN_MS = 420;
export const MANEUVER_PULSE_DURATION_MS = 180;
export const STICK_TAP_MAX_DURATION_MS = 185;
export const STICK_TAP_MAX_MOVEMENT_PX = 11;
export const COORDINATED_BANK = 0.42;

export const EMPTY_DOUBLE_TAP_STATE: DoubleTapState = { pending: null, cooldownUntil: 0 };

/** Use only the outer joystick sectors for taps; ordinary center taps do nothing. */
export function stickSectorAt(x: number, y: number, width: number, height: number): StickSector | null {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const nx = (x - width / 2) / (width / 2);
  const ny = (y - height / 2) / (height / 2);
  if (Math.hypot(nx, ny) < 0.64) return null;
  if (Math.abs(ny) >= Math.abs(nx) * 1.08) return ny < 0 ? "up" : "down";
  return nx < 0 ? "left" : "right";
}

export function pulseForSector(sector: StickSector): ManeuverPulse {
  if (sector === "up") return { axis: "vertical", direction: 1 };
  if (sector === "down") return { axis: "vertical", direction: -1 };
  // FlightControlFrame uses positive strafe for right; the Orbital input
  // adapter applies its own sign conversion when consuming this gesture.
  return { axis: "strafe", direction: sector === "left" ? -1 : 1 };
}

export function isQuickStickTap(durationMs: number, movementPx: number, sector: StickSector | null): boolean {
  return sector !== null &&
    Number.isFinite(durationMs) &&
    Number.isFinite(movementPx) &&
    durationMs >= 0 &&
    durationMs <= STICK_TAP_MAX_DURATION_MS &&
    movementPx <= STICK_TAP_MAX_MOVEMENT_PX;
}

export function registerStickTap(
  state: DoubleTapState,
  sector: StickSector | null,
  at: number,
): { state: DoubleTapState; pulse: ManeuverPulse | null } {
  if (!Number.isFinite(at) || !sector) {
    return { state: { ...state, pending: null }, pulse: null };
  }
  if (at < state.cooldownUntil) return { state: { ...state, pending: null }, pulse: null };

  const elapsed = state.pending ? at - state.pending.at : -1;
  if (
    state.pending?.sector === sector &&
    elapsed >= DOUBLE_TAP_MIN_INTERVAL_MS &&
    elapsed <= DOUBLE_TAP_WINDOW_MS
  ) {
    return {
      state: { pending: null, cooldownUntil: at + MANEUVER_PULSE_COOLDOWN_MS },
      pulse: pulseForSector(sector),
    };
  }
  return { state: { ...state, pending: { sector, at } }, pulse: null };
}

/** Camera/flight convention: right is positive yaw, up is positive pitch. */
export function mapFlightStickAxes(x: number, y: number) {
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  const cleanZero = (value: number) => value === 0 ? 0 : value;
  const yaw = cleanZero(clamp(x));
  return { yaw, pitch: cleanZero(-clamp(y)), roll: cleanZero(yaw * COORDINATED_BANK) };
}
