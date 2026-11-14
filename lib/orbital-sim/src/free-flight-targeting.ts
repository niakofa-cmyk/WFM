/** Additive capability; never changes the strict V1 snapshot or V5 input shape. */
export const FREE_FLIGHT_TARGETING_V1 = "orbital-freeflight-targeting-v1" as const;
export type FreeFlightTargetState = {
  protocol: typeof FREE_FLIGHT_TARGETING_V1;
  sessionInstanceId: string;
  tick: number;
  targetActorId: string | null;
  lockProgress: number;
  missileReady: boolean;
  missileCooldown: number;
  ammo: number;
};
/** Nearest-first when distances are supplied; IDs break ties deterministically. */
export function cycleFreeFlightTarget<T extends { actorId: string }>(
  candidates: readonly T[],
  currentTargetActorId: string | null,
  distanceFromPilot: (candidate: T) => number = () => 0,
): T | null {
  if (!candidates.length) return null;
  const ordered = candidates.map(candidate => {
    const distance = distanceFromPilot(candidate);
    return { candidate, distance: Number.isFinite(distance) && distance >= 0 ? distance : Infinity };
  }).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance < b.distance ? -1 : 1;
    return a.candidate.actorId < b.candidate.actorId ? -1 :
      a.candidate.actorId > b.candidate.actorId ? 1 : 0;
  });
  const current = ordered.findIndex(({ candidate }) => candidate.actorId === currentTargetActorId);
  return ordered[(current + 1) % ordered.length]!.candidate;
}
export function isFreeFlightTargetState(value: unknown): value is FreeFlightTargetState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const keys = ["protocol", "sessionInstanceId", "tick", "targetActorId", "lockProgress",
    "missileReady", "missileCooldown", "ammo"];
  return Object.keys(state).length === keys.length && keys.every(key => Object.hasOwn(state, key)) &&
    state.protocol === FREE_FLIGHT_TARGETING_V1 &&
    typeof state.sessionInstanceId === "string" && /^[0-9a-f-]{36}$/i.test(state.sessionInstanceId) &&
    Number.isSafeInteger(state.tick) && (state.tick as number) >= 0 &&
    (state.targetActorId === null || typeof state.targetActorId === "string" &&
      /^[a-z0-9_:-]{8,80}$/i.test(state.targetActorId)) &&
    typeof state.lockProgress === "number" && Number.isFinite(state.lockProgress) &&
    state.lockProgress >= 0 && state.lockProgress <= 1 &&
    typeof state.missileReady === "boolean" &&
    typeof state.missileCooldown === "number" && Number.isFinite(state.missileCooldown) &&
    state.missileCooldown >= 0 && state.missileCooldown <= 60 &&
    Number.isSafeInteger(state.ammo) && (state.ammo as number) >= 0 && (state.ammo as number) <= 100 &&
    (state.targetActorId !== null || state.lockProgress === 0 && state.missileReady === false);
}
