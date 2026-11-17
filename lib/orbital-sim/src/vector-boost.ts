import type { FlightControls } from "./flight";

/** Additive capability: historical replay and Wing/sector input shapes stay unchanged. */
export const VECTOR_BOOST_PROTOCOL_V1 = "orbital-vector-boost-v1" as const;
export const VECTOR_BOOST_SECONDS = 0.24;
export const VECTOR_BOOST_COOLDOWN_SECONDS = 1.2;
export const VECTOR_BOOST_MIN_ENERGY = 8;
export const VECTOR_BOOST_DIRECTIONS = [
  "up", "up-right", "right", "down-right", "down", "down-left", "left", "up-left",
] as const;
export type VectorBoostDirection = typeof VECTOR_BOOST_DIRECTIONS[number];
export type VectorBoostState = { remaining: number; cooldown: number; x: number; y: number };
export function newVectorBoost(): VectorBoostState {
  return { remaining: 0, cooldown: 0, x: 0, y: 0 };
}
export function isVectorBoostDirection(value: unknown): value is VectorBoostDirection {
  return typeof value === "string" && (VECTOR_BOOST_DIRECTIONS as readonly string[]).includes(value);
}
export function vectorBoostAxes(direction: VectorBoostDirection) {
  const x = direction.includes("right") ? 1 : direction.includes("left") ? -1 : 0;
  const y = direction.includes("up") ? 1 : direction.includes("down") ? -1 : 0;
  const gain = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
  return { x: x * gain, y: y * gain };
}
export function startVectorBoost(state: VectorBoostState, direction: VectorBoostDirection, energy: number, disabled = false) {
  if (!isVectorBoostDirection(direction) || !Number.isFinite(energy) ||
      energy < VECTOR_BOOST_MIN_ENERGY || disabled || state.cooldown > 0 || state.remaining > 0) return false;
  Object.assign(state, vectorBoostAxes(direction), {
    remaining: VECTOR_BOOST_SECONDS, cooldown: VECTOR_BOOST_COOLDOWN_SECONDS,
  });
  return true;
}
/** Native flight physics owns acceleration, hull handling, speed cap and energy drain. */
export function stepVectorBoost(state: VectorBoostState, input: FlightControls, dt: number): FlightControls {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new RangeError("Invalid vector boost step");
  const active = state.remaining > 1e-8;
  state.remaining = Math.max(0, state.remaining - dt);
  state.cooldown = Math.max(0, state.cooldown - dt);
  return active ? { ...input, boost: true, strafe: -state.x, vertical: state.y } : input;
}
