import { randomUUID } from "node:crypto";
import {
  ORBITAL_DT,
  ORBITAL_RULES_VERSION,
  FREE_FLIGHT_PROTOCOL_V1,
  detAtan2,
  detCos,
  detHypot,
  detSin,
  integrateSpatialFlight,
  newFlight,
  parseOrbitalInput,
  rotate,
  type FlightControls,
  type FreeFlightActorV1,
  type FreeFlightSnapshotV1,
  type SpatialCraft,
} from "@workspace/orbital-sim";
import { FLEET_AI_ROSTER, SHIPS, type Faction, type ShipId } from "../game/ships";

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
const OPEN = 1;

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
  input: FlightControls;
  lastInputAt: number;
  lastSeq: number;
  inputWindowAt: number;
  inputCount: number;
  disconnectedAt: number | null;
  waypointIndex: number;
  waypoints: Array<{ x: number; y: number; z: number }>;
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
  nextNumericId: number;
  tick: number;
  accumulatorMs: number;
  lastAdvanceAt: number;
  lastSnapshotAt: number;
  emptySince: number | null;
};
type Seat = { session: Session; actor: Actor; userId: string };

const IDLE: FlightControls = {
  throttle: 0, yaw: 0, pitch: 0, strafe: 0, vertical: 0, roll: 0,
  boost: false, brake: false, drift: false, inertial: false, aimAssist: false,
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

function createPatrols(session: Session) {
  const radius = 820;
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
        waypointIndex: 1, waypoints,
      });
    }
  }
}

function patrolInput(actor: Actor): FlightControls {
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
}) {
  const sessions = new Map<string, Session>();
  const seats = new Map<WebSocketLike, Seat>();
  const userSeats = new Map<string, Seat>();
  const joiningUsers = new Set<string>();
  let closed = false;

  function sessionFor(key: string, now: number): Session | null {
    let session = sessions.get(key);
    if (session) return session;
    if (sessions.size >= MAX_SESSIONS) return null;
    session = {
      key, instanceId: randomUUID(), actors: new Map(), pilotByUser: new Map(),
      nextNumericId: 1, tick: 0, accumulatorMs: 0,
      lastAdvanceAt: now, lastSnapshotAt: now, emptySince: null,
    };
    sessions.set(key, session);
    createPatrols(session);
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

  function tickSession(session: Session) {
    session.tick += 1;
    for (const actor of session.actors.values()) {
      if (!actor.craft.alive) continue;
      const input = actor.kind === "patrol"
        ? patrolInput(actor)
        : Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS ? IDLE : actor.input;
      integrateSpatialFlight(
        actor.craft, input, ORBITAL_DT, 1, [], SHIPS[actor.shipId],
        { boundaryRadius: null },
      );
      if (actor.kind === "pilot") {
        // This movement slice has no client-authorized combat or reward path.
        actor.shield = Math.min(actor.shieldMax, actor.shield + 0.15 * ORBITAL_DT);
      }
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
        const session = sessionFor(admission.sessionKey, now);
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
    if (packet.type === "freeflight_input") {
      if (Object.keys(packet).length !== 2 ||
          !packet.input || typeof packet.input !== "object" || Array.isArray(packet.input)) {
        error("invalid_freeflight_input");
        return;
      }
      const parsed = parseOrbitalInput(packet.input);
      if (!parsed.ok) { error(`freeflight_${parsed.reason}`); return; }
      const input = parsed.input;
      if (input.fire || input.missile || input.targetId !== null) {
        error("freeflight_combat_not_enabled");
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
