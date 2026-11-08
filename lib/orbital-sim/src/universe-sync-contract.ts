export const UNIVERSE_SYNC_PROTOCOL_VERSION = 1 as const;
export const UNIVERSE_SYNC_MAX_CONTACTS = 64;
export const UNIVERSE_SYNC_MAX_LOCAL_METERS = 4096;
export const UNIVERSE_SYNC_MAX_VELOCITY_METERS_PER_SECOND = 10_000;

export type UniverseSyncVector3 = { x: number; y: number; z: number };
export type UniverseFrameSnapshotV1 = {
  protocolVersion: typeof UNIVERSE_SYNC_PROTOCOL_VERSION;
  serverTick: number;
  sector: { x: number; y: number; z: number };
  traffic: Array<{
    actorId: string;
    shipId: string;
    faction: "ussf" | "accord";
    kind: "ai_patrol" | "human_pilot";
    localPosition: UniverseSyncVector3;
    velocity: UniverseSyncVector3;
    yawRadians: number;
    hullFraction: number;
  }>;
};

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key));
}

function isFiniteVector(value: unknown, bound: number): value is UniverseSyncVector3 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const vector = value as Record<string, unknown>;
  return hasExactKeys(vector, ["x", "y", "z"]) &&
    ["x", "y", "z"].every((key) =>
      typeof vector[key] === "number" && Number.isFinite(vector[key]) &&
      Math.abs(vector[key]) <= bound,
    );
}

/** Strict validation for server-produced traffic snapshots before presentation. */
export function isUniverseFrameSnapshotV1(value: unknown): value is UniverseFrameSnapshotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const frame = value as Record<string, unknown>;
  if (!hasExactKeys(frame, ["protocolVersion", "serverTick", "sector", "traffic"]) ||
      frame.protocolVersion !== UNIVERSE_SYNC_PROTOCOL_VERSION ||
      typeof frame.serverTick !== "number" || !Number.isSafeInteger(frame.serverTick) ||
      frame.serverTick < 0 || !Array.isArray(frame.traffic) ||
      frame.traffic.length > UNIVERSE_SYNC_MAX_CONTACTS) return false;

  const sector = frame.sector;
  if (!sector || typeof sector !== "object" || Array.isArray(sector)) return false;
  const address = sector as Record<string, unknown>;
  if (!hasExactKeys(address, ["x", "y", "z"]) ||
      !["x", "y", "z"].every((key) =>
        typeof address[key] === "number" && Number.isSafeInteger(address[key]),
      )) return false;

  const actorIds = new Set<string>();
  return frame.traffic.every((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const entity = raw as Record<string, unknown>;
    if (!hasExactKeys(entity, [
      "actorId", "shipId", "faction", "kind", "localPosition", "velocity", "yawRadians", "hullFraction",
    ]) || typeof entity.actorId !== "string" || entity.actorId.length < 1 ||
        entity.actorId.length > 128 || actorIds.has(entity.actorId) ||
        typeof entity.shipId !== "string" || !/^[a-z0-9-]{1,32}$/i.test(entity.shipId) ||
        (entity.faction !== "ussf" && entity.faction !== "accord") ||
        (entity.kind !== "ai_patrol" && entity.kind !== "human_pilot") ||
        !isFiniteVector(entity.localPosition, UNIVERSE_SYNC_MAX_LOCAL_METERS) ||
        !isFiniteVector(entity.velocity, UNIVERSE_SYNC_MAX_VELOCITY_METERS_PER_SECOND) ||
        typeof entity.yawRadians !== "number" || !Number.isFinite(entity.yawRadians) ||
        Math.abs(entity.yawRadians) > Math.PI ||
        typeof entity.hullFraction !== "number" || !Number.isFinite(entity.hullFraction) ||
        entity.hullFraction < 0 || entity.hullFraction > 1) return false;
    const validEphemeralActorId = entity.kind === "ai_patrol"
      ? entity.actorId.startsWith("patrol-ship:")
      : entity.actorId.startsWith("pilot-session:");
    if (!validEphemeralActorId) return false;
    actorIds.add(entity.actorId);
    return true;
  });
}
