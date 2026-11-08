import { ORBITAL_RULES_VERSION } from "./flight";
import { isAnomalyGravityWellV1, type AnomalyGravityWellV1 } from "./anomaly-gravity";

export const FREE_FLIGHT_PROTOCOL_V1 = "orbital-freeflight-v1" as const;
export const FREE_FLIGHT_ENVIRONMENT_PROTOCOL_V1 = "orbital-freeflight-environment-v1" as const;
export const FREE_FLIGHT_MAX_ACTORS = 32;

export type FreeFlightVector3 = { x: number; y: number; z: number };
export type FreeFlightActorV1 = {
  actorId: string;
  kind: "pilot" | "patrol";
  faction: "ussf" | "accord";
  shipId: string;
  callsign: string;
  position: FreeFlightVector3;
  velocity: FreeFlightVector3;
  orientation: { x: number; y: number; z: number; w: number };
  yaw: number;
  pitch: number;
  speed: number;
  hull: number;
  hullMax: number;
  shield: number;
  shieldMax: number;
  alive: boolean;
  own: boolean;
};
export type FreeFlightSnapshotV1 = {
  protocol: typeof FREE_FLIGHT_PROTOCOL_V1;
  rulesVersion: typeof ORBITAL_RULES_VERSION;
  sessionInstanceId: string;
  tick: number;
  serverTime: number;
  ownActorId: string;
  actors: FreeFlightActorV1[];
};
export type FreeFlightEnvironmentV1 = {
  protocol: typeof FREE_FLIGHT_ENVIRONMENT_PROTOCOL_V1;
  sessionInstanceId: string;
  enabled: boolean;
  gravityWells: AnomalyGravityWellV1[];
};

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function finiteVector(value: unknown, bound: number): value is FreeFlightVector3 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const vector = value as Record<string, unknown>;
  return exactKeys(vector, ["x", "y", "z"]) &&
    ["x", "y", "z"].every((key) =>
      typeof vector[key] === "number" &&
      Number.isFinite(vector[key]) &&
      Math.abs(vector[key]) <= bound,
    );
}

function validActor(value: unknown): value is FreeFlightActorV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actor = value as Record<string, unknown>;
  if (!exactKeys(actor, [
    "actorId", "kind", "faction", "shipId", "callsign", "position", "velocity",
    "orientation", "yaw", "pitch", "speed", "hull", "hullMax", "shield",
    "shieldMax", "alive", "own",
  ])) return false;
  if (typeof actor.actorId !== "string" || actor.actorId.length < 8 || actor.actorId.length > 80 ||
      (actor.kind !== "pilot" && actor.kind !== "patrol") ||
      (actor.faction !== "ussf" && actor.faction !== "accord") ||
      typeof actor.shipId !== "string" || !/^[a-z0-9-]{1,32}$/i.test(actor.shipId) ||
      typeof actor.callsign !== "string" || !/^[a-zA-Z0-9 ._-]{1,64}$/.test(actor.callsign) ||
      !finiteVector(actor.position, 100_000) || !finiteVector(actor.velocity, 256) ||
      typeof actor.yaw !== "number" || !Number.isFinite(actor.yaw) || Math.abs(actor.yaw) > Math.PI * 2 ||
      typeof actor.pitch !== "number" || !Number.isFinite(actor.pitch) || Math.abs(actor.pitch) > Math.PI ||
      typeof actor.speed !== "number" || !Number.isFinite(actor.speed) || Math.abs(actor.speed) > 256 ||
      typeof actor.alive !== "boolean" || typeof actor.own !== "boolean") return false;
  const orientation = actor.orientation;
  if (!orientation || typeof orientation !== "object" || Array.isArray(orientation)) return false;
  const q = orientation as Record<string, unknown>;
  if (!exactKeys(q, ["x", "y", "z", "w"]) ||
      !["x", "y", "z", "w"].every((key) => typeof q[key] === "number" && Number.isFinite(q[key]))) return false;
  const length = Math.hypot(q.x as number, q.y as number, q.z as number, q.w as number);
  if (length < 0.9 || length > 1.1) return false;

  for (const key of ["hull", "hullMax", "shield", "shieldMax"] as const) {
    if (typeof actor[key] !== "number" || !Number.isFinite(actor[key]) ||
        (actor[key] as number) < 0 || (actor[key] as number) > 1_000) return false;
  }
  return (actor.hull as number) <= (actor.hullMax as number) &&
    (actor.shield as number) <= (actor.shieldMax as number) &&
    (actor.kind !== "pilot" || actor.actorId.startsWith("pilot:")) &&
    (actor.kind !== "patrol" ||
      actor.actorId.startsWith("patrol:") ||
      actor.actorId.startsWith("patrol-ship:"));
}

/** Validate server-produced free-flight snapshots before any client rendering. */
export function isFreeFlightSnapshotV1(value: unknown): value is FreeFlightSnapshotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (!exactKeys(snapshot, [
    "protocol", "rulesVersion", "sessionInstanceId", "tick", "serverTime", "ownActorId", "actors",
  ]) || snapshot.protocol !== FREE_FLIGHT_PROTOCOL_V1 ||
      snapshot.rulesVersion !== ORBITAL_RULES_VERSION ||
      typeof snapshot.sessionInstanceId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(snapshot.sessionInstanceId) ||
      typeof snapshot.tick !== "number" || !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 ||
      typeof snapshot.serverTime !== "number" || !Number.isSafeInteger(snapshot.serverTime) ||
      typeof snapshot.ownActorId !== "string" || !Array.isArray(snapshot.actors) ||
      snapshot.actors.length < 1 || snapshot.actors.length > FREE_FLIGHT_MAX_ACTORS ||
      !snapshot.actors.every(validActor)) return false;
  const actors = snapshot.actors as FreeFlightActorV1[];
  const ids = new Set(actors.map((actor) => actor.actorId));
  const ownActors = actors.filter((actor) => actor.own);
  return ids.size === actors.length &&
    ownActors.length === 1 &&
    ownActors[0]?.kind === "pilot" &&
    ownActors[0]?.actorId === snapshot.ownActorId;
}

/** Validate a server-issued environmental ruleset before local prediction/rendering. */
export function isFreeFlightEnvironmentV1(value: unknown): value is FreeFlightEnvironmentV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const environment = value as Record<string, unknown>;
  if (!exactKeys(environment, ["protocol", "sessionInstanceId", "enabled", "gravityWells"]) ||
      environment.protocol !== FREE_FLIGHT_ENVIRONMENT_PROTOCOL_V1 ||
      typeof environment.sessionInstanceId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(environment.sessionInstanceId) ||
      typeof environment.enabled !== "boolean" ||
      !Array.isArray(environment.gravityWells) ||
      environment.gravityWells.length > 1 ||
      !environment.gravityWells.every(isAnomalyGravityWellV1)) return false;
  return environment.enabled || environment.gravityWells.length === 0;
}
