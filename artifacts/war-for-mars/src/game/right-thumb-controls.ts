import { normalizeRightThumbProfile, type RightThumbProfile, type VectorBoostDirection } from "@workspace/orbital-sim";

const PROFILE_KEY = "wfm.right-thumb-profile.v1";
export function blocksFlightHotkeys(tagName: string, editable = false) {
  return editable || ["INPUT", "SELECT", "TEXTAREA"].includes(tagName.toUpperCase());
}
export function loadRightThumbProfile(): RightThumbProfile {
  try { return normalizeRightThumbProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}")); }
  catch { return normalizeRightThumbProfile(); }
}
export function saveRightThumbProfile(profile: RightThumbProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeRightThumbProfile(profile))); } catch { /* Device storage may be blocked. */ }
}
export function boostDirectionAt(x: number, y: number): VectorBoostDirection | null {
  if (![x, y].every(Number.isFinite) || Math.hypot(x, y) < .64) return null;
  const directions: VectorBoostDirection[] = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];
  return directions[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8]!;
}
export type BoostGestureState = { direction: VectorBoostDirection | null; at: number; cooldownUntil: number };
/** A deliberate edge tap or outward flick, never a drag-and-return aiming stroke. */
export function completedBoostDirection(sample: {
  durationMs: number;
  movementPx: number;
  endX: number;
  endY: number;
  radiusPx: number;
  edgeDirection: VectorBoostDirection | null;
}): VectorBoostDirection | null {
  const { durationMs, movementPx, endX, endY, radiusPx, edgeDirection } = sample;
  if (![durationMs, movementPx, endX, endY, radiusPx].every(Number.isFinite) ||
    durationMs < 0 || durationMs > 185 || movementPx < 0 || radiusPx <= 0) return null;
  if (movementPx <= 11) return edgeDirection;
  // Release must still be near the outward peak. Loops and return-to-center
  // strokes are normal aiming, even when a peak crossed the burst threshold.
  if (Math.hypot(endX, endY) < movementPx * .8) return null;
  return boostDirectionAt(endX / radiusPx, endY / radiusPx);
}
export function registerBoostGesture(state: BoostGestureState, direction: VectorBoostDirection | null, at: number) {
  if (!direction || !Number.isFinite(at) || at < state.cooldownUntil) {
    return { state: { ...state, direction: null }, boost: null };
  }
  const elapsed = at - state.at;
  if (state.direction === direction && elapsed >= 55 && elapsed <= 285) {
    return { state: { direction: null, at, cooldownUntil: at + 420 }, boost: direction };
  }
  return { state: { ...state, direction, at }, boost: null };
}
