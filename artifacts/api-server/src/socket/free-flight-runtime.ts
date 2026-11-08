import { randomUUID } from "node:crypto";
import {
  ORBITAL_DT,
  ORBITAL_RULES_VERSION,
  FREE_FLIGHT_PROTOCOL_V1,
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
  newFlight,
  parseOrbitalInput,
  rotate,
  spawnMissileVolley,
  spawnPrimaryVolley,
  sphereSweepTime,
  type FlightControls,
  type FreeFlightActorV1,
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
const MAX_ENCOUNTER_PILOTS = 8;
const PATROL_ENGAGEMENT_RANGE = 180;
const PATROL_SENSOR_RANGE = 520;
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
  persistentPatrols: Map<string, UniversePatrolEncounter>;
  projectiles: FreeFlightProjectile[];
  combat: LiveEncounter | null;
  engagementPending: boolean;
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
      });
    }
  }
}

function addPersistentPatrol(session: Session, patrol: UniversePatrolEncounter, radius = 360) {
  if (session.persistentPatrols.has(patrol.patrolId)) return;
  const baseAngle = patrol.faction === "ussf" ? 0 : -Math.PI / 2;
  const waypoints = Array.from({ length: 4 }, (_, point) => {
    const angle = baseAngle + point * Math.PI / 2;
    return { x: detCos(angle) * radius, y: 0, z: detSin(angle) * radius };
  });
  patrol.ships.forEach((ship, index) => {
    if (!Object.hasOwn(SHIPS, ship.hullId)) return;
    const shipId = ship.hullId as ShipId;
    const angle = baseAngle + index * 0.16;
    const numericId = session.nextNumericId++;
    const craft = craftFor(
      numericId, shipId,
      detCos(angle) * (radius + index * 12), 0,
      detSin(angle) * (radius + index * 12), angle + Math.PI / 2,
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
    });
  });
  session.persistentPatrols.set(patrol.patrolId, patrol);
}

function patrolInput(actor: Actor): SharedInput {
  const target = actor.waypoints[actor.waypointIndex]!;
  const { craft } = actor;
  const space = craft.space!;
  const dx = target.x - craft.x;
  const dy = target.y - space.y;
  const dz = target.z - craft.z;
  const distance = detHypot(detHypot(dx, dy), dz);
  if (distance < 90) actor.waypointIndex = (actor.waypointIndex + 1) % actor.waypoints.length;
  const q = space.q;
  const local = rotate([-q[0], -q[1], -q[2], q[3]], dx, dy, dz);
  return {
    ...IDLE,
    throttle: distance > 120 ? 0.42 : 0.16,
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
      ? actor.callsign
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
    session = {
      key, instanceId: randomUUID(), actors: new Map(), pilotByUser: new Map(),
      persistentPatrols: new Map(), projectiles: [], combat: null,
      engagementPending: false, nextProjectileId: 1,
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

  function broadcast(session: Session, packet: unknown) {
    for (const actor of session.actors.values()) {
      if (actor.kind === "pilot" && actor.socket?.readyState === OPEN) send(actor.socket, packet);
    }
  }

  function combatTarget(session: Session, actor: Actor): Actor | undefined {
    const combat = session.combat;
    if (!combat || combat.phase !== "active") return undefined;
    const candidates = actor.kind === "pilot"
      ? [...session.actors.values()].filter((candidate) =>
          candidate.persistentPatrolId === combat.patrol.patrolId &&
          candidate.faction !== actor.faction && candidate.craft.alive)
      : [...combat.participantActorIds]
          .map((actorId) => session.actors.get(actorId))
          .filter((candidate): candidate is Actor =>
            Boolean(candidate?.craft.alive && candidate.socket?.readyState === OPEN));
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

  function patrolCombatInput(actor: Actor, target: Actor): SharedInput {
    const space = actor.craft.space!;
    const dx = target.craft.x - actor.craft.x;
    const dy = target.craft.space!.y - space.y;
    const dz = target.craft.z - actor.craft.z;
    const distance = detHypot(detHypot(dx, dy), dz);
    const q = space.q;
    const local = rotate([-q[0], -q[1], -q[2], q[3]], dx, dy, dz);
    return {
      ...IDLE,
      throttle: distance > 150 ? 0.32 : 0.12,
      yaw: clamp(detAtan2(-local.x, -local.z) * 1.6),
      pitch: clamp(detAtan2(local.y, detHypot(local.x, local.z)) * 1.4),
      strafe: clamp(local.x * 0.001, -0.16, 0.16),
      vertical: clamp(local.y * 0.001, -0.16, 0.16),
      fire: distance < 170,
    };
  }

  function addProjectiles(session: Session, actor: Actor, bullets: SpatialBullet[]) {
    for (const bullet of bullets) {
      if (session.projectiles.length >= 110) break;
      session.projectiles.push({
        ...bullet,
        id: session.nextProjectileId++,
        sourceActorId: actor.actorId,
        faction: actor.faction,
      });
    }
  }

  function fireWeapons(session: Session, actor: Actor, input: SharedInput) {
    const combat = session.combat;
    if (!combat || combat.phase !== "active" || !combat.participantActorIds.has(actor.actorId) &&
        actor.persistentPatrolId !== combat.patrol.patrolId) return;
    const target = combatTarget(session, actor);
    const missile = MISSILE_CATALOG[SHIPS[actor.shipId].missileFit];
    actor.craft.lockTargetId = target?.numericId ?? null;
    acquireTarget(actor.craft, target?.craft, ORBITAL_DT, [], missile);
    actor.primaryCooldown = Math.max(0, actor.primaryCooldown - ORBITAL_DT);
    const ship = SHIPS[actor.shipId];
    if (input.fire && actor.primaryCooldown <= 0) {
      addProjectiles(session, actor, spawnPrimaryVolley(
        actor.craft, target?.craft, ship.shotSpeed, ship.shotDmg, [],
        PRIMARY_WEAPON_CATALOG[ship.primaryFit],
      ));
      actor.primaryCooldown = ship.fireInterval;
    }
    if (input.missile) {
      addProjectiles(session, actor, spawnMissileVolley(
        actor.craft, target?.craft, session.projectiles.length,
        ship.missileDamage, [], missile,
      ));
    }
  }

  function applyProjectileHit(
    session: Session,
    projectile: FreeFlightProjectile,
    target: Actor,
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
  ) {
    const shieldDamage = Math.min(target.shield, projectile.dmg);
    target.shield = Math.max(0, target.shield - shieldDamage);
    const hullDamage = applyHullDamage(target.craft, projectile.dmg - shieldDamage);
    if (target.craft.hull <= 0) target.craft.alive = false;
    if (shieldDamage + hullDamage > 0) target.lastDamageTick = session.tick;
    const combat = session.combat;
    const attacker = session.actors.get(projectile.sourceActorId);
    if (hullDamage > 0 && combat && attacker && target.kind === "patrol" &&
        target.persistentPatrolId === combat.patrol.patrolId &&
        combat.participantActorIds.has(attacker.actorId)) {
      combat.contract.recordDamage({
        eventId: weaponEventId(session, projectile.id),
        tick: session.tick,
        attackerActorId: encounterActorId(attacker),
        targetActorId: encounterActorId(target),
        hullDamage,
      });
    } else if (hullDamage > 0 && combat && attacker &&
        attacker.persistentPatrolId === combat.patrol.patrolId &&
        combat.participantActorIds.has(target.actorId)) {
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
      encounterId: combat?.id ?? null,
      sourceActorId: projectile.sourceActorId,
      targetActorId: target.actorId,
      weaponId: projectile.weaponId ?? (projectile.missile ? "missile" : "primary"),
      from,
      to,
      shieldDamage,
      hullDamage,
      destroyed: !target.craft.alive,
    });
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
      const combat = session.combat;
      const targets = combat ? [...session.actors.values()].filter((candidate) =>
        candidate.craft.alive &&
        (candidate.kind === "patrol"
          ? candidate.persistentPatrolId === combat.patrol.patrolId &&
            candidate.faction !== projectile.faction
          : combat.participantActorIds.has(candidate.actorId) &&
            candidate.faction !== projectile.faction)) : [];
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

  function persistCompletedEncounter(session: Session, combat: LiveEncounter) {
    if (!combat.receipt) combat.receipt = combat.contract.finalize(session.tick, "completed", true);
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
            status: "settled",
            kills: pilotResult.kills,
            assists: pilotResult.assists,
            creditsAwarded: award?.credits ?? 0,
            destroyedActorIds: pilotResult.destroyedActorIds,
          });
        }
        combat.resultsApplied = true;
        combat.phase = "complete";
        broadcast(session, {
          type: "freeflight_engagement_state",
          encounterId: combat.id,
          phase: "complete",
        });
      } catch {
        combat.phase = "settlement-unavailable";
        combat.nextSettlementAttemptAt = Date.now() + 5_000;
        broadcast(session, {
          type: "freeflight_engagement_state",
          encounterId: combat.id,
          phase: "settlement-unavailable",
        });
      } finally {
        combat.settlementTask = null;
      }
    })();
  }

  async function startEngagement(socket: WebSocketLike, seat: Seat, targetActorId: string) {
    const { session, actor } = seat;
    const error = (reason: string) => send(socket, { type: "error", reason });
    if (!options.reserveUniversePatrol || !options.settleScoutEncounter) {
      error("freeflight_combat_unavailable");
      return;
    }
    if (!/^[A-Za-z0-9_:-]{8,80}$/.test(targetActorId)) {
      error("invalid_freeflight_target");
      return;
    }
    if (session.engagementPending || session.combat && session.combat.phase !== "complete") {
      error("freeflight_encounter_active");
      return;
    }
    const target = session.actors.get(targetActorId);
    if (!target || target.kind !== "patrol" || !target.persistentPatrolId ||
        !target.persistentShipId || target.faction === actor.faction || !target.craft.alive) {
      error("freeflight_target_unavailable");
      return;
    }
    if (distanceBetween(actor, target) > PATROL_ENGAGEMENT_RANGE) {
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
        distanceBetween(candidate, target) <= PATROL_SENSOR_RANGE)
      .sort((a, b) => a.actorId.localeCompare(b.actorId))
      .slice(0, MAX_ENCOUNTER_PILOTS);
    if (!participants.some((candidate) => candidate.actorId === actor.actorId)) {
      error("freeflight_encounter_participant_unavailable");
      return;
    }
    const encounterId = randomUUID();
    session.engagementPending = true;
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
    } finally {
      session.engagementPending = false;
    }
    if (session.combat && session.combat.phase !== "complete") {
      error("freeflight_encounter_active");
      return;
    }
    if (!reserved || reserved.patrolId !== contact.patrolId ||
        reserved.faction !== contact.faction || reserved.locationId !== contact.locationId) {
      error("freeflight_patrol_reservation_unavailable");
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
    session.combat = {
      id: encounterId, faction: actor.faction, patrol: reserved, contract,
      participantActorIds, phase: "active", nextSettlementAttemptAt: 0,
      settlementTask: null, resultsApplied: false,
    };
    for (const participant of participants) {
      send(participant.socket, {
        type: "freeflight_engagement_started",
        encounterId,
        patrolId: reserved.patrolId,
        opposingFaction: reserved.faction,
      });
    }
    publish(session);
  }

  function tickSession(session: Session) {
    session.tick += 1;
    for (const actor of session.actors.values()) {
      if (!actor.craft.alive) continue;
      const combat = session.combat?.phase === "active" ? session.combat : null;
      const patrolTarget = actor.kind === "patrol" && combat &&
          actor.persistentPatrolId === combat.patrol.patrolId
        ? [...combat.participantActorIds]
            .map((actorId) => session.actors.get(actorId))
            .filter((candidate): candidate is Actor =>
              Boolean(candidate?.craft.alive && candidate.socket?.readyState === OPEN))
            .sort((a, b) => distanceBetween(actor, a) - distanceBetween(actor, b))[0]
        : undefined;
      const input = actor.kind === "patrol"
        ? patrolTarget ? patrolCombatInput(actor, patrolTarget) : patrolInput(actor)
        : Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS ? IDLE : actor.input;
      integrateSpatialFlight(
        actor.craft, input, ORBITAL_DT, 1, [], SHIPS[actor.shipId],
        { boundaryRadius: null },
      );
      actor.primaryCooldown = Math.max(0, actor.primaryCooldown - ORBITAL_DT);
      if (actor.lastDamageTick < 0 || session.tick - actor.lastDamageTick > 45) {
        actor.shield = Math.min(actor.shieldMax, actor.shield + 0.15 * ORBITAL_DT);
      }
      fireWeapons(session, actor, input);
    }
    stepProjectiles(session);
    const combat = session.combat;
    if (combat?.phase === "active" &&
        combat.patrol.ships.every((ship) => {
          const actor = session.actors.get(patrolShipActorId(ship.id));
          return !actor || !actor.craft.alive;
        })) {
      persistCompletedEncounter(session, combat);
    } else if (combat?.phase === "settlement-unavailable") {
      persistCompletedEncounter(session, combat);
    }
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
    seat.session.emptySince = [...seat.session.actors.values()].every((actor) =>
      actor.kind !== "pilot" || actor.socket?.readyState !== OPEN,
    ) ? Date.now() : null;
  }

  async function handle(socket: WebSocketLike, userId: string, packet: Record<string, unknown>) {
    const error = (reason: string) => send(socket, { type: "error", reason });
    if (closed) { error("server_restart"); return; }
    if (packet.type === "freeflight_join") {
      if (Object.keys(packet).length !== 1 || seats.has(socket) || joiningUsers.has(userId)) {
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
        if (!sessions.has(admission.sessionKey) && options.resolveUniversePatrol) {
          try {
            const resolved = await Promise.all([
              options.resolveUniversePatrol(userId, "ussf"),
              options.resolveUniversePatrol(userId, "accord"),
            ]);
            initialPatrols = resolved.filter((patrol): patrol is UniversePatrolEncounter => patrol !== null);
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
          };
          session.actors.set(actor.actorId, actor);
          session.pilotByUser.set(userId, actor);
        } else if (actor.faction !== admission.faction || actor.shipId !== admission.shipId) {
          // Loadout/faction changes are server-owned; replace state only on rejoin.
          actor.faction = admission.faction;
          actor.shipId = admission.shipId;
          actor.craft = craftFor(actor.numericId, admission.shipId, actor.craft.x, actor.craft.space!.y, actor.craft.z, actor.craft.yaw);
          actor.shield = SHIPS[admission.shipId].shield;
          actor.shieldMax = SHIPS[admission.shipId].shield;
        }
        const previousSeat = userSeats.get(userId);
        if (previousSeat) seats.delete(previousSeat.actor.socket!);
        actor.socket = socket;
        actor.disconnectedAt = null;
        actor.lastInputAt = now;
        actor.input = { ...IDLE };
        const seat = { session, actor, userId };
        seats.set(socket, seat);
        userSeats.set(userId, seat);
        session.emptySince = null;
        send(socket, {
          type: "freeflight_joined",
          nextInputSeq: actor.lastSeq + 1,
          snapshot: snapshotFor(session, actor),
        });
        publish(session);
      } catch {
        error("freeflight_admission_unavailable");
      } finally {
        joiningUsers.delete(userId);
      }
      return;
    }

    const seat = seats.get(socket);
    if (!seat || seat.userId !== userId) { error("freeflight_join_required"); return; }
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
      if ((input.fire || input.missile) &&
          (!seat.session.combat ||
           seat.session.combat.phase !== "active" ||
           !seat.session.combat.participantActorIds.has(seat.actor.actorId))) {
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
      send(socket, { type: "freeflight_input_accepted", seq: input.seq });
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
            now - actor.disconnectedAt > DISCONNECT_GRACE_MS) {
          session.actors.delete(actor.actorId);
          if (actor.ownerUserId) session.pilotByUser.delete(actor.ownerUserId);
        }
      }
      if (session.pilotByUser.size === 0) {
        session.emptySince ??= now;
        if (now - session.emptySince > EMPTY_SESSION_TTL_MS) {
          const combat = session.combat;
          if (combat?.phase === "active") {
            void options.releaseUniversePatrol?.(combat.patrol.patrolId, combat.id).catch(() => {});
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
    await Promise.all([...sessions.values()].flatMap((session) => {
      const combat = session.combat;
      return combat?.phase === "active" && options.releaseUniversePatrol
        ? [options.releaseUniversePatrol(combat.patrol.patrolId, combat.id).catch(() => {})]
        : [];
    }));
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
