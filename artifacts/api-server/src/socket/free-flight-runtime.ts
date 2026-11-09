import { randomUUID } from "node:crypto";
import { scoutDestination, updateScoutMemory, type ScoutMemory } from "./patrol-awareness";
import {
  ORBITAL_DT,
  ORBITAL_RULES_VERSION,
  FREE_FLIGHT_PROTOCOL_V1,
  FREE_FLIGHT_ENVIRONMENT_PROTOCOL_V1,
  MISSILE_CATALOG,
  PRIMARY_WEAPON_CATALOG,
  acquireTarget,
  applyHullDamage,
  detAtan2,
  detCos,
  detHypot,
  detSin,
  guideMissile,
  integrateSpatialFlight,
  anomalyGravityWellForSector,
  newFlight,
  parseOrbitalInput,
  rotate,
  spawnMissileVolley,
  spawnPrimaryVolley,
  sphereSweepTime,
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
const PATROL_ENGAGEMENT_RANGE = 180;
const PATROL_SENSOR_RANGE = 520;
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
};
type Seat = { session: Session; actor: Actor; userId: string };

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
  if (session.actors.size + knownShips.length > MAX_ACTORS_PER_SESSION) return;
  const fleetOrdinal = session.persistentPatrols.size;
  const fleetRadius = radius + fleetOrdinal * 220;
  const baseAngle = (patrol.faction === "ussf" ? 0 : -Math.PI / 2) + fleetOrdinal * 0.48;
  const waypoints = Array.from({ length: 4 }, (_, point) => {
    const angle = baseAngle + point * Math.PI / 2;
    return { x: detCos(angle) * fleetRadius, y: 0, z: detSin(angle) * fleetRadius };
  });
  patrol.ships.forEach((ship, index) => {
    if (!Object.hasOwn(SHIPS, ship.hullId)) return;
    const shipId = ship.hullId as ShipId;
    const angle = baseAngle + index * 0.16;
    const numericId = session.nextNumericId++;
    const craft = craftFor(
      numericId, shipId,
      detCos(angle) * (fleetRadius + index * 12), 0,
      detSin(angle) * (fleetRadius + index * 12), angle + Math.PI / 2,
    );
    const actorId = patrolShipActorId(ship.id);
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
  const dy = target.y - space.y;
  const dz = target.z - craft.z;
  const distance = detHypot(detHypot(dx, dy), dz);
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
  const seats = new Map<WebSocketLike, Seat>();
  const userSeats = new Map<string, Seat>();
  const joiningUsers = new Set<string>();
  let closed = false;

  function sessionFor(key: string, now: number, patrols: readonly UniversePatrolEncounter[] = []): Session | null {
    let session = sessions.get(key);
    if (session) {
      for (const patrol of patrols) addPersistentPatrol(
        session, patrol, options.patrolSpawnDistanceMeters,
      );
      return session;
    }
    if (sessions.size >= MAX_SESSIONS) return null;
    const anomalyGravityWell = anomalyGravityWellForSector(key);
    session = {
      key, instanceId: randomUUID(), actors: new Map(), pilotByUser: new Map(),
      anomalyGravityWells: anomalyGravityWell ? [anomalyGravityWell] : [],
      gravityEnvironmentEnabled: false,
      persistentPatrols: new Map(), projectiles: [], combats: new Map(),
      engagementPending: false, nextAutoEngagementAt: 0,
      autoEngagementCooldowns: new Map(), nextProjectileId: 1,
      nextNumericId: 1, tick: 0, accumulatorMs: 0,
      lastAdvanceAt: now, lastSnapshotAt: now, emptySince: null,
    };
    sessions.set(key, session);
    if (patrols.length) {
      for (const patrol of patrols) addPersistentPatrol(
        session, patrol, options.patrolSpawnDistanceMeters,
      );
    } else {
      createPatrols(session, options.patrolSpawnDistanceMeters);
    }
    return session;
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
      }
    }
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

  function combatTarget(session: Session, actor: Actor): Actor | undefined {
    const combats = activeCombats(session);
    const candidates = actor.kind === "pilot"
      ? combats
          .filter((combat) => combat.participantActorIds.has(actor.actorId))
          .flatMap((combat) => [...session.actors.values()].filter((candidate) =>
            candidate.persistentPatrolId === combat.patrol.patrolId &&
            candidate.faction !== actor.faction && candidate.craft.alive))
      : actor.persistentPatrolId && session.combats.get(actor.persistentPatrolId)?.phase === "active"
        ? [...session.combats.get(actor.persistentPatrolId)!.participantActorIds]
            .map((actorId) => session.actors.get(actorId))
            .filter((candidate): candidate is Actor =>
              Boolean(candidate?.craft.alive && candidate.socket?.readyState === OPEN))
        : [];
    const missile = MISSILE_CATALOG[SHIPS[actor.shipId].missileFit];
    const forward = rotate(actor.craft.space!.q, 0, 0, -1);
    return candidates
      .map((candidate) => {
        const dx = candidate.craft.x - actor.craft.x;
        const dy = candidate.craft.space!.y - actor.craft.space!.y;
        const dz = candidate.craft.z - actor.craft.z;
        const distance = detHypot(detHypot(dx, dy), dz);
        const dot = (forward.x * dx + forward.y * dy + forward.z * dz) / Math.max(0.001, distance);
        return { candidate, distance, dot };
      })
      .filter((entry) => entry.distance <= missile.maxLockRange &&
        entry.dot >= detCos(missile.lockConeRadians))
      .sort((a, b) => a.distance - b.distance || a.candidate.actorId.localeCompare(b.candidate.actorId))[0]
      ?.candidate;
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
      throttle: distance > 150 ? 0.32 : 0.12,
      yaw: clamp(yawError * 1.6),
      pitch: clamp(pitchError * 1.4),
      strafe: clamp(local.x * 0.001, -0.16, 0.16),
      vertical: clamp(local.y * 0.001, -0.16, 0.16),
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
    const missile = MISSILE_CATALOG[SHIPS[actor.shipId].missileFit];
    actor.craft.lockTargetId = target?.numericId ?? null;
    acquireTarget(actor.craft, target?.craft, ORBITAL_DT, [], missile);
    const ship = SHIPS[actor.shipId];
    if (input.fire && actor.primaryCooldown <= 0) {
      const bullets = spawnPrimaryVolley(
        actor.craft, target?.craft, ship.shotSpeed, ship.shotDmg, [],
        PRIMARY_WEAPON_CATALOG[ship.primaryFit],
      );
      if (actor.kind === "pilot") {
        // No arbitrary primary-gun range gate: a round can traverse the full
        // server-streamed encounter bubble, then still needs a swept collision.
        for (const bullet of bullets) {
          const speed = detHypot(detHypot(bullet.vx, bullet.vy ?? 0), bullet.vz);
          if (speed > 0) bullet.life = Math.max(
            bullet.life, (NEARBY_RADIUS + 8) / speed + 0.25,
          );
        }
      }
      addProjectiles(session, actor, bullets);
      actor.primaryCooldown = ship.fireInterval;
    }
    if (input.missile && combatActive) {
      addProjectiles(session, actor, spawnMissileVolley(
        actor.craft, target?.craft, session.projectiles.length,
        ship.missileDamage, [], missile,
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
      const targets = [...session.actors.values()].filter((candidate) =>
        candidate.craft.alive && impactCombat(session, source, candidate));
      let impact: { target: Actor; time: number } | undefined;
      for (const target of targets) {
        if (target.actorId === projectile.sourceActorId) continue;
        const time = sphereSweepTime(from, to, {
          x: target.craft.x,
          y: target.craft.space!.y,
          z: target.craft.z,
        }, target.craft.radius + projectile.r);
        if (time !== null && (!impact || time < impact.time)) impact = { target, time };
      }
      if (impact) {
        applyProjectileHit(session, projectile, impact.target, from, to);
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
          }
          actor.creditsAwarded += award?.credits ?? 0;
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
          });
        }
        combat.resultsApplied = true;
        combat.phase = "complete";
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

  async function startEngagement(
    socket: WebSocketLike,
    seat: Seat,
    targetActorId: string,
    primaryFire = false,
  ) {
    if (seat.session.engagementPending) {
      send(socket, { type: "error", reason: "freeflight_encounter_active" });
      sendCombatState(seat.session, seat.actor);
      return;
    }
    seat.session.engagementPending = true;
    try {
      await claimEngagement(socket, seat, targetActorId, primaryFire);
    } finally {
      seat.session.engagementPending = false;
    }
  }

  async function claimEngagement(
    socket: WebSocketLike,
    seat: Seat,
    targetActorId: string,
    primaryFire = false,
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
      const joinRange = primaryFire ? NEARBY_RADIUS : PATROL_ENGAGEMENT_RANGE;
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
          distanceBetween(actor, target) > joinRange) {
        error("freeflight_encounter_participant_unavailable");
        return;
      }
      existingCombat.contract.addPilot({
        id: encounterActorId(actor), faction: actor.faction,
        hull: actor.craft.hullMax, playerId: seat.userId,
      }, session.tick);
      existingCombat.participantActorIds.add(actor.actorId);
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
      const patrolTarget = actor.kind === "patrol" && combat?.phase === "active"
        ? [...combat.participantActorIds]
            .map((actorId) => session.actors.get(actorId))
            .filter((candidate): candidate is Actor =>
              Boolean(candidate?.craft.alive && candidate.socket?.readyState === OPEN))
            .sort((a, b) => distanceBetween(actor, a) - distanceBetween(actor, b))[0]
        : undefined;
      const input = actor.kind === "patrol"
        ? patrolTarget && actor.scoutMemory?.mode === "tracking" &&
            actor.scoutMemory.actorId === patrolTarget.actorId
          ? patrolCombatInput(actor, patrolTarget)
          : patrolInput(actor, actor.scoutMemory
            ? scoutDestination(actor.scoutMemory, session.tick * ORBITAL_DT) : undefined)
        : Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS ? IDLE : actor.input;
      integrateSpatialFlight(
        actor.craft, input, ORBITAL_DT, 1, [], SHIPS[actor.shipId],
        {
          boundaryRadius: null,
          gravityWells: session.gravityEnvironmentEnabled ? session.anomalyGravityWells : [],
        },
      );
      // Toggle commands apply once per accepted input, not on every 30Hz tick.
      if (actor.kind === "pilot") {
        actor.input.inertial = false;
        actor.input.aimAssist = false;
      }
      actor.primaryCooldown = Math.max(0, actor.primaryCooldown - ORBITAL_DT);
      if (actor.lastDamageTick < 0 || session.tick - actor.lastDamageTick > 45) {
        actor.shield = Math.min(actor.shieldMax, actor.shield + 0.15 * ORBITAL_DT);
      }
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
  }

  async function handle(socket: WebSocketLike, userId: string, packet: Record<string, unknown>) {
    const error = (reason: string) => send(socket, { type: "error", reason });
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
        if (!sessions.has(admission.sessionKey) &&
            (options.resolveUniversePatrols || options.resolveUniversePatrol)) {
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
            error("freeflight_recovery_required");
            return;
          }
          if (prior.socket?.readyState === OPEN && prior.socket !== socket) {
            error("freeflight_session_already_active");
            return;
          }
          previous.actors.delete(prior.actorId);
          previous.pilotByUser.delete(userId);
        }
        const session = sessionFor(admission.sessionKey, now, initialPatrols);
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
            error("freeflight_recovery_required");
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
        error("freeflight_engagement_required");
        return;
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

  function advance(now = Date.now()) {
    if (closed) return;
    for (const [key, session] of sessions) {
      const elapsed = Math.max(0, Math.min(250, now - session.lastAdvanceAt));
      session.lastAdvanceAt = now;
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
    }
  }

  async function close() {
    closed = true;
    for (const socket of seats.keys()) {
      send(socket, { type: "freeflight_interrupted", reason: "server_restart" });
      socket.close(1001, "Server shutting down");
    }
    await Promise.all([...sessions.values()].flatMap((session) =>
      [...session.combats.values()]
        .filter((combat) => combat.phase !== "complete" && options.releaseUniversePatrol)
        .map((combat) =>
          options.releaseUniversePatrol!(combat.patrol.patrolId, combat.id).catch(() => {}),
        ),
    ));
    seats.clear();
    userSeats.clear();
    sessions.clear();
  }

  return {
    handle,
    detach,
    advance,
    close,
    get sessionCount() { return sessions.size; },
    get pilotCount() { return userSeats.size; },
  };
}
