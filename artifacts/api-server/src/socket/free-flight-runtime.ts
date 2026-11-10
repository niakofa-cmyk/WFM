import { randomUUID } from "node:crypto";
import { scoutDestination, updateScoutMemory, type ScoutMemory } from "./patrol-awareness";
import {
  ORBITAL_DT,
  ORBITAL_RULES_VERSION,
  cycleFreeFlightTarget,
  FREE_FLIGHT_PROTOCOL_V1,
  FREE_FLIGHT_ENVIRONMENT_PROTOCOL_V1,
  FREE_FLIGHT_TARGETING_V1,
  FREE_FLIGHT_ASSIST_V1,
  MISSILE_CATALOG,
  PRIMARY_WEAPON_CATALOG,
  acquireTarget,
  missileCanLaunch,
  applyHullDamage,
  detAtan2,
  detCos,
  detHypot,
  detSin,
  guideMissile,
  integrateSpatialFlight,
  VECTOR_BOOST_PROTOCOL_V1,
  isVectorBoostDirection,
  newVectorBoost,
  startVectorBoost,
  stepVectorBoost,
  type VectorBoostState,
  orbitalCombatPursuit,
  anomalyGravityWellForSector,
  newFlight,
  parseOrbitalInput,
  rotate,
  spawnMissileVolley,
  spawnPrimaryVolley,
  firstWorldImpact,
  movingSphereImpact,
  universeCollidersAt,
  resolveUniverseMotion,
  deployCountermeasure,
  type FlightControls,
  type FreeFlightActorV1,
  type AnomalyGravityWellV1,
  type FreeFlightEnvironmentV1,
  type FreeFlightSnapshotV1,
  type SpatialBullet,
  type SpatialCraft,
} from "@workspace/orbital-sim";
import { FLEET_AI_ROSTER, SHIPS, type Faction, type ShipId } from "../game/ships";
import {
  ExplorationEncounter,
  readExplorationReceipt,
  type ExplorationEncounterSnapshotV1,
  type ExplorationReceipt,
} from "../game/exploration-encounter";
import type { ExplorationSettlement } from "../game/exploration-settlement";
import {
  patrolShipActorId,
  type UniversePatrolEncounter,
} from "../game/universe-patrols";

const TICK_RATE = 30;
const SNAPSHOT_INTERVAL_MS = 100;
const INPUT_RATE_LIMIT = 35;
const INPUT_TIMEOUT_MS = 350;
const DISCONNECT_GRACE_MS = 15_000;
const EMPTY_SESSION_TTL_MS = 60_000;
const NEARBY_RADIUS = 2_500;
const MAX_NEARBY_ACTORS = 32;
const MAX_SESSIONS = 32;
const MAX_PILOTS_PER_SESSION = 24;
const MAX_ACTORS_PER_SESSION = 32;
const MAX_PROJECTILES_PER_SESSION = 512;
const MAX_ENCOUNTER_PILOTS = 8;
const MAX_ACTIVE_ENCOUNTERS = 3;
const PATROL_REFRESH_INTERVAL_MS = 15_000;
// Match Combat Lab's 3 HP/s recovery after two seconds without damage.
const SHIELD_RECOVERY_DELAY_TICKS = TICK_RATE * 2;
const SHIELD_RECOVERY_PER_SECOND = 3;
const PATROL_ENGAGEMENT_RANGE = 180;
const PATROL_SENSOR_RANGE = 520;
const ASSIST_CALL_COOLDOWN_MS = 15_000;
const ASSIST_CALL_TTL_MS = 20_000;
const PRIMARY_FIRE_ENGAGEMENT_CONE = 0.3;
const OPEN = 1;

type SharedInput = FlightControls & {
  fire: boolean;
  missile: boolean;
  targetId: number | null;
};

export type FreeFlightAdmission = {
  /** Server-derived location shard; clients never choose or submit this value. */
  sessionKey: string;
  faction: Faction;
  shipId: ShipId;
};

type Actor = {
  actorId: string;
  numericId: number;
  kind: "pilot" | "patrol";
  faction: Faction;
  shipId: ShipId;
  craft: SpatialCraft;
  shield: number;
  shieldMax: number;
  ownerUserId: string | null;
  socket: WebSocketLike | null;
  callsign: string;
  input: SharedInput;
  vectorBoost?: VectorBoostState;
  vectorBoostSeq?: number;
  countermeasureSeq?: number;
  lastCountermeasureTick?: number;
  previousPosition?: { x: number; y: number; z: number };
  selectedTargetActorId?: string | null;
  targetCycleSeq?: number;
  lastTargetCycleAt?: number;
  lastAssistCallAt?: number;
  lastInputAt: number;
  lastSeq: number;
  inputWindowAt: number;
  inputCount: number;
  disconnectedAt: number | null;
  waypointIndex: number;
  waypoints: Array<{ x: number; y: number; z: number }>;
  persistentPatrolId?: string;
  persistentShipId?: string;
  primaryCooldown: number;
  lastDamageTick: number;
  kills: number;
  assists: number;
  creditsAwarded: number;
  gravityEnvironmentV1: boolean;
  scoutMemory?: ScoutMemory;
};
type FreeFlightProjectile = SpatialBullet & {
  id: number;
  sourceActorId: string;
  faction: Faction;
};
type LiveEncounter = {
  id: string;
  faction: Faction;
  patrol: UniversePatrolEncounter;
  contract: ExplorationEncounter;
  participantActorIds: Set<string>;
  phase: "active" | "settling" | "settlement-unavailable" | "complete";
  receipt?: ExplorationReceipt;
  nextSettlementAttemptAt: number;
  settlementTask: Promise<void> | null;
  resultsApplied: boolean;
};
type AssistCall = {
  id: string;
  encounterId: string;
  patrolId: string;
  callerActorId: string;
  targetActorId: string;
  expiresAt: number;
  invitedActorIds: Set<string>;
};
type WebSocketLike = {
  readyState: number;
  bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};
type Session = {
  key: string;
  instanceId: string;
  actors: Map<string, Actor>;
  pilotByUser: Map<string, Actor>;
  anomalyGravityWells: AnomalyGravityWellV1[];
  gravityEnvironmentEnabled: boolean;
  persistentPatrols: Map<string, UniversePatrolEncounter>;
  projectiles: FreeFlightProjectile[];
  combats: Map<string, LiveEncounter>;
  assistCalls: Map<string, AssistCall>;
  engagementPending: boolean;
  nextAutoEngagementAt: number;
  autoEngagementCooldowns: Map<string, number>;
  nextProjectileId: number;
  nextNumericId: number;
  tick: number;
  accumulatorMs: number;
  lastAdvanceAt: number;
  lastSnapshotAt: number;
  emptySince: number | null;
  nextPatrolRefreshAt: number;
  patrolRefreshPending: boolean;
  checkpointSequence: number;
};
type Seat = { session: Session; actor: Actor; userId: string };

export type FreeFlightSessionCheckpointV1 = {
  version: 1;
  key: string;
  instanceId: string;
  actors: Array<Omit<Actor, "socket">>;
  anomalyGravityWells: AnomalyGravityWellV1[];
  gravityEnvironmentEnabled: boolean;
  persistentPatrols: UniversePatrolEncounter[];
  projectiles: FreeFlightProjectile[];
  combats: Array<{
    id: string;
    faction: Faction;
    patrol: UniversePatrolEncounter;
    contract: ExplorationEncounterSnapshotV1;
    participantActorIds: string[];
    phase: LiveEncounter["phase"];
    nextSettlementAttemptAt: number;
    resultsApplied: boolean;
  }>;
  assistCalls: Array<Omit<AssistCall, "invitedActorIds"> & { invitedActorIds: string[] }>;
  autoEngagementCooldowns: Array<[string, number]>;
  nextProjectileId: number;
  nextNumericId: number;
  tick: number;
  checkpointSequence: number;
};

export type StoredFreeFlightCheckpoint = {
  stateVersion: number;
  fencingToken: number;
  checkpointSequence: number;
  snapshot: Record<string, unknown>;
};

const IDLE: SharedInput = {
  throttle: 0, yaw: 0, pitch: 0, strafe: 0, vertical: 0, roll: 0,
  boost: false, brake: false, drift: false, inertial: false, aimAssist: false,
  fire: false, missile: false, targetId: null,
};
const clamp = (n: number, low = -1, high = 1) =>
  Math.max(low, Math.min(high, Number.isFinite(n) ? n : 0));
const factionLabel = (faction: Faction) => faction === "ussf" ? "USSF" : "ACCORD";
const validSessionKey = (key: string) => /^[a-z0-9][a-z0-9:_-]{1,127}$/i.test(key);

function craftFor(
  id: number,
  shipId: ShipId,
  x: number,
  y: number,
  z: number,
  yaw = 0,
): SpatialCraft {
  const def = SHIPS[shipId];
  const space = newFlight(yaw);
  space.y = y;
  space.ammo = def.missileAmmo;
  space.countermeasureCd = 0;
  return {
    id, x, z, yaw, pitch: 0, speed: 0, steer: 0,
    hull: def.hull, hullMax: def.hull, alive: true,
    root: 0, jam: 0, boost: 0, cloak: 0, untargetable: 0,
    radius: def.radius, lockTargetId: null, space,
  };
}

function createPatrols(session: Session, radius = 360) {
  for (const faction of ["ussf", "accord"] as const) {
    const roster = FLEET_AI_ROSTER[faction];
    for (let index = 0; index < 2; index += 1) {
      const shipId = roster[index]!;
      const angle = (faction === "ussf" ? 0 : Math.PI) + index * Math.PI / 2;
      const waypoints = Array.from({ length: 4 }, (_, point) => {
        const a = angle + point * Math.PI / 2;
        return { x: detCos(a) * radius, y: index ? 110 : -70, z: detSin(a) * radius };
      });
      const numericId = session.nextNumericId++;
      const craft = craftFor(
        numericId, shipId, detCos(angle) * radius, index ? 110 : -70,
        detSin(angle) * radius, angle + Math.PI / 2,
      );
      session.actors.set(`patrol:${faction}:${index + 1}`, {
        actorId: `patrol:${faction}:${index + 1}`,
        numericId, kind: "patrol", faction, shipId, craft,
        shield: SHIPS[shipId].shield, shieldMax: SHIPS[shipId].shield,
        ownerUserId: null, socket: null,
        callsign: `${factionLabel(faction)} Patrol ${index + 1}`,
        input: { ...IDLE }, lastInputAt: 0, lastSeq: 0,
        inputWindowAt: 0, inputCount: 0, disconnectedAt: null,
        waypointIndex: 1, waypoints, primaryCooldown: 0, lastDamageTick: -1,
        kills: 0, assists: 0, creditsAwarded: 0,
        gravityEnvironmentV1: false,
      });
    }
  }
}

function addPersistentPatrol(session: Session, patrol: UniversePatrolEncounter, radius = 360) {
  if (session.persistentPatrols.has(patrol.patrolId)) return;
  const knownShips = patrol.ships.filter((ship) => Object.hasOwn(SHIPS, ship.hullId));
  const newShips = knownShips.filter((ship) => !session.actors.has(patrolShipActorId(ship.id)));
  if (session.actors.size + newShips.length > MAX_ACTORS_PER_SESSION) return;
  const fleetOrdinal = session.persistentPatrols.size;
  const fleetRadius = radius + fleetOrdinal * 220;
  const baseAngle = (patrol.faction === "ussf" ? 0 : -Math.PI / 2) + fleetOrdinal * 0.48;
  const waypoints = Array.from({ length: 4 }, (_, point) => {
    const angle = baseAngle + point * Math.PI / 2;
    return { x: detCos(angle) * fleetRadius, y: 0, z: detSin(angle) * fleetRadius };
  });
  patrol.ships.forEach((ship, index) => {
    if (!Object.hasOwn(SHIPS, ship.hullId)) return;
    const actorId = patrolShipActorId(ship.id);
    // Directory refresh must not heal, reposition or renumber a survivor.
    if (session.actors.has(actorId)) return;
    const shipId = ship.hullId as ShipId;
    const angle = baseAngle + index * 0.16;
    const numericId = session.nextNumericId++;
    const craft = craftFor(
      numericId, shipId,
      detCos(angle) * (fleetRadius + index * 12), 0,
      detSin(angle) * (fleetRadius + index * 12), angle + Math.PI / 2,
    );
    session.actors.set(actorId, {
      actorId, numericId, kind: "patrol", faction: patrol.faction, shipId, craft,
      shield: SHIPS[shipId].shield, shieldMax: SHIPS[shipId].shield,
      ownerUserId: null, socket: null, callsign: ship.callsign,
      input: { ...IDLE }, lastInputAt: 0, lastSeq: 0,
      inputWindowAt: 0, inputCount: 0, disconnectedAt: null,
      waypointIndex: 1, waypoints, persistentPatrolId: patrol.patrolId,
      persistentShipId: ship.id, primaryCooldown: 0, lastDamageTick: -1,
      kills: 0, assists: 0, creditsAwarded: 0,
      gravityEnvironmentV1: false,
    });
  });
  session.persistentPatrols.set(patrol.patrolId, patrol);
}

function patrolInput(actor: Actor, searchTarget?: { x: number; y: number; z: number }): SharedInput {
  const target = searchTarget ?? actor.waypoints[actor.waypointIndex]!;
  const { craft } = actor;
  const space = craft.space!;
  const dx = target.x - craft.x;
  let dy = target.y - space.y;
  const dz = target.z - craft.z;
  const distance = detHypot(detHypot(dx, dy), dz);
  const lookahead = Math.min(1, 70 / Math.max(1, distance));
  const obstacle = firstWorldImpact(
    { x: craft.x, y: space.y, z: craft.z },
    { x: craft.x + dx * lookahead, y: space.y + dy * lookahead, z: craft.z + dz * lookahead },
    universeCollidersAt({ x: craft.x, y: space.y, z: craft.z }), craft.radius + 6,
  );
  if (obstacle) dy = Math.max(dy, (obstacle.rock.y ?? 0) + obstacle.rock.r + craft.radius + 18 - space.y);
  if (!searchTarget && distance < 90) actor.waypointIndex = (actor.waypointIndex + 1) % actor.waypoints.length;
  const q = space.q;
  const local = rotate([-q[0], -q[1], -q[2], q[3]], dx, dy, dz);
  return {
    ...IDLE,
    throttle: searchTarget ? (distance > 120 ? 0.75 : 0.28) : distance > 120 ? 0.42 : 0.16,
    yaw: clamp(detAtan2(-local.x, -local.z) * 1.45),
    pitch: clamp(detAtan2(local.y, detHypot(local.x, local.z)) * 1.35),
    strafe: clamp(local.x * 0.0012, -0.18, 0.18),
    vertical: clamp(local.y * 0.0012, -0.18, 0.18),
  };
}

function actorView(actor: Actor, viewer: Actor): FreeFlightActorV1 {
  const { craft } = actor;
  const space = craft.space!;
  return {
    actorId: actor.actorId,
    kind: actor.kind,
    faction: actor.faction,
    shipId: actor.shipId,
    callsign: actor.kind === "patrol"
      ? `${actor.callsign.slice(0, 50)}${actor.scoutMemory ? actor.scoutMemory.mode === "tracking" ? " - PURSUIT" : " - SEARCH" : " - PATROL"}`
      : actor === viewer
        ? "YOU"
        : actor.faction === viewer.faction ? "WING PILOT" : "UNIDENTIFIED CONTACT",
    position: { x: craft.x, y: space.y, z: craft.z },
    velocity: { x: space.vx, y: space.vy, z: space.vz },
    orientation: { x: space.q[0], y: space.q[1], z: space.q[2], w: space.q[3] },
    yaw: craft.yaw,
    pitch: craft.pitch,
    speed: craft.speed,
    hull: craft.hull,
    hullMax: craft.hullMax,
    shield: actor.shield,
    shieldMax: actor.shieldMax,
    alive: craft.alive,
    own: actor === viewer,
  };
}

function distanceBetween(a: Actor, b: Actor) {
  const aSpace = a.craft.space!;
  const bSpace = b.craft.space!;
  return detHypot(
    detHypot(a.craft.x - b.craft.x, aSpace.y - bSpace.y),
    a.craft.z - b.craft.z,
  );
}

function activeCombats(session: Session): LiveEncounter[] {
  return [...session.combats.values()].filter((combat) => combat.phase === "active");
}

function liveCombats(session: Session): LiveEncounter[] {
  return [...session.combats.values()].filter((combat) => combat.phase !== "complete");
}

function pilotHasActiveCombat(session: Session, actorId: string): boolean {
  return [...session.combats.values()].some((combat) =>
    combat.phase === "active" && combat.participantActorIds.has(actorId),
  );
}

/** Do not discard health or attribution while a result is still unresolved. */
function pilotHasUnresolvedCombat(session: Session, actorId: string): boolean {
  return session.engagementPending || [...session.combats.values()].some((combat) =>
    combat.phase !== "complete" && combat.participantActorIds.has(actorId),
  );
}

function pilotNeedsRecovery(actor: Actor): boolean {
  return !actor.craft.alive || actor.craft.hull < actor.craft.hullMax ||
    actor.shield < actor.shieldMax;
}

export function canDamageFreeFlightActor(
  source: Pick<Actor, "kind" | "actorId" | "faction">,
  target: Pick<Actor, "kind" | "actorId" | "faction">,
  combat: Pick<LiveEncounter, "phase" | "participantActorIds"> | undefined,
): boolean {
  if (combat?.phase !== "active" || source.faction === target.faction) return false;
  return source.kind === "pilot" && target.kind === "patrol"
    ? combat.participantActorIds.has(source.actorId)
    : source.kind === "patrol" && target.kind === "pilot" &&
        combat.participantActorIds.has(target.actorId);
}

function encounterActorId(actor: Actor) {
  return actor.kind === "pilot" ? `pilot-${actor.numericId}` :
    actor.persistentShipId ? patrolShipActorId(actor.persistentShipId) : actor.actorId;
}

function weaponEventId(session: Session, projectileId: number) {
  return `${session.instanceId}:${session.tick}:${projectileId}`;
}

export function recoverFreeFlightShield(
  shield: number, shieldMax: number, lastDamageTick: number, tick: number,
): number {
  return lastDamageTick < 0 || tick - lastDamageTick >= SHIELD_RECOVERY_DELAY_TICKS
    ? Math.min(shieldMax, shield + SHIELD_RECOVERY_PER_SECOND * ORBITAL_DT)
    : shield;
}

function send(socket: WebSocketLike | null, packet: unknown) {
  if (!socket || socket.readyState !== OPEN) return;
  if (socket.bufferedAmount > 1_048_576) {
    socket.close(1013, "Free-flight snapshot backpressure");
    return;
  }
  socket.send(JSON.stringify(packet));
}

export function createFreeFlightRuntime(options: {
  resolveAdmission: (userId: string) => Promise<FreeFlightAdmission | null>;
  loadCheckpoint?: (sessionKey: string) => Promise<StoredFreeFlightCheckpoint | null>;
  saveCheckpoint?: (
    sessionKey: string,
    snapshot: FreeFlightSessionCheckpointV1,
    fencingToken: number,
    checkpointSequence: number,
  ) => Promise<boolean>;
  retainEncounterReservationsOnClose?: boolean;
  resolveUniversePatrol?: (userId: string, faction: Faction) => Promise<UniversePatrolEncounter | null>;
  resolveUniversePatrols?: (userId: string, faction: Faction) => Promise<UniversePatrolEncounter[]>;
  reserveUniversePatrol?: (
    userIds: readonly string[],
    faction: Faction,
    contact: Pick<UniversePatrolEncounter, "patrolId" | "locationId" | "faction">,
    encounterId: string,
  ) => Promise<UniversePatrolEncounter | null>;
  settleScoutEncounter?: (receipt: ExplorationReceipt) => Promise<ExplorationSettlement>;
  releaseUniversePatrol?: (patrolId: string, encounterId: string) => Promise<void>;
  /** Trusted test seam for deterministic approach/weapon integration tests. */
  patrolSpawnDistanceMeters?: number;
}) {
  const sessions = new Map<string, Session>();
  const sessionInitializations = new Map<string, Promise<Session | null>>();
  const seats = new Map<WebSocketLike, Seat>();
  const userSeats = new Map<string, Seat>();
  const joiningUsers = new Set<string>();
  const fencingTokens = new Map<string, number>();
  const checkpointPending = new Map<string, Promise<boolean>>();
  const lastCheckpointAt = new Map<string, number>();
  let closed = false;

  function restoreSession(
    key: string,
    now: number,
    stored: StoredFreeFlightCheckpoint,
  ): Session {
    if (stored.stateVersion !== 1 || !Number.isSafeInteger(stored.fencingToken) ||
        stored.fencingToken <= 0 || !Number.isSafeInteger(stored.checkpointSequence) ||
        stored.checkpointSequence < 0) throw new Error("Unsupported free-flight checkpoint row.");
    const snapshot = stored.snapshot as unknown as FreeFlightSessionCheckpointV1;
    if (!snapshot || snapshot.version !== 1 || snapshot.key !== key ||
        typeof snapshot.instanceId !== "string" ||
        !Array.isArray(snapshot.actors) || snapshot.actors.length > MAX_ACTORS_PER_SESSION ||
        !Array.isArray(snapshot.projectiles) || snapshot.projectiles.length > MAX_PROJECTILES_PER_SESSION ||
        !Array.isArray(snapshot.persistentPatrols) ||
        !Array.isArray(snapshot.combats) || snapshot.combats.length > MAX_ACTIVE_ENCOUNTERS + 8 ||
        !Array.isArray(snapshot.assistCalls) || !Array.isArray(snapshot.autoEngagementCooldowns) ||
        !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 ||
        !Number.isSafeInteger(snapshot.nextNumericId) || snapshot.nextNumericId < 1 ||
        !Number.isSafeInteger(snapshot.nextProjectileId) || snapshot.nextProjectileId < 1) {
      throw new Error("Invalid free-flight checkpoint.");
    }
    const actors = new Map<string, Actor>();
    const pilotByUser = new Map<string, Actor>();
    for (const raw of snapshot.actors) {
      const actor = structuredClone(raw) as Actor;
      if (!actor || typeof actor.actorId !== "string" ||
          !Number.isSafeInteger(actor.numericId) || actor.numericId < 1 ||
          (actor.kind !== "pilot" && actor.kind !== "patrol") ||
          (actor.faction !== "ussf" && actor.faction !== "accord") ||
          !Object.hasOwn(SHIPS, actor.shipId) ||
          !actor.craft || !Number.isFinite(actor.craft.x) ||
          !Number.isFinite(actor.craft.z) || !Number.isFinite(actor.craft.hull) ||
          !actor.craft.space || !Number.isFinite(actor.craft.space.y) ||
          !Array.isArray(actor.waypoints) || !Number.isSafeInteger(actor.lastSeq) ||
          actor.lastSeq < 0 || !Number.isFinite(actor.shield) ||
          !Number.isFinite(actor.shieldMax)) {
        throw new Error("Invalid free-flight actor checkpoint.");
      }
      if (actors.has(actor.actorId)) throw new Error("Duplicate free-flight actor checkpoint.");
      actor.socket = null;
      actor.input = { ...IDLE };
      actor.lastInputAt = now;
      actor.inputWindowAt = now;
      actor.inputCount = 0;
      actor.disconnectedAt = now;
      actor.gravityEnvironmentV1 = false;
      actors.set(actor.actorId, actor);
      if (actor.kind === "pilot" && actor.ownerUserId) {
        if (pilotByUser.has(actor.ownerUserId)) throw new Error("Duplicate pilot checkpoint.");
        pilotByUser.set(actor.ownerUserId, actor);
      }
    }
    const persistentPatrols = new Map<string, UniversePatrolEncounter>();
    for (const patrol of snapshot.persistentPatrols) {
      if (!patrol || typeof patrol.patrolId !== "string" ||
          persistentPatrols.has(patrol.patrolId)) {
        throw new Error("Invalid patrol checkpoint.");
      }
      persistentPatrols.set(patrol.patrolId, structuredClone(patrol));
    }
    const combats = new Map<string, LiveEncounter>();
    for (const raw of snapshot.combats) {
      if (!raw || typeof raw.id !== "string" || !raw.patrol ||
          typeof raw.patrol.patrolId !== "string" ||
          !Array.isArray(raw.participantActorIds) ||
          raw.participantActorIds.some((id) => !actors.has(id)) ||
          !["active", "settling", "settlement-unavailable", "complete"].includes(raw.phase) ||
          combats.has(raw.patrol.patrolId)) {
        throw new Error("Invalid encounter checkpoint.");
      }
      const contract = ExplorationEncounter.restore(raw.contract);
      const finalization = raw.contract.finalization;
      const receipt = finalization
        ? contract.finalize(finalization.finalTick, finalization.outcome, finalization.objectiveCompleted)
        : undefined;
      const phase = raw.phase === "settling" ? "settlement-unavailable" : raw.phase;
      if (phase !== "active" && !receipt) throw new Error("Finalized encounter checkpoint has no receipt.");
      combats.set(raw.patrol.patrolId, {
        id: raw.id,
        faction: raw.faction,
        patrol: structuredClone(raw.patrol),
        contract,
        participantActorIds: new Set(raw.participantActorIds),
        phase,
        receipt,
        nextSettlementAttemptAt: 0,
        settlementTask: null,
        resultsApplied: raw.resultsApplied,
      });
    }
    const assistCalls = new Map<string, AssistCall>();
    for (const raw of snapshot.assistCalls) {
      if (!raw || typeof raw.id !== "string" || !Array.isArray(raw.invitedActorIds) ||
          raw.invitedActorIds.some((id) => !actors.has(id)) || assistCalls.has(raw.id)) {
        throw new Error("Invalid assistance checkpoint.");
      }
      assistCalls.set(raw.id, {
        ...structuredClone(raw),
        invitedActorIds: new Set(raw.invitedActorIds),
      });
    }
    const autoEngagementCooldowns = new Map<string, number>();
    for (const [id, until] of snapshot.autoEngagementCooldowns) {
      if (typeof id !== "string" || !Number.isFinite(until) || autoEngagementCooldowns.has(id)) {
        throw new Error("Invalid engagement cooldown checkpoint.");
      }
      autoEngagementCooldowns.set(id, until);
    }
    return {
      key,
      instanceId: snapshot.instanceId,
      actors,
      pilotByUser,
      anomalyGravityWells: structuredClone(snapshot.anomalyGravityWells ?? []),
      gravityEnvironmentEnabled: false,
      persistentPatrols,
      projectiles: structuredClone(snapshot.projectiles),
      combats,
      assistCalls,
      engagementPending: false,
      nextAutoEngagementAt: now,
      autoEngagementCooldowns,
      nextProjectileId: snapshot.nextProjectileId,
      nextNumericId: snapshot.nextNumericId,
      tick: snapshot.tick,
      accumulatorMs: 0,
      lastAdvanceAt: now,
      lastSnapshotAt: now,
      emptySince: null,
      nextPatrolRefreshAt: now,
      patrolRefreshPending: false,
      checkpointSequence: stored.checkpointSequence,
    };
  }

  function checkpointFor(session: Session): FreeFlightSessionCheckpointV1 {
    return {
      version: 1,
      key: session.key,
      instanceId: session.instanceId,
      actors: [...session.actors.values()].map(({ socket: _socket, ...actor }) =>
        structuredClone(actor)),
      anomalyGravityWells: structuredClone(session.anomalyGravityWells),
      gravityEnvironmentEnabled: session.gravityEnvironmentEnabled,
      persistentPatrols: [...session.persistentPatrols.values()].map((patrol) =>
        structuredClone(patrol)),
      projectiles: structuredClone(session.projectiles),
      combats: [...session.combats.values()].map((combat) => ({
        id: combat.id,
        faction: combat.faction,
        patrol: structuredClone(combat.patrol),
        contract: combat.contract.snapshot(),
        participantActorIds: [...combat.participantActorIds],
        phase: combat.phase,
        nextSettlementAttemptAt: combat.nextSettlementAttemptAt,
        resultsApplied: combat.resultsApplied,
      })),
      assistCalls: [...session.assistCalls.values()].map((call) => ({
        ...structuredClone({
          id: call.id,
          encounterId: call.encounterId,
          patrolId: call.patrolId,
          callerActorId: call.callerActorId,
          targetActorId: call.targetActorId,
          expiresAt: call.expiresAt,
        }),
        invitedActorIds: [...call.invitedActorIds],
      })),
      autoEngagementCooldowns: [...session.autoEngagementCooldowns],
      nextProjectileId: session.nextProjectileId,
      nextNumericId: session.nextNumericId,
      tick: session.tick,
      checkpointSequence: session.checkpointSequence,
    };
  }

  function sessionFor(
    key: string,
    now: number,
    patrols: readonly UniversePatrolEncounter[] = [],
    checkpoint?: StoredFreeFlightCheckpoint | null,
  ): Session | null {
    let session = sessions.get(key);
    if (session) {
      for (const patrol of patrols) addPersistentPatrol(
        session, patrol, options.patrolSpawnDistanceMeters,
      );
      return session;
    }
    if (sessions.size >= MAX_SESSIONS) return null;
    if (checkpoint) {
      session = restoreSession(key, now, checkpoint);
      sessions.set(key, session);
      for (const patrol of patrols) addPersistentPatrol(
        session, patrol, options.patrolSpawnDistanceMeters,
      );
      return session;
    }
    const anomalyGravityWell = anomalyGravityWellForSector(key);
    session = {
      key, instanceId: randomUUID(), actors: new Map(), pilotByUser: new Map(),
      anomalyGravityWells: anomalyGravityWell ? [anomalyGravityWell] : [],
      gravityEnvironmentEnabled: false,
      persistentPatrols: new Map(), projectiles: [], combats: new Map(), assistCalls: new Map(),
      engagementPending: false, nextAutoEngagementAt: 0,
      autoEngagementCooldowns: new Map(), nextProjectileId: 1,
      nextNumericId: 1, tick: 0, accumulatorMs: 0,
      lastAdvanceAt: now, lastSnapshotAt: now, emptySince: null,
      nextPatrolRefreshAt: now + PATROL_REFRESH_INTERVAL_MS, patrolRefreshPending: false,
      checkpointSequence: 0,
    };
    sessions.set(key, session);
    if (patrols.length) {
      for (const patrol of patrols) addPersistentPatrol(
        session, patrol, options.patrolSpawnDistanceMeters,
      );
    } else if (!options.resolveUniversePatrols && !options.resolveUniversePatrol) {
      // Compatibility-only traffic must never stand in for an empty or
      // unavailable persistent roster in the shared, reward-bearing universe.
      createPatrols(session, options.patrolSpawnDistanceMeters);
    }
    return session;
  }

  async function getOrInitializeSession(
    key: string,
    now: number,
    patrols: readonly UniversePatrolEncounter[],
  ): Promise<Session | null> {
    const existing = sessions.get(key);
    if (existing) return sessionFor(key, now, patrols);
    const pending = sessionInitializations.get(key);
    if (pending) return pending;
    const expectedFence = fencingTokens.get(key);
    const initialization = (async () => {
      const checkpoint = await options.loadCheckpoint?.(key) ?? null;
      if (closed || fencingTokens.get(key) !== expectedFence) return null;
      return sessionFor(key, now, patrols, checkpoint);
    })().finally(() => sessionInitializations.delete(key));
    sessionInitializations.set(key, initialization);
    return initialization;
  }

  async function persistSession(session: Session): Promise<boolean> {
    if (!options.saveCheckpoint) return true;
    const previous = checkpointPending.get(session.key);
    if (previous) return previous;
    const fencingToken = fencingTokens.get(session.key) ?? 1;
    const sequence = session.checkpointSequence + 1;
    const snapshot = checkpointFor(session);
    snapshot.checkpointSequence = sequence;
    const pending = options.saveCheckpoint(
      session.key, snapshot, fencingToken, sequence,
    ).then((saved) => {
      if (!saved) {
        process.stderr.write('{"event":"freeflight_checkpoint_fenced"}\n');
        return false;
      }
      session.checkpointSequence = sequence;
      lastCheckpointAt.set(session.key, Date.now());
      return true;
    }).catch(() => {
      process.stderr.write('{"event":"freeflight_checkpoint_write_failed"}\n');
      return false;
    }).finally(() => checkpointPending.delete(session.key));
    checkpointPending.set(session.key, pending);
    return pending;
  }

  async function persistSessionFresh(session: Session): Promise<boolean> {
    await checkpointPending.get(session.key);
    return persistSession(session);
  }

  function snapshotFor(session: Session, viewer: Actor): FreeFlightSnapshotV1 {
    const viewerSpace = viewer.craft.space!;
    const radiusSq = NEARBY_RADIUS ** 2;
    const nearby = [...session.actors.values()]
      .filter((actor) => {
        if (actor.kind === "pilot" && actor.socket?.readyState !== OPEN && actor !== viewer) return false;
        if (actor === viewer) return true;
        const dx = actor.craft.x - viewer.craft.x;
        const dy = actor.craft.space!.y - viewerSpace.y;
        const dz = actor.craft.z - viewer.craft.z;
        return dx * dx + dy * dy + dz * dz <= radiusSq;
      })
      .sort((a, b) => {
        if (a === viewer) return -1;
        if (b === viewer) return 1;
        const distanceSq = (actor: Actor) => {
          const dx = actor.craft.x - viewer.craft.x;
          const dy = actor.craft.space!.y - viewerSpace.y;
          const dz = actor.craft.z - viewer.craft.z;
          return dx * dx + dy * dy + dz * dz;
        };
        return distanceSq(a) - distanceSq(b);
      })
      .slice(0, MAX_NEARBY_ACTORS)
      .map((actor) => actorView(actor, viewer));
    return {
      protocol: FREE_FLIGHT_PROTOCOL_V1,
      rulesVersion: ORBITAL_RULES_VERSION,
      sessionInstanceId: session.instanceId,
      tick: session.tick,
      serverTime: Date.now(),
      ownActorId: viewer.actorId,
      actors: nearby,
    };
  }

  function publish(session: Session) {
    for (const actor of session.actors.values()) {
      if (actor.kind === "pilot" && actor.socket?.readyState === OPEN) {
        send(actor.socket, { type: "freeflight_snapshot", snapshot: snapshotFor(session, actor) });
        sendTargetState(session, actor);
      }
    }
  }

  function eligiblePilotTarget(session: Session, pilot: Actor, candidate: Actor) {
    const combat = candidate.persistentPatrolId
      ? session.combats.get(candidate.persistentPatrolId) : undefined;
    return pilot.craft.alive && candidate.craft.alive && candidate.faction !== pilot.faction &&
      combat?.phase === "active" && combat.participantActorIds.has(pilot.actorId) &&
      distanceBetween(pilot, candidate) <= NEARBY_RADIUS;
  }

  function sendTargetState(session: Session, pilot: Actor) {
    if (pilot.kind !== "pilot" || pilot.socket?.readyState !== OPEN) return;
    const target = pilot.selectedTargetActorId ? session.actors.get(pilot.selectedTargetActorId) : undefined;
    const valid = target && eligiblePilotTarget(session, pilot, target) ? target : undefined;
    const space = pilot.craft.space!;
    const missile = MISSILE_CATALOG[SHIPS[pilot.shipId].missileFit];
    send(pilot.socket, { type: "freeflight_target_state", state: {
      protocol: FREE_FLIGHT_TARGETING_V1, sessionInstanceId: session.instanceId, tick: session.tick,
      targetActorId: valid?.actorId ?? null,
      lockProgress: valid && space.lockTargetId === valid.numericId ? space.lockProgress : 0,
      missileReady: Boolean(valid && missileCanLaunch(
        pilot.craft, valid.craft, session.projectiles.length, [], missile)),
      missileCooldown: space.missileCd, ammo: space.ammo,
    } });
  }

  function environmentFor(session: Session): FreeFlightEnvironmentV1 {
    return {
      protocol: FREE_FLIGHT_ENVIRONMENT_PROTOCOL_V1,
      sessionInstanceId: session.instanceId,
      enabled: session.gravityEnvironmentEnabled,
      gravityWells: session.gravityEnvironmentEnabled ? session.anomalyGravityWells : [],
    };
  }

  function refreshGravityEnvironment(session: Session) {
    const connectedPilots = [...session.pilotByUser.values()].filter(
      (actor) => actor.socket?.readyState === OPEN,
    );
    const enabled = connectedPilots.length > 0 &&
      connectedPilots.every((actor) => actor.gravityEnvironmentV1);
    const changed = session.gravityEnvironmentEnabled !== enabled;
    session.gravityEnvironmentEnabled = enabled;
    return changed;
  }

  function broadcastEnvironment(session: Session, except: WebSocketLike | null = null) {
    const packet = { type: "freeflight_environment", environment: environmentFor(session) };
    for (const actor of session.pilotByUser.values()) {
      if (actor.socket?.readyState === OPEN && actor.socket !== except) send(actor.socket, packet);
    }
  }

  function broadcast(session: Session, packet: unknown) {
    for (const actor of session.actors.values()) {
      if (actor.kind === "pilot" && actor.socket?.readyState === OPEN) send(actor.socket, packet);
    }
  }

  function combatTarget(session: Session, actor: Actor, primaryFire = false): Actor | undefined {
    // Selection is persistent; geometry controls acquisition, not which enemy
    // a turning/evading pilot silently gets switched to.
    if (actor.kind === "pilot" && !primaryFire && actor.selectedTargetActorId) {
      const selected = session.actors.get(actor.selectedTargetActorId);
      if (selected && eligiblePilotTarget(session, actor, selected)) return selected;
      actor.selectedTargetActorId = null;
    }
    const ownPatrolCombat = actor.persistentPatrolId
      ? session.combats.get(actor.persistentPatrolId) : undefined;
    const missile = MISSILE_CATALOG[SHIPS[actor.shipId].missileFit];
    const forward = rotate(actor.craft.space!.q, 0, 0, -1);
    const range = primaryFire ? NEARBY_RADIUS : missile.maxLockRange;
    const cone = detCos(primaryFire ? PRIMARY_FIRE_ENGAGEMENT_CONE : missile.lockConeRadians);
    let best: Actor | undefined;
    let bestDistance = Infinity;
    for (const candidate of session.actors.values()) {
      if (!candidate.craft.alive) continue;
      if (actor.kind === "pilot") {
        const combat = candidate.persistentPatrolId
          ? session.combats.get(candidate.persistentPatrolId) : undefined;
        if (candidate.faction === actor.faction || combat?.phase !== "active" ||
            !combat.participantActorIds.has(actor.actorId)) continue;
      } else if (ownPatrolCombat?.phase !== "active" ||
          !ownPatrolCombat.participantActorIds.has(candidate.actorId) ||
          candidate.socket?.readyState !== OPEN) continue;
      const dx = candidate.craft.x - actor.craft.x;
      const dy = candidate.craft.space!.y - actor.craft.space!.y;
      const dz = candidate.craft.z - actor.craft.z;
      const distance = detHypot(detHypot(dx, dy), dz);
      const dot = (forward.x * dx + forward.y * dy + forward.z * dz) / Math.max(0.001, distance);
      if (distance > range || dot < cone) continue;
      if (distance < bestDistance || distance === bestDistance &&
          (!best || candidate.actorId.localeCompare(best.actorId) < 0)) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (actor.kind === "pilot" && !primaryFire) actor.selectedTargetActorId = best?.actorId ?? null;
    return best;
  }

  /** Primary fire can initiate a server-owned encounter at any distance in the
   * currently streamed universe bubble. The client never chooses the target. */
  function primaryFireTarget(session: Session, actor: Actor): Actor | undefined {
    const space = actor.craft.space;
    if (!space) return undefined;
    const forward = rotate(space.q, 0, 0, -1);
    return [...session.actors.values()]
      .filter((candidate) => candidate.kind === "patrol" &&
        candidate.persistentPatrolId && candidate.persistentShipId &&
        candidate.faction !== actor.faction && candidate.craft.alive)
      .map((candidate) => {
        const dx = candidate.craft.x - actor.craft.x;
        const dy = candidate.craft.space!.y - space.y;
        const dz = candidate.craft.z - actor.craft.z;
        const distance = detHypot(detHypot(dx, dy), dz);
        const dot = (forward.x * dx + forward.y * dy + forward.z * dz) /
          Math.max(0.001, distance);
        return { candidate, distance, dot };
      })
      .filter((entry) => entry.distance <= NEARBY_RADIUS &&
        entry.dot >= detCos(PRIMARY_FIRE_ENGAGEMENT_CONE))
      .sort((a, b) => b.dot - a.dot || a.distance - b.distance ||
        a.candidate.actorId.localeCompare(b.candidate.actorId))[0]
      ?.candidate;
  }

  function patrolCombatInput(actor: Actor, target: Actor): SharedInput {
    const space = actor.craft.space!;
    const dx = target.craft.x - actor.craft.x;
    const dy = target.craft.space!.y - space.y;
    const dz = target.craft.z - actor.craft.z;
    const distance = detHypot(detHypot(dx, dy), dz);
    const q = space.q;
    const local = rotate([-q[0], -q[1], -q[2], q[3]], dx, dy, dz);
    const yawError = detAtan2(-local.x, -local.z);
    const pitchError = detAtan2(local.y, detHypot(local.x, local.z));
    return {
      ...IDLE,
      ...orbitalCombatPursuit(actor.craft, target.craft, SHIPS[actor.shipId].role).controls,
      // Training's readable aim-before-fire rule, in shared 3D space.
      // Proximity alone is not permission to shoot sideways/backwards.
      fire: distance < 170 && Math.abs(yawError) < 0.18 && Math.abs(pitchError) < 0.18,
    };
  }

  function addProjectiles(session: Session, actor: Actor, bullets: SpatialBullet[]) {
    for (const bullet of bullets) {
      if (session.projectiles.length >= MAX_PROJECTILES_PER_SESSION) break;
      session.projectiles.push({
        ...bullet,
        id: session.nextProjectileId++,
        sourceActorId: actor.actorId,
        faction: actor.faction,
      });
      const projectile = session.projectiles[session.projectiles.length - 1]!;
      broadcast(session, {
        type: "freeflight_weapon_fired",
        eventId: weaponEventId(session, projectile.id),
        sourceActorId: actor.actorId,
        sourceFaction: actor.faction,
        weaponId: projectile.weaponId ?? (projectile.missile ? "missile" : "primary"),
        visualEffect: projectile.visualEffect ?? (projectile.missile ? "swarm" : "pulse"),
        from: { x: projectile.x, y: projectile.y ?? 0, z: projectile.z },
        velocity: { x: projectile.vx, y: projectile.vy ?? 0, z: projectile.vz },
        lifetimeSeconds: projectile.life,
        serverTime: Date.now(),
      });
    }
  }

  function fireWeapons(session: Session, actor: Actor, input: SharedInput) {
    const combat = actor.kind === "pilot"
      ? activeCombats(session).find((candidate) => candidate.participantActorIds.has(actor.actorId))
      : actor.persistentPatrolId
        ? session.combats.get(actor.persistentPatrolId)
        : undefined;
    const combatActive = combat?.phase === "active";
    if (actor.kind !== "pilot" && !combatActive) return;
    const target = combatActive ? combatTarget(session, actor) : undefined;
    const primaryTarget = combatActive ? combatTarget(session, actor, true) : undefined;
    const missile = MISSILE_CATALOG[SHIPS[actor.shipId].missileFit];
    const cover = universeCollidersAt({ x: actor.craft.x, y: actor.craft.space!.y, z: actor.craft.z });
    actor.craft.lockTargetId = target?.numericId ?? null;
    acquireTarget(actor.craft, target?.craft, ORBITAL_DT, cover, missile);
    const ship = SHIPS[actor.shipId];
    if (input.fire && actor.primaryCooldown <= 0) {
      const bullets = spawnPrimaryVolley(
        actor.craft, primaryTarget?.craft, ship.shotSpeed, ship.shotDmg, cover,
        PRIMARY_WEAPON_CATALOG[ship.primaryFit],
      );
      if (actor.kind === "pilot" && combatActive && primaryTarget) {
        // No arbitrary primary-gun range gate: retain each round long enough
        // to reach the server-selected hostile at its current range.
        const targetRange = distanceBetween(actor, primaryTarget) + 8;
        for (const bullet of bullets) {
          const speed = detHypot(detHypot(bullet.vx, bullet.vy ?? 0), bullet.vz);
          if (speed > 0) bullet.life = Math.max(
            bullet.life, targetRange / speed + 0.25,
          );
        }
      }
      addProjectiles(session, actor, bullets);
      actor.primaryCooldown = ship.fireInterval;
    }
    if (input.missile && combatActive) {
      addProjectiles(session, actor, spawnMissileVolley(
        actor.craft, target?.craft, session.projectiles.length,
        ship.missileDamage, cover, missile,
      ));
    }
  }

  function impactCombat(session: Session, source: Actor, target: Actor) {
    const patrolId = target.kind === "patrol"
      ? target.persistentPatrolId
      : source.persistentPatrolId;
    const combat = patrolId ? session.combats.get(patrolId) : undefined;
    return canDamageFreeFlightActor(source, target, combat) ? combat : undefined;
  }

  function sendEncounterState(session: Session, combat: LiveEncounter, phase: string) {
    for (const actorId of combat.participantActorIds) {
      const actor = session.actors.get(actorId);
      send(actor?.socket ?? null, {
        type: "freeflight_engagement_state",
        encounterId: combat.id,
        phase: pilotHasActiveCombat(session, actorId) ? "active" : phase,
      });
    }
  }

  function applyProjectileHit(
    session: Session,
    projectile: FreeFlightProjectile,
    target: Actor,
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
  ) {
    const attacker = session.actors.get(projectile.sourceActorId);
    const combat = attacker ? impactCombat(session, attacker, target) : undefined;
    if (!attacker || !combat) return;
    const shieldDamage = Math.min(target.shield, projectile.dmg);
    target.shield = Math.max(0, target.shield - shieldDamage);
    const hullDamage = applyHullDamage(target.craft, projectile.dmg - shieldDamage);
    if (target.craft.hull <= 0) target.craft.alive = false;
    if (shieldDamage + hullDamage > 0) target.lastDamageTick = session.tick;
    if (hullDamage > 0) {
      combat.contract.recordDamage({
        eventId: weaponEventId(session, projectile.id),
        tick: session.tick,
        attackerActorId: encounterActorId(attacker),
        targetActorId: encounterActorId(target),
        hullDamage,
      });
    }
    broadcast(session, {
      type: "freeflight_weapon_event",
      eventId: weaponEventId(session, projectile.id),
      encounterId: combat.id,
      sourceActorId: projectile.sourceActorId,
      sourceFaction: projectile.faction,
      targetActorId: target.actorId,
      weaponId: projectile.weaponId ?? (projectile.missile ? "missile" : "primary"),
      visualEffect: projectile.visualEffect ?? (projectile.missile ? "swarm" : "pulse"),
      from,
      to,
      shieldDamage,
      hullDamage,
      destroyed: !target.craft.alive,
    });
    if (!target.craft.alive && target.kind === "pilot") sendCombatState(session, target);
  }

  function stepProjectiles(session: Session) {
    for (let index = session.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = session.projectiles[index]!;
      const source = session.actors.get(projectile.sourceActorId);
      if (!source || !source.craft.alive || projectile.life <= 0) {
        session.projectiles.splice(index, 1);
        continue;
      }
      const intended = projectile.homeId === null
        ? undefined
        : [...session.actors.values()].find((candidate) =>
            candidate.craft.id === projectile.homeId && candidate.craft.alive);
      if (projectile.missile) guideMissile(projectile, intended?.craft, ORBITAL_DT, source.craft);
      const from = { x: projectile.x, y: projectile.y ?? 0, z: projectile.z };
      projectile.x += projectile.vx * ORBITAL_DT;
      projectile.y = (projectile.y ?? 0) + (projectile.vy ?? 0) * ORBITAL_DT;
      projectile.z += projectile.vz * ORBITAL_DT;
      projectile.life -= ORBITAL_DT;
      const to = { x: projectile.x, y: projectile.y, z: projectile.z };
      const obstacle = firstWorldImpact(from, to, universeCollidersAt(from), projectile.r);
      const targets = [...session.actors.values()].filter((candidate) =>
        candidate.craft.alive && impactCombat(session, source, candidate));
      let impact: { target: Actor; time: number } | undefined;
      for (const target of targets) {
        if (target.actorId === projectile.sourceActorId) continue;
        const current = {
          x: target.craft.x,
          y: target.craft.space!.y,
          z: target.craft.z,
        };
        const time = movingSphereImpact(from, to, target.previousPosition ?? current,
          current, target.craft.radius + projectile.r);
        if (time !== null && (!impact || time < impact.time)) impact = { target, time };
      }
      if (obstacle && (!impact || obstacle.time <= impact.time)) {
        const point = { x: from.x + (to.x - from.x) * obstacle.time,
          y: from.y + (to.y - from.y) * obstacle.time, z: from.z + (to.z - from.z) * obstacle.time };
        broadcast(session, { type: "freeflight_world_impact",
          eventId: weaponEventId(session, projectile.id), to: point });
        session.projectiles.splice(index, 1);
      } else if (impact) {
        const point = { x: from.x + (to.x - from.x) * impact.time,
          y: from.y + (to.y - from.y) * impact.time, z: from.z + (to.z - from.z) * impact.time };
        applyProjectileHit(session, projectile, impact.target, from, point);
        session.projectiles.splice(index, 1);
      } else if (projectile.life <= 0) {
        session.projectiles.splice(index, 1);
      }
    }
  }

  function persistCompletedEncounter(session: Session, combat: LiveEncounter, defeated = false) {
    if (!combat.receipt) combat.receipt = combat.contract.finalize(
      session.tick, defeated ? "aborted" : "completed", !defeated,
    );
    if (!options.settleScoutEncounter || combat.settlementTask ||
        Date.now() < combat.nextSettlementAttemptAt) return;
    combat.phase = "settling";
    combat.settlementTask = (async () => {
      try {
        const settlement = await options.settleScoutEncounter!(combat.receipt!);
        if (settlement.status !== "settled" && settlement.status !== "duplicate") {
          throw new Error("freeflight_patrol_reward_not_settled");
        }
        const result = readExplorationReceipt(combat.receipt!);
        for (const pilotResult of result.pilots) {
          const actor = [...combat.participantActorIds]
            .map((actorId) => session.actors.get(actorId))
            .find((candidate) => candidate?.ownerUserId === pilotResult.playerId);
          if (!actor) continue;
          const award = settlement.awards.find((entry) => entry.playerId === pilotResult.playerId);
          if (!combat.resultsApplied) {
            actor.kills += pilotResult.kills;
            actor.assists += pilotResult.assists;
            actor.creditsAwarded += award?.credits ?? 0;
          }
          send(actor.socket, {
            type: "freeflight_combat_result",
            encounterId: combat.id,
            patrolId: combat.patrol.patrolId,
            phase: pilotHasActiveCombat(session, actor.actorId) ? "active" : "complete",
            status: "settled",
            kills: pilotResult.kills,
            assists: pilotResult.assists,
            creditsAwarded: award?.credits ?? 0,
            destroyedActorIds: pilotResult.destroyedActorIds,
            totals: { kills: actor.kills, assists: actor.assists, creditsAwarded: actor.creditsAwarded },
          });
        }
        combat.resultsApplied = true;
        combat.phase = "complete";
        session.nextPatrolRefreshAt = 0;
        sendEncounterState(session, combat, "complete");
      } catch {
        combat.phase = "settlement-unavailable";
        combat.nextSettlementAttemptAt = Date.now() + 5_000;
        sendEncounterState(session, combat, "settlement-unavailable");
      } finally {
        combat.settlementTask = null;
      }
    })();
  }

  function sendCombatState(session: Session, actor: Actor) {
    const encounters = liveCombats(session).filter((combat) =>
      combat.participantActorIds.has(actor.actorId));
    const active = encounters.filter((combat) => combat.phase === "active");
    send(actor.socket, {
      type: "freeflight_engagement_state",
      phase: active.length ? "active" : encounters.length ? "settling" : "idle",
      pilotAlive: actor.craft.alive,
      activeEncounterCount: active.length,
      kills: actor.kills, assists: actor.assists, creditsAwarded: actor.creditsAwarded,
    });
  }

  /** Refresh only idle opposing fleets after a rejected durable claim. Never
   * overwrite an active contract or import another saved location's contacts. */
  async function refreshRejectedPatrol(seat: Seat, contact: UniversePatrolEncounter): Promise<string> {
    if (!options.resolveUniversePatrols) return "freeflight_patrol_reservation_unavailable";
    try {
      const admission = await options.resolveAdmission(seat.userId);
      if (!admission || admission.sessionKey !== seat.session.key) return "freeflight_location_changed";
      const fresh = await options.resolveUniversePatrols(seat.userId, seat.actor.faction);
      const session = seat.session;
      if (closed || sessions.get(session.key) !== session ||
          userSeats.get(seat.userId) !== seat) return "freeflight_encounter_interrupted";
      const current = fresh.filter((patrol) =>
        patrol.locationId === contact.locationId && patrol.faction === contact.faction);
      let changed = false;
      for (const previous of session.persistentPatrols.values()) {
        if (previous.faction !== contact.faction ||
            session.combats.has(previous.patrolId) &&
            session.combats.get(previous.patrolId)!.phase !== "complete") continue;
        const replacement = current.find((patrol) => patrol.patrolId === previous.patrolId);
        const sameRoster = replacement && previous.ships.length === replacement.ships.length &&
          previous.ships.every((ship) => replacement.ships.some(
            (next) => next.id === ship.id && next.hullId === ship.hullId));
        if (sameRoster) continue;
        for (const actor of session.actors.values()) {
          if (actor.persistentPatrolId === previous.patrolId) session.actors.delete(actor.actorId);
        }
        session.persistentPatrols.delete(previous.patrolId);
        changed ||= previous.patrolId === contact.patrolId;
      }
      for (const patrol of current) {
        if (!session.persistentPatrols.has(patrol.patrolId) &&
            session.actors.size + patrol.ships.length <= MAX_ACTORS_PER_SESSION) {
          addPersistentPatrol(session, patrol, options.patrolSpawnDistanceMeters);
        }
      }
      publish(session);
      return !current.some((patrol) => patrol.patrolId === contact.patrolId)
        ? "freeflight_patrol_departed"
        : changed ? "freeflight_patrol_roster_changed" : "freeflight_patrol_reservation_unavailable";
    } catch {
      return "freeflight_patrol_refresh_unavailable";
    }
  }

  function inviteIsValid(session: Session, actor: Actor, combat: LiveEncounter, callId: string) {
    const invite = session.assistCalls.get(callId);
    const caller = invite ? session.actors.get(invite.callerActorId) : undefined;
    const target = invite ? session.actors.get(invite.targetActorId) : undefined;
    return Boolean(invite && invite.expiresAt > Date.now() &&
      invite.encounterId === combat.id && invite.patrolId === combat.patrol.patrolId &&
      invite.invitedActorIds.has(actor.actorId) && actor.faction === combat.faction &&
      combat.phase === "active" && combat.participantActorIds.has(invite.callerActorId) &&
      caller?.kind === "pilot" && target?.kind === "patrol" && target.craft.alive &&
      target.persistentPatrolId === combat.patrol.patrolId &&
      distanceBetween(actor, target) <= PATROL_SENSOR_RANGE);
  }

  function requestWingAssist(socket: WebSocketLike, seat: Seat) {
    const { session, actor } = seat;
    const now = Date.now();
    const pilotCombats = activeCombats(session).filter((candidate) =>
      candidate.participantActorIds.has(actor.actorId));
    const selectedPatrolId = actor.selectedTargetActorId
      ? session.actors.get(actor.selectedTargetActorId)?.persistentPatrolId
      : undefined;
    const combat = pilotCombats.find((candidate) => candidate.patrol.patrolId === selectedPatrolId) ??
      pilotCombats.sort((a, b) => {
        const nearestDistance = (entry: LiveEncounter) => Math.min(
          ...[...session.actors.values()]
            .filter((candidate) => candidate.kind === "patrol" &&
              candidate.persistentPatrolId === entry.patrol.patrolId && candidate.craft.alive)
            .map((candidate) => distanceBetween(actor, candidate)),
          Infinity,
        );
        return nearestDistance(a) - nearestDistance(b) || a.id.localeCompare(b.id);
      })[0];
    if (!combat || !actor.craft.alive) {
      send(socket, {
        type: "freeflight_assist_call_result", delivered: 0, cooldownMs: 0,
        reason: "no_active_battle",
      });
      return;
    }
    const elapsed = now - (actor.lastAssistCallAt ?? -Infinity);
    if (elapsed < ASSIST_CALL_COOLDOWN_MS) {
      send(socket, {
        type: "freeflight_assist_call_result", delivered: 0,
        cooldownMs: ASSIST_CALL_COOLDOWN_MS - elapsed, reason: "cooldown",
      });
      return;
    }
    const target = [...session.actors.values()].find((candidate) =>
      candidate.kind === "patrol" && candidate.persistentPatrolId === combat.patrol.patrolId &&
      candidate.craft.alive);
    if (!target) {
      send(socket, {
        type: "freeflight_assist_call_result", delivered: 0, cooldownMs: 0,
        reason: "no_live_hostile",
      });
      return;
    }
    for (const [id, invite] of session.assistCalls) {
      if (invite.expiresAt <= now ||
          session.combats.get(invite.patrolId)?.id !== invite.encounterId) {
        session.assistCalls.delete(id);
      }
    }
    const invited = [...session.pilotByUser.values()].filter((candidate) =>
      candidate !== actor && candidate.faction === actor.faction && candidate.craft.alive &&
      candidate.socket?.readyState === OPEN &&
      !activeCombats(session).some((active) => active.participantActorIds.has(candidate.actorId)) &&
      distanceBetween(candidate, target) <= NEARBY_RADIUS,
    ).slice(0, MAX_ENCOUNTER_PILOTS);
    actor.lastAssistCallAt = now;
    if (!invited.length) {
      send(socket, {
        type: "freeflight_assist_call_result", delivered: 0,
        cooldownMs: ASSIST_CALL_COOLDOWN_MS, reason: "no_friendly_pilots_in_range",
      });
      return;
    }
    const call: AssistCall = {
      id: randomUUID(),
      encounterId: combat.id,
      patrolId: combat.patrol.patrolId,
      callerActorId: actor.actorId,
      targetActorId: target.actorId,
      expiresAt: now + ASSIST_CALL_TTL_MS,
      invitedActorIds: new Set(invited.map((pilot) => pilot.actorId)),
    };
    session.assistCalls.set(call.id, call);
    for (const pilot of invited) {
      send(pilot.socket, {
        type: "freeflight_assist_request",
        callId: call.id,
        callerCallsign: actor.callsign,
        patrolCallsign: combat.patrol.callsign,
        opposingFaction: combat.patrol.faction,
        expiresAt: call.expiresAt,
      });
    }
    send(socket, {
      type: "freeflight_assist_call_result", delivered: invited.length,
      cooldownMs: ASSIST_CALL_COOLDOWN_MS,
    });
  }

  async function respondToWingAssist(socket: WebSocketLike, seat: Seat, callId: string, accept: boolean) {
    const { session, actor } = seat;
    const call = session.assistCalls.get(callId);
    if (!call || !call.invitedActorIds.has(actor.actorId) || call.expiresAt <= Date.now()) {
      send(socket, { type: "error", reason: "freeflight_assist_call_expired" });
      return;
    }
    if (!accept) {
      call.invitedActorIds.delete(actor.actorId);
      send(session.actors.get(call.callerActorId)?.socket ?? null, {
        type: "freeflight_assist_call_update", callId, status: "declined",
      });
      if (!call.invitedActorIds.size) session.assistCalls.delete(callId);
      return;
    }
    const combat = session.combats.get(call.patrolId);
    if (!combat || !inviteIsValid(session, actor, combat, callId)) {
      send(socket, { type: "error", reason: "freeflight_assist_approach_required" });
      return;
    }
    await startEngagement(socket, seat, call.targetActorId, false, callId);
  }

  async function startEngagement(
    socket: WebSocketLike,
    seat: Seat,
    targetActorId: string,
    primaryFire = false,
    assistanceCallId?: string,
  ) {
    if (seat.session.engagementPending) {
      send(socket, { type: "error", reason: "freeflight_encounter_active" });
      sendCombatState(seat.session, seat.actor);
      return;
    }
    seat.session.engagementPending = true;
    try {
      await claimEngagement(socket, seat, targetActorId, primaryFire, assistanceCallId);
    } finally {
      seat.session.engagementPending = false;
    }
  }

  async function claimEngagement(
    socket: WebSocketLike,
    seat: Seat,
    targetActorId: string,
    primaryFire = false,
    assistanceCallId?: string,
  ) {
    const { session, actor } = seat;
    const error = (reason: string) => {
      send(socket, { type: "error", reason });
      // A secondary rejection must not strand an already-engaged pilot
      // without controls, including after a browser reconnect.
      sendCombatState(session, actor);
    };
    if (!options.reserveUniversePatrol || !options.settleScoutEncounter) {
      error("freeflight_combat_unavailable");
      return;
    }
    if (!/^[A-Za-z0-9_:-]{8,80}$/.test(targetActorId)) {
      error("invalid_freeflight_target");
      return;
    }
    const target = session.actors.get(targetActorId);
    if (!target || target.kind !== "patrol" || !target.persistentPatrolId ||
        !target.persistentShipId || target.faction === actor.faction || !target.craft.alive) {
      error("freeflight_target_unavailable");
      return;
    }
    const existingCombat = session.combats.get(target.persistentPatrolId);
    if (existingCombat?.phase === "active") {
      if (assistanceCallId && !inviteIsValid(session, actor, existingCombat, assistanceCallId)) {
        error("freeflight_assist_call_expired");
        return;
      }
      const joinRange = assistanceCallId ? PATROL_SENSOR_RANGE
        : primaryFire ? NEARBY_RADIUS : PATROL_ENGAGEMENT_RANGE;
      if (!actor.craft.alive || distanceBetween(actor, target) > joinRange) {
        error("freeflight_patrol_approach_required");
        return;
      }
      if (existingCombat.participantActorIds.has(actor.actorId)) {
        sendCombatState(session, actor);
        return;
      }
      // Admission may have changed through world travel since the socket joined.
      const admission = await options.resolveAdmission(seat.userId).catch(() => null);
      if (!admission || admission.sessionKey !== session.key ||
          admission.faction !== actor.faction || admission.shipId !== actor.shipId) {
        error("freeflight_location_changed");
        return;
      }
      if (closed || sessions.get(session.key) !== session || seats.get(socket) !== seat ||
          socket.readyState !== OPEN || !actor.craft.alive || !target.craft.alive ||
          existingCombat.phase !== "active" || existingCombat.faction !== actor.faction ||
          existingCombat.participantActorIds.size >= MAX_ENCOUNTER_PILOTS ||
          distanceBetween(actor, target) > joinRange ||
          assistanceCallId && !inviteIsValid(session, actor, existingCombat, assistanceCallId)) {
        error("freeflight_encounter_participant_unavailable");
        return;
      }
      existingCombat.contract.addPilot({
        id: encounterActorId(actor), faction: actor.faction,
        hull: actor.craft.hullMax, playerId: seat.userId,
      }, session.tick);
      existingCombat.participantActorIds.add(actor.actorId);
      if (assistanceCallId) {
        const call = session.assistCalls.get(assistanceCallId);
        call?.invitedActorIds.delete(actor.actorId);
        if (call && !call.invitedActorIds.size) session.assistCalls.delete(assistanceCallId);
        send(session.actors.get(call?.callerActorId ?? "")?.socket ?? null, {
          type: "freeflight_assist_call_update",
          callId: assistanceCallId,
          status: "accepted",
          pilotCallsign: actor.callsign,
        });
      }
      send(socket, {
        type: "freeflight_engagement_started", encounterId: existingCombat.id,
        patrolId: existingCombat.patrol.patrolId, callsign: existingCombat.patrol.callsign,
        opposingFaction: target.faction, assistance: true, reinforcement: false,
      });
      for (const participantId of existingCombat.participantActorIds) {
        send(session.actors.get(participantId)?.socket ?? null, {
          type: "freeflight_ally_joined", encounterId: existingCombat.id,
          participantCount: existingCombat.participantActorIds.size,
        });
      }
      sendCombatState(session, actor);
      publish(session);
      return;
    }
    if (assistanceCallId) {
      error("freeflight_assist_call_expired");
      return;
    }
    if (existingCombat && existingCombat.phase !== "complete") {
      error("freeflight_encounter_active");
      return;
    }
    if (liveCombats(session).length >= MAX_ACTIVE_ENCOUNTERS) {
      error("freeflight_encounter_capacity");
      return;
    }
    const distanceToTarget = distanceBetween(actor, target);
    const joinedBattle = activeCombats(session).some((combat) =>
      combat.participantActorIds.has(actor.actorId),
    );
    const hostileSignal = actor.input.fire || actor.input.missile ||
      target.lastDamageTick >= 0 && target.lastDamageTick >= session.tick - 45;
    const reinforcementApproach = joinedBattle && hostileSignal &&
      distanceToTarget <= PATROL_SENSOR_RANGE;
    const engagementRange = primaryFire
      ? NEARBY_RADIUS
      : reinforcementApproach ? PATROL_SENSOR_RANGE : PATROL_ENGAGEMENT_RANGE;
    if (distanceToTarget > engagementRange) {
      error("freeflight_patrol_approach_required");
      return;
    }
    const contact = session.persistentPatrols.get(target.persistentPatrolId);
    if (!contact || contact.faction !== target.faction) {
      error("freeflight_patrol_unavailable");
      return;
    }
    const participants = [...session.pilotByUser.values()]
      .filter((candidate) => candidate.faction === actor.faction &&
        candidate.craft.alive && candidate.socket?.readyState === OPEN &&
        (distanceBetween(candidate, target) <= PATROL_SENSOR_RANGE ||
          primaryFire && candidate.actorId === actor.actorId))
      .sort((a, b) => (a.actorId === actor.actorId ? -1 : b.actorId === actor.actorId ? 1 : 0) ||
        a.actorId.localeCompare(b.actorId))
      .slice(0, MAX_ENCOUNTER_PILOTS);
    if (!participants.some((candidate) => candidate.actorId === actor.actorId)) {
      error("freeflight_encounter_participant_unavailable");
      return;
    }
    const encounterId = randomUUID();
    let reserved: UniversePatrolEncounter | null;
    try {
      reserved = await options.reserveUniversePatrol(
        participants.map((candidate) => candidate.ownerUserId!).filter(Boolean),
        actor.faction,
        { patrolId: contact.patrolId, locationId: contact.locationId, faction: contact.faction },
        encounterId,
      );
    } catch {
      error("freeflight_patrol_reservation_failed");
      return;
    }
    if (!reserved || reserved.patrolId !== contact.patrolId ||
        reserved.faction !== contact.faction || reserved.locationId !== contact.locationId) {
      if (reserved) {
        await options.releaseUniversePatrol?.(reserved.patrolId, encounterId).catch(() => {});
      }
      error(await refreshRejectedPatrol(seat, contact));
      return;
    }
    if (closed || sessions.get(session.key) !== session || seats.get(socket) !== seat ||
        socket.readyState !== OPEN || !actor.craft.alive || !target.craft.alive ||
        distanceBetween(actor, target) > engagementRange) {
      await options.releaseUniversePatrol?.(reserved.patrolId, encounterId).catch(() => {});
      error("freeflight_encounter_interrupted");
      return;
    }
    const currentPatrolActors = [...session.actors.values()].filter((candidate) =>
      candidate.persistentPatrolId === reserved.patrolId && candidate.craft.alive);
    const rosterMatches = reserved.ships.length > 0 &&
      currentPatrolActors.length === reserved.ships.length &&
      new Set(reserved.ships.map((ship) => ship.id)).size === reserved.ships.length &&
      reserved.ships.every((ship) => currentPatrolActors.some((candidate) =>
        candidate.persistentShipId === ship.id && candidate.shipId === ship.hullId));
    if (!rosterMatches) {
      await options.releaseUniversePatrol?.(reserved.patrolId, encounterId).catch(() => {});
      await refreshRejectedPatrol(seat, contact);
      error("freeflight_patrol_roster_changed");
      return;
    }
    if (session.combats.get(reserved.patrolId)?.phase !== undefined &&
        session.combats.get(reserved.patrolId)?.phase !== "complete") {
      await options.releaseUniversePatrol?.(reserved.patrolId, encounterId).catch(() => {});
      error("freeflight_encounter_active");
      return;
    }
    if (liveCombats(session).length >= MAX_ACTIVE_ENCOUNTERS) {
      await options.releaseUniversePatrol?.(reserved.patrolId, encounterId).catch(() => {});
      error("freeflight_encounter_capacity");
      return;
    }
    session.persistentPatrols.set(reserved.patrolId, reserved);
    const participantActorIds = new Set(participants.map((candidate) => candidate.actorId));
    const contract = new ExplorationEncounter({
      encounterId,
      missionId: "universe-patrol",
      sectorId: reserved.locationId,
      runtime: "orbital-v5",
      authority: "server",
      mode: "universe-exploration",
      patrol: {
        patrolId: reserved.patrolId,
        locationId: reserved.locationId,
        faction: reserved.faction,
      },
      actors: [
        ...participants.map((candidate) => ({
          id: encounterActorId(candidate),
          faction: candidate.faction,
          hull: candidate.craft.hullMax,
          playerId: candidate.ownerUserId!,
        })),
        ...reserved.ships.map((ship) => ({
          id: patrolShipActorId(ship.id),
          faction: reserved!.faction,
          hull: SHIPS[ship.hullId as ShipId].hull,
          rewardEligible: true,
        })),
      ],
      rewardPolicy: {
        id: "universe-patrol-bounty-v1",
        creditsPerNpcKill: 12,
        completionCredits: 0,
        maxCreditsPerEncounter: 48,
      },
    });
    const reinforcement = liveCombats(session).length > 0;
    session.combats.set(reserved.patrolId, {
      id: encounterId, faction: actor.faction, patrol: reserved, contract,
      participantActorIds, phase: "active", nextSettlementAttemptAt: 0,
      settlementTask: null, resultsApplied: false,
    });
    for (const participant of participants) {
      send(participant.socket, {
        type: "freeflight_engagement_started",
        encounterId,
        patrolId: reserved.patrolId,
        callsign: reserved.callsign,
        opposingFaction: reserved.faction,
        reinforcement,
      });
    }
    publish(session);
  }

  function maybeStartAutomaticEngagement(session: Session) {
    const now = Date.now();
    if (session.engagementPending || now < session.nextAutoEngagementAt) return;
    session.nextAutoEngagementAt = now + 750;
    const active = activeCombats(session);
    for (const combat of active) {
      if (combat.participantActorIds.size >= MAX_ENCOUNTER_PILOTS) continue;
      for (const pilot of session.pilotByUser.values()) {
        if (!pilot.craft.alive || pilot.faction !== combat.faction ||
            pilot.socket?.readyState !== OPEN || combat.participantActorIds.has(pilot.actorId)) continue;
        const target = [...session.actors.values()].find((candidate) =>
          candidate.persistentPatrolId === combat.patrol.patrolId && candidate.craft.alive &&
          distanceBetween(pilot, candidate) <= PATROL_ENGAGEMENT_RANGE);
        const seat = seats.get(pilot.socket);
        if (target && seat) {
          void startEngagement(pilot.socket, seat, target.actorId);
          return;
        }
      }
    }
    if (liveCombats(session).length >= MAX_ACTIVE_ENCOUNTERS) return;
    for (const patrol of session.actors.values()) {
      if (patrol.kind !== "patrol" || !patrol.persistentPatrolId ||
          !patrol.craft.alive || session.combats.get(patrol.persistentPatrolId)?.phase !== undefined &&
          session.combats.get(patrol.persistentPatrolId)?.phase !== "complete" ||
          (session.autoEngagementCooldowns.get(patrol.persistentPatrolId) ?? 0) > now) continue;
      let initiatingPilot: Actor | undefined;
      for (const pilot of session.pilotByUser.values()) {
        if (pilot.faction === patrol.faction || !pilot.craft.alive ||
            pilot.socket?.readyState !== OPEN) continue;
        const distance = distanceBetween(pilot, patrol);
        if (distance > PATROL_SENSOR_RANGE) continue;
        const closeApproach = distance <= PATROL_ENGAGEMENT_RANGE;
        const activeContact = active.some((combat) =>
          combat.participantActorIds.has(pilot.actorId),
        );
        const hostileSignal = pilot.input.fire || pilot.input.missile ||
          patrol.lastDamageTick >= 0 && patrol.lastDamageTick >= session.tick - 45;
        if (closeApproach || activeContact && hostileSignal) {
          initiatingPilot = pilot;
          break;
        }
      }
      const seat = initiatingPilot?.socket ? seats.get(initiatingPilot.socket) : undefined;
      if (!initiatingPilot?.socket || !seat) continue;
      session.autoEngagementCooldowns.set(patrol.persistentPatrolId, now + 5_000);
      void startEngagement(initiatingPilot.socket, seat, patrol.actorId);
      return;
    }
  }

  function tickSession(session: Session) {
    session.tick += 1;
    for (const actor of session.actors.values()) {
      if (!actor.craft.alive) continue;
      if (actor.kind === "patrol") {
        actor.scoutMemory = updateScoutMemory(
          { x: actor.craft.x, y: actor.craft.space!.y, z: actor.craft.z },
          actor.scoutMemory,
          [...session.pilotByUser.values()].map((pilot) => ({
            actorId: pilot.actorId,
            position: { x: pilot.craft.x, y: pilot.craft.space!.y, z: pilot.craft.z },
            hostile: pilot.faction !== actor.faction, alive: pilot.craft.alive,
            connected: pilot.socket?.readyState === OPEN,
            concealed: pilot.craft.cloak > 0 || pilot.craft.untargetable > 0,
          })),
          session.tick * ORBITAL_DT,
        );
      }
      const combat = actor.kind === "patrol" && actor.persistentPatrolId
        ? session.combats.get(actor.persistentPatrolId)
        : undefined;
      let patrolTarget: Actor | undefined;
      let nearestParticipantDistance = Infinity;
      if (actor.kind === "patrol" && combat?.phase === "active") {
        for (const actorId of combat.participantActorIds) {
          const candidate = session.actors.get(actorId);
          if (!candidate?.craft.alive || candidate.socket?.readyState !== OPEN) continue;
          const distance = distanceBetween(actor, candidate);
          if (distance < nearestParticipantDistance) {
            patrolTarget = candidate;
            nearestParticipantDistance = distance;
          }
        }
      }
      const baseInput = actor.kind === "patrol"
        ? patrolTarget && actor.scoutMemory?.mode === "tracking" &&
            actor.scoutMemory.actorId === patrolTarget.actorId
          ? patrolCombatInput(actor, patrolTarget)
          : patrolInput(actor, actor.scoutMemory
            ? scoutDestination(actor.scoutMemory, session.tick * ORBITAL_DT) : undefined)
        : Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS ? IDLE : actor.input;
      if (actor.vectorBoost && (actor.socket?.readyState !== OPEN ||
          Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS)) actor.vectorBoost.remaining = 0;
      const input = actor.vectorBoost
        ? { ...baseInput, ...stepVectorBoost(actor.vectorBoost, baseInput, ORBITAL_DT) }
        : baseInput;
      const beforeMotion = { x: actor.craft.x, y: actor.craft.space!.y, z: actor.craft.z };
      actor.previousPosition = beforeMotion;
      integrateSpatialFlight(
        actor.craft, input, ORBITAL_DT, 1, [], SHIPS[actor.shipId],
        {
          boundaryRadius: null,
          gravityWells: session.gravityEnvironmentEnabled ? session.anomalyGravityWells : [],
        },
      );
      resolveUniverseMotion(actor.craft, beforeMotion, universeCollidersAt(beforeMotion));
      // Toggle commands apply once per accepted input, not on every 30Hz tick.
      if (actor.kind === "pilot") {
        actor.input.inertial = false;
        actor.input.aimAssist = false;
      }
      actor.primaryCooldown = Math.max(0, actor.primaryCooldown - ORBITAL_DT);
      actor.shield = recoverFreeFlightShield(
        actor.shield, actor.shieldMax, actor.lastDamageTick, session.tick,
      );
      fireWeapons(session, actor, input);
    }
    stepProjectiles(session);
    for (const combat of session.combats.values()) {
      if (combat.phase === "active" &&
          combat.patrol.ships.every((ship) => {
            const actor = session.actors.get(patrolShipActorId(ship.id));
            return !actor || !actor.craft.alive;
          })) {
        persistCompletedEncounter(session, combat);
      } else if (combat.phase === "active" &&
          [...combat.participantActorIds].every((actorId) =>
            session.actors.get(actorId)?.craft.alive === false)) {
        // Losing the entire wing must not leave an immortal active lease.
        // Another living ally keeps the shared battle active.
        persistCompletedEncounter(session, combat, true);
      } else if (combat.phase === "settlement-unavailable") {
        persistCompletedEncounter(session, combat);
      }
    }
    maybeStartAutomaticEngagement(session);
  }

  function detach(socket: WebSocketLike | null) {
    if (!socket) return;
    const seat = seats.get(socket);
    if (!seat) return;
    seats.delete(socket);
    if (seat.actor.socket !== socket) return;
    if (userSeats.get(seat.userId)?.actor === seat.actor) userSeats.delete(seat.userId);
    seat.actor.socket = null;
    seat.actor.input = { ...IDLE };
    seat.actor.disconnectedAt = Date.now();
    if (refreshGravityEnvironment(seat.session)) broadcastEnvironment(seat.session);
    seat.session.emptySince = [...seat.session.actors.values()].every((actor) =>
      actor.kind !== "pilot" || actor.socket?.readyState !== OPEN,
    ) ? Date.now() : null;
    void persistSessionFresh(seat.session);
  }

  async function handle(socket: WebSocketLike, userId: string, packet: Record<string, unknown>) {
    const error = (reason: string, recovery?: {
      protocol: 1; mode: "location" | "loadout"; shipId: ShipId; faction: Faction;
      alive: boolean; locationKey: string;
    }) => send(socket, { type: "error", reason, ...(recovery ? { recovery } : {}) });
    if (closed) { error("server_restart"); return; }
    if (packet.type === "freeflight_join") {
      if (Object.keys(packet).some((key) => key !== "type" && key !== "openingEncounter") ||
          (packet.openingEncounter !== undefined && packet.openingEncounter !== true) ||
          seats.has(socket) || joiningUsers.has(userId)) {
        error("invalid_freeflight_join");
        return;
      }
      joiningUsers.add(userId);
      try {
        const admission = await options.resolveAdmission(userId);
        if (socket.readyState !== OPEN) return;
        if (!admission || !validSessionKey(admission.sessionKey) ||
            (admission.faction !== "ussf" && admission.faction !== "accord") ||
            !Object.hasOwn(SHIPS, admission.shipId) ||
            SHIPS[admission.shipId].faction !== admission.faction) {
          error("freeflight_not_authorized");
          return;
        }
        const now = Date.now();
        let initialPatrols: UniversePatrolEncounter[] = [];
        // Recheck on admission even when this session already exists. A first
        // lookup can legitimately be empty or temporarily unavailable; later
        // joins must be able to see durable patrols without resetting any
        // existing actors, contracts, casualties or attribution.
        if (options.resolveUniversePatrols || options.resolveUniversePatrol) {
          try {
            const [ussfPatrols, accordPatrols] = options.resolveUniversePatrols
              ? await Promise.all([
                  options.resolveUniversePatrols(userId, "ussf"),
                  options.resolveUniversePatrols(userId, "accord"),
                ])
              : await Promise.all([
                  options.resolveUniversePatrol!(userId, "ussf"),
                  options.resolveUniversePatrol!(userId, "accord"),
                ]).then((resolved) => resolved.map((patrol) => patrol ? [patrol] : []));
            initialPatrols = [...new Map(
              [...ussfPatrols, ...accordPatrols].map((patrol) => [patrol.patrolId, patrol]),
            ).values()].slice(0, MAX_ACTIVE_ENCOUNTERS * 2);
          } catch {
            // Flight remains available if the patrol directory is unavailable;
            // only persistent reward-bearing engagements fail closed.
          }
        }
        const existing = userSeats.get(userId);
        if (existing && existing.actor.socket?.readyState === OPEN && existing.actor.socket !== socket) {
          existing.actor.socket.close(4001, "Pilot reconnected");
        }
        for (const previous of sessions.values()) {
          if (previous.key === admission.sessionKey) continue;
          const prior = previous.pilotByUser.get(userId);
          if (!prior) continue;
          if (pilotNeedsRecovery(prior) || pilotHasUnresolvedCombat(previous, prior.actorId)) {
            error("freeflight_recovery_required", { protocol: 1, mode: "location",
              shipId: prior.shipId, faction: prior.faction, alive: prior.craft.alive,
              locationKey: previous.key });
            return;
          }
          if (prior.socket?.readyState === OPEN && prior.socket !== socket) {
            error("freeflight_session_already_active");
            return;
          }
          previous.actors.delete(prior.actorId);
          previous.pilotByUser.delete(userId);
        }
        if (closed || socket.readyState !== OPEN) return;
        const session = await getOrInitializeSession(
          admission.sessionKey, now, initialPatrols,
        );
        if (closed) { error("freeflight_service_unavailable"); return; }
        if (!session) { error("freeflight_capacity"); return; }
        let actor = session.pilotByUser.get(userId);
        let openingTarget: Actor | undefined;
        let openingStatus: "ready" | "resumed" | "unavailable" | undefined =
          packet.openingEncounter === true ? (actor ? "resumed" : "unavailable") : undefined;
        if (!actor) {
          if (session.pilotByUser.size >= MAX_PILOTS_PER_SESSION ||
              session.actors.size >= MAX_ACTORS_PER_SESSION) {
            error("freeflight_session_full");
            return;
          }
          const index = session.pilotByUser.size;
          const numericId = session.nextNumericId++;
          actor = {
            actorId: `pilot:${randomUUID()}`,
            numericId, kind: "pilot", faction: admission.faction, shipId: admission.shipId,
            craft: craftFor(numericId, admission.shipId, ((index % 5) - 2) * 14, 0, -Math.floor(index / 5) * 18),
            shield: SHIPS[admission.shipId].shield, shieldMax: SHIPS[admission.shipId].shield,
            ownerUserId: userId, socket: null, callsign: "Pilot", input: { ...IDLE },
            lastInputAt: now, lastSeq: 0, inputWindowAt: now, inputCount: 0,
            disconnectedAt: null, waypointIndex: 0, waypoints: [],
            primaryCooldown: 0, lastDamageTick: -1, kills: 0, assists: 0, creditsAwarded: 0,
            gravityEnvironmentV1: false,
          };
          // Only a genuinely new seat may receive the opening insertion.
          // Never move/heal a retained actor, reset a roster or mint a fleet.
          if (packet.openingEncounter === true &&
              options.reserveUniversePatrol && options.settleScoutEncounter) {
            openingTarget = [...session.actors.values()]
              .filter((candidate) => candidate.kind === "patrol" &&
                candidate.persistentPatrolId && candidate.persistentShipId &&
                candidate.faction !== admission.faction && candidate.craft.alive &&
                distanceBetween(actor!, candidate) <= 700 &&
                (!session.combats.has(candidate.persistentPatrolId) ||
                  session.combats.get(candidate.persistentPatrolId)?.phase === "active" ||
                  session.combats.get(candidate.persistentPatrolId)?.phase === "complete"))
              .sort((a, b) => distanceBetween(actor!, a) - distanceBetween(actor!, b) ||
                a.actorId.localeCompare(b.actorId))[0];
            if (openingTarget) {
              const target = openingTarget.craft;
              const dx = target.x - actor.craft.x;
              const dz = target.z - actor.craft.z;
              const length = detHypot(dx, dz) || 1;
              const lateral = ((index % 5) - 2) * 10;
              const x = target.x - dx / length * 145 - dz / length * lateral;
              const z = target.z - dz / length * 145 + dx / length * lateral;
              actor.craft = craftFor(numericId, admission.shipId, x, target.space!.y, z,
                detAtan2(-(target.x - x), -(target.z - z)));
              openingStatus = "ready";
            }
          }
          session.actors.set(actor.actorId, actor);
          session.pilotByUser.set(userId, actor);
        } else if (actor.craft.alive &&
            (actor.faction !== admission.faction || actor.shipId !== admission.shipId)) {
          if (pilotNeedsRecovery(actor) || pilotHasUnresolvedCombat(session, actor.actorId)) {
            error("freeflight_recovery_required", { protocol: 1, mode: "loadout",
              shipId: actor.shipId, faction: actor.faction, alive: actor.craft.alive,
              locationKey: session.key });
            return;
          }
          // Only an undamaged, unengaged craft can be refitted on rejoin.
          actor.faction = admission.faction;
          actor.shipId = admission.shipId;
          actor.craft = craftFor(actor.numericId, admission.shipId, actor.craft.x, actor.craft.space!.y, actor.craft.z, actor.craft.yaw);
          actor.shield = SHIPS[admission.shipId].shield;
          actor.shieldMax = SHIPS[admission.shipId].shield;
        }
        const previousSeat = userSeats.get(userId);
        if (previousSeat) seats.delete(previousSeat.actor.socket!);
        actor.socket = socket;
        actor.gravityEnvironmentV1 = false;
        actor.disconnectedAt = null;
        actor.lastInputAt = now;
        actor.input = { ...IDLE };
        const seat = { session, actor, userId };
        seats.set(socket, seat);
        userSeats.set(userId, seat);
        session.emptySince = null;
        const environmentChanged = refreshGravityEnvironment(session);
        send(socket, {
          type: "freeflight_joined",
          nextInputSeq: actor.lastSeq + 1,
          snapshot: snapshotFor(session, actor),
          environment: environmentFor(session),
          vectorBoost: {
            protocol: VECTOR_BOOST_PROTOCOL_V1,
            nextSeq: (actor.vectorBoostSeq ?? 0) + 1,
          },
          targeting: { protocol: FREE_FLIGHT_TARGETING_V1, nextSeq: (actor.targetCycleSeq ?? 0) + 1 },
          assistance: { protocol: FREE_FLIGHT_ASSIST_V1 },
          countermeasures: { protocol: 1, nextSeq: (actor.countermeasureSeq ?? 0) + 1,
            cooldownMs: Math.ceil((actor.craft.space!.countermeasureCd ?? 0) * 1000) },
          ...(openingStatus ? { openingEncounter: openingStatus } : {}),
        });
        sendCombatState(session, actor);
        if (environmentChanged) broadcastEnvironment(session, socket);
        publish(session);
        // Same lease, participants, weapons and settlement as later encounters.
        // Failures remain visible through the ordinary encounter-error channel.
        if (openingTarget) await startEngagement(socket, seat, openingTarget.actorId);
      } catch {
        error("freeflight_admission_unavailable");
      } finally {
        joiningUsers.delete(userId);
      }
      return;
    }

    const seat = seats.get(socket);
    if (!seat || seat.userId !== userId) { error("freeflight_join_required"); return; }
    if (packet.type === "freeflight_recover") {
      if (Object.keys(packet).length !== 1) {
        error("invalid_freeflight_recovery");
        return;
      }
      if (seat.actor.craft.alive) { error("freeflight_recovery_not_disabled"); return; }
      if (pilotHasUnresolvedCombat(seat.session, seat.actor.actorId)) {
        error("freeflight_recovery_pending_settlement");
        return;
      }
      // No client-selected destination, health, reward, ship or identity.
      const admission = await options.resolveAdmission(userId).catch(() => null);
      if (closed || seats.get(socket) !== seat || seat.actor.socket !== socket) return;
      if (!admission || admission.sessionKey !== seat.session.key) {
        error("freeflight_recovery_location_changed");
        return;
      }
      if (pilotHasUnresolvedCombat(seat.session, seat.actor.actorId)) {
        error("freeflight_recovery_pending_settlement");
        return;
      }
      detach(socket);
      seat.session.actors.delete(seat.actor.actorId);
      seat.session.pilotByUser.delete(userId);
      seat.session.projectiles = seat.session.projectiles.filter(
        (projectile) => projectile.sourceActorId !== seat.actor.actorId,
      );
      // Next explicit deployment uses normal, server-derived anchor admission.
      // No living craft is spawned while the player is in the hangar.
      send(socket, { type: "freeflight_recovered" });
      publish(seat.session);
      return;
    }
    if (packet.type === "freeflight_countermeasure") {
      if (Object.keys(packet).length !== 3 || packet.protocol !== 1 ||
          !Number.isSafeInteger(packet.seq) || (packet.seq as number) <= (seat.actor.countermeasureSeq ?? 0) ||
          (packet.seq as number) > (seat.actor.countermeasureSeq ?? 0) + 256) {
        error("invalid_freeflight_countermeasure"); return;
      }
      seat.actor.countermeasureSeq = packet.seq as number;
      if (!seat.actor.craft.alive) { error("freeflight_pilot_destroyed"); return; }
      if (seat.session.tick - (seat.actor.lastCountermeasureTick ?? -100) < 5) {
        error("freeflight_rate_limited"); return;
      }
      seat.actor.lastCountermeasureTick = seat.session.tick;
      seat.actor.craft.space!.countermeasureCd ??= 0;
      const result = deployCountermeasure(seat.session.projectiles, { ...seat.actor.craft, faction: seat.actor.faction });
      send(socket, { type: "freeflight_countermeasure_state", protocol: 1, ...result,
        cooldownMs: Math.ceil((seat.actor.craft.space!.countermeasureCd ?? 0) * 1000) });
      return;
    }
    if (packet.type === "freeflight_environment_request") {
      if (Object.keys(packet).length !== 1) {
        error("invalid_freeflight_environment_request");
        return;
      }
      seat.actor.gravityEnvironmentV1 = true;
      refreshGravityEnvironment(seat.session);
      broadcastEnvironment(seat.session);
      return;
    }
    if (packet.type === "freeflight_engage") {
      if (Object.keys(packet).length !== 2 || typeof packet.targetActorId !== "string") {
        error("invalid_freeflight_engage");
        return;
      }
      await startEngagement(socket, seat, packet.targetActorId);
      return;
    }
    if (packet.type === "freeflight_assist_call") {
      if (Object.keys(packet).length !== 2 || packet.protocol !== FREE_FLIGHT_ASSIST_V1) {
        error("invalid_freeflight_assist_call");
        return;
      }
      requestWingAssist(socket, seat);
      return;
    }
    if (packet.type === "freeflight_assist_response") {
      if (Object.keys(packet).length !== 4 || packet.protocol !== FREE_FLIGHT_ASSIST_V1 ||
          typeof packet.callId !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(packet.callId) ||
          typeof packet.accept !== "boolean") {
        error("invalid_freeflight_assist_response");
        return;
      }
      await respondToWingAssist(socket, seat, packet.callId, packet.accept);
      return;
    }
    if (packet.type === "freeflight_target_cycle") {
      const actor = seat.actor;
      if (Object.keys(packet).length !== 3 || packet.protocol !== FREE_FLIGHT_TARGETING_V1 ||
          !Number.isSafeInteger(packet.seq) || (packet.seq as number) < 1 ||
          (packet.seq as number) > 0x7fffffff ||
          (packet.seq as number) <= (actor.targetCycleSeq ?? 0)) {
        error("invalid_freeflight_target_cycle");
        return;
      }
      const now = Date.now();
      if (now - (actor.lastTargetCycleAt ?? -Infinity) < 125) {
        error("freeflight_target_cycle_rate_limited");
        return;
      }
      actor.targetCycleSeq = packet.seq as number;
      actor.lastTargetCycleAt = now;
      const candidates = [...seat.session.actors.values()]
        .filter(candidate => eligiblePilotTarget(seat.session, actor, candidate));
      const target = cycleFreeFlightTarget(candidates, actor.selectedTargetActorId ?? null) ?? undefined;
      const changed = actor.selectedTargetActorId !== (target?.actorId ?? null);
      actor.selectedTargetActorId = target?.actorId ?? null;
      actor.craft.lockTargetId = target?.numericId ?? null;
      if (changed) {
        actor.craft.space!.lockProgress = 0;
      }
      sendTargetState(seat.session, actor);
      return;
    }
    if (packet.type === "freeflight_vector_boost") {
      if (Object.keys(packet).length !== 4 || packet.protocol !== VECTOR_BOOST_PROTOCOL_V1 ||
          !Number.isSafeInteger(packet.seq) || (packet.seq as number) <= (seat.actor.vectorBoostSeq ?? 0) ||
          !isVectorBoostDirection(packet.direction)) {
        error("invalid_freeflight_vector_boost");
        return;
      }
      seat.actor.vectorBoostSeq = packet.seq as number;
      const actor = seat.actor;
      actor.vectorBoost ??= newVectorBoost();
      const accepted = startVectorBoost(
        actor.vectorBoost, packet.direction, actor.craft.space?.energy ?? 0,
        !actor.craft.alive || actor.craft.root > 0 || actor.craft.jam > 0 ||
          (actor.craft.thrustMuted ?? 0) > 0 ||
          Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS,
      );
      send(socket, {
        type: "freeflight_vector_boost_state",
        protocol: VECTOR_BOOST_PROTOCOL_V1,
        accepted,
        cooldownMs: Math.ceil(actor.vectorBoost.cooldown * 1000),
        remainingMs: Math.ceil(actor.vectorBoost.remaining * 1000),
        energy: actor.craft.space?.energy ?? 0,
      });
      return;
    }
    if (packet.type === "freeflight_input") {
      if (Object.keys(packet).length !== 2 ||
          !packet.input || typeof packet.input !== "object" || Array.isArray(packet.input)) {
        error("invalid_freeflight_input");
        return;
      }
      const parsed = parseOrbitalInput(packet.input);
      if (!parsed.ok) { error(`freeflight_${parsed.reason}`); return; }
      const input = parsed.input;
      if (input.targetId !== null) {
        error("freeflight_target_selection_server_owned");
        return;
      }
      if ((input.fire || input.missile) && !seat.actor.craft.alive) {
        error("freeflight_pilot_destroyed");
        sendCombatState(seat.session, seat.actor);
        return;
      }
      if (input.missile && !pilotHasActiveCombat(seat.session, seat.actor.actorId)) {
        if (!input.fire) {
          error("freeflight_engagement_required");
          return;
        }
        // A held missile button must not suppress primary-fire admission for
        // the next fleet. Only the missile intent waits for a real contract.
        input.missile = false;
      }
      if (input.seq <= seat.actor.lastSeq || input.seq - seat.actor.lastSeq > 256) {
        error("freeflight_sequence");
        return;
      }
      const now = Date.now();
      if (now - seat.actor.inputWindowAt >= 1_000) {
        seat.actor.inputWindowAt = now;
        seat.actor.inputCount = 0;
      }
      seat.actor.inputCount += 1;
      if (seat.actor.inputCount > INPUT_RATE_LIMIT) { error("freeflight_rate_limited"); return; }
      seat.actor.lastSeq = input.seq;
      seat.actor.lastInputAt = now;
      seat.actor.input = {
        throttle: input.throttle, yaw: input.yaw, pitch: input.pitch, strafe: input.strafe,
        vertical: input.vertical, roll: input.roll, boost: input.boost, brake: input.brake,
        drift: input.drift, inertial: input.inertial, aimAssist: input.aimAssist,
        fire: input.fire, missile: input.missile, targetId: null,
      };
      // Accepted intent is not proof of a projectile or a hit.
      send(socket, {
        type: "freeflight_input_accepted", seq: input.seq,
        fire: input.fire, missile: input.missile, pilotAlive: seat.actor.craft.alive,
      });
      if (input.fire && !pilotHasActiveCombat(seat.session, seat.actor.actorId)) {
        const target = primaryFireTarget(seat.session, seat.actor);
        if (target) {
          const admission = await options.resolveAdmission(userId).catch(() => null);
          if (!admission || admission.sessionKey !== seat.session.key ||
              admission.faction !== seat.actor.faction || admission.shipId !== seat.actor.shipId) {
            error("freeflight_location_changed");
            sendCombatState(seat.session, seat.actor);
            return;
          }
          await startEngagement(socket, seat, target.actorId, true);
        }
      }
      return;
    }
    if (packet.type === "freeflight_ping" && Object.keys(packet).length === 2 &&
        Number.isSafeInteger(packet.nonce) && (packet.nonce as number) > 0) {
      send(socket, { type: "freeflight_pong", nonce: packet.nonce });
      return;
    }
    error("freeflight_unknown_message");
  }

  /** Refresh location-owned fleets without scene changes, actor resets or
   * replacing active/settling leases. One outstanding read per session. */
  async function refreshPatrolDirectory(session: Session, now: number) {
    if (!options.resolveUniversePatrols || session.patrolRefreshPending ||
        session.engagementPending || now < session.nextPatrolRefreshAt) return;
    const pilot = [...session.pilotByUser.values()].find((actor) =>
      actor.craft.alive && actor.socket?.readyState === OPEN && actor.ownerUserId);
    if (!pilot?.ownerUserId) return;
    session.patrolRefreshPending = true;
    session.nextPatrolRefreshAt = now + PATROL_REFRESH_INTERVAL_MS;
    const pilotUserId = pilot.ownerUserId;
    // A lookup begun during settlement must not reimport its pre-commit roster.
    const protectedPatrols = new Set(liveCombats(session).map((combat) => combat.patrol.patrolId));
    try {
      const admission = await options.resolveAdmission(pilotUserId);
      if (!admission || admission.sessionKey !== session.key) return;
      const groups = await Promise.all([
        options.resolveUniversePatrols(pilotUserId, "ussf"),
        options.resolveUniversePatrols(pilotUserId, "accord"),
      ]);
      const currentAdmission = await options.resolveAdmission(pilotUserId);
      if (closed || sessions.get(session.key) !== session ||
          pilot.socket?.readyState !== OPEN ||
          !currentAdmission || currentAdmission.sessionKey !== session.key ||
          session.engagementPending) return;
      const fresh = new Map(groups.flat().map((patrol) => [patrol.patrolId, patrol]));
      for (const previous of [...session.persistentPatrols.values()]) {
        const combat = session.combats.get(previous.patrolId);
        if (protectedPatrols.has(previous.patrolId) || combat && combat.phase !== "complete") continue;
        const actors = [...session.actors.values()].filter((actor) =>
          actor.persistentPatrolId === previous.patrolId);
        const next = fresh.get(previous.patrolId);
        if (combat?.phase === "complete" && actors.every((actor) => !actor.craft.alive)) {
          for (const actor of actors) session.actors.delete(actor.actorId);
          session.persistentPatrols.delete(previous.patrolId);
          continue;
        }
        for (const actor of actors) {
          if (!next?.ships.some((ship) =>
            ship.id === actor.persistentShipId && ship.hullId === actor.shipId)) {
            session.actors.delete(actor.actorId);
          }
        }
        session.persistentPatrols.delete(previous.patrolId);
      }
      for (const patrol of fresh.values()) {
        if (protectedPatrols.has(patrol.patrolId) ||
            session.combats.get(patrol.patrolId)?.phase === "complete" &&
              ![...session.actors.values()].some((actor) =>
                actor.persistentPatrolId === patrol.patrolId && actor.craft.alive)) continue;
        addPersistentPatrol(session, patrol, options.patrolSpawnDistanceMeters);
      }
      publish(session);
    } catch {
      // Keep existing flight and leases intact; reservation still revalidates
      // every target. Never invent enemies from a directory failure.
      process.stderr.write('{"event":"freeflight_patrol_refresh_unavailable"}\n');
    } finally {
      session.patrolRefreshPending = false;
    }
  }

  function advance(now = Date.now()) {
    if (closed) return;
    for (const [key, session] of sessions) {
      const elapsed = Math.max(0, Math.min(250, now - session.lastAdvanceAt));
      session.lastAdvanceAt = now;
      void refreshPatrolDirectory(session, now);
      session.accumulatorMs += elapsed;
      let steps = 0;
      while (session.accumulatorMs >= 1_000 / TICK_RATE && steps < 8) {
        tickSession(session);
        session.accumulatorMs -= 1_000 / TICK_RATE;
        steps += 1;
      }
      for (const actor of [...session.actors.values()]) {
        if (actor.kind === "pilot" && actor.disconnectedAt !== null &&
            now - actor.disconnectedAt > DISCONNECT_GRACE_MS &&
            !pilotNeedsRecovery(actor) &&
            !pilotHasUnresolvedCombat(session, actor.actorId)) {
          session.actors.delete(actor.actorId);
          if (actor.ownerUserId) session.pilotByUser.delete(actor.ownerUserId);
        }
      }
      if (session.pilotByUser.size === 0) {
        session.emptySince ??= now;
        if (now - session.emptySince > EMPTY_SESSION_TTL_MS) {
          for (const combat of session.combats.values()) {
            if (combat.phase !== "complete") {
              void options.releaseUniversePatrol?.(combat.patrol.patrolId, combat.id).catch(() => {});
            }
          }
          sessions.delete(key);
          continue;
        }
      }
      if (now - session.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
        session.lastSnapshotAt = now;
        publish(session);
      }
      const checkpointActive = session.pilotByUser.size > 0 ||
        [...session.combats.values()].some((combat) => combat.phase !== "complete");
      if (options.saveCheckpoint && checkpointActive &&
          now - (lastCheckpointAt.get(key) ?? 0) >= 1_000) {
        void persistSession(session);
      }
    }
  }

  function setFencingToken(sessionKey: string, fencingToken: number) {
    if (!validSessionKey(sessionKey) || !Number.isSafeInteger(fencingToken) || fencingToken <= 0) {
      throw new Error("Invalid free-flight fencing token.");
    }
    fencingTokens.set(sessionKey, fencingToken);
  }

  function relinquishSession(sessionKey: string) {
    // Invalidate pending checkpoint loads too, even before a session exists.
    fencingTokens.delete(sessionKey);
    lastCheckpointAt.delete(sessionKey);
    const session = sessions.get(sessionKey);
    if (!session) return;
    for (const actor of session.pilotByUser.values()) {
      const socket = actor.socket;
      if (!socket) continue;
      send(socket, { type: "freeflight_interrupted", reason: "session_owner_changed" });
      const seat = seats.get(socket);
      if (seat) {
        seats.delete(socket);
        if (userSeats.get(seat.userId) === seat) userSeats.delete(seat.userId);
      }
      actor.socket = null;
      socket.close(1012, "Free-flight session owner changed");
    }
    sessions.delete(sessionKey);
  }

  async function flushCheckpoints() {
    await Promise.allSettled([...sessionInitializations.values()]);
    await Promise.all([...sessions.values()].map(async (session) => {
      await checkpointPending.get(session.key);
    }));
    const results = await Promise.all([...sessions.values()].map(persistSession));
    if (results.some((saved) => !saved)) {
      throw new Error("One or more free-flight checkpoints could not be persisted.");
    }
  }

  async function close() {
    closed = true;
    for (const socket of seats.keys()) {
      send(socket, { type: "freeflight_interrupted", reason: "server_restart" });
      socket.close(1001, "Server shutting down");
    }
    await flushCheckpoints();
    if (!options.retainEncounterReservationsOnClose) {
      await Promise.all([...sessions.values()].flatMap((session) =>
        [...session.combats.values()]
          .filter((combat) => combat.phase !== "complete" && options.releaseUniversePatrol)
          .map((combat) =>
            options.releaseUniversePatrol!(combat.patrol.patrolId, combat.id).catch(() => {}),
          ),
      ));
    }
    seats.clear();
    userSeats.clear();
    sessions.clear();
  }

  return {
    handle,
    detach,
    advance,
    close,
    setFencingToken,
    relinquishSession,
    hasUser(userId: string) { return userSeats.has(userId); },
    get sessionCount() { return sessions.size; },
    get pilotCount() { return userSeats.size; },
  };
}
