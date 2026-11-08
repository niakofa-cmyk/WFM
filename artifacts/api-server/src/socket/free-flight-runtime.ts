import { randomUUID } from "node:crypto";
import {
  ORBITAL_DT,
  ORBITAL_RULES_VERSION,
  detAtan2,
  detHypot,
  integrateSpatialFlight,
  newFlight,
  parseOrbitalInput,
  rotate,
  type FlightControls,
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
const MAX_NEARBY_ACTORS = 48;
const MAX_SESSIONS = 128;
const MAX_PILOTS_PER_SESSION = 64;

export type FreeFlightAdmission = {
  /** Server-derived spatial session key. Never accept this value from a client packet. */
  sessionKey: string;
  faction: Faction;
  shipId: ShipId;
};

type ActorKind = "pilot" | "patrol";
type Actor = {
  actorId: string;
  numericId: number;
  kind: ActorKind;
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

const OPEN = 1;
const IDLE: FlightControls = {
  throttle: 0, yaw: 0, pitch: 0, strafe: 0, vertical: 0, roll: 0,
  boost: false, brake: false, drift: false, inertial: false, aimAssist: false,
};
const clamp = (n: number, low = -1, high = 1) => Math.max(low, Math.min(high, Number.isFinite(n) ? n : 0));
const factionLabel = (faction: Faction) => faction === "ussf" ? "USSF" : "ACCORD";
const opposite = (faction: Faction): Faction => faction === "ussf" ? "accord" : "ussf";
const validSessionKey = (key: string) => /^[a-z0-9][a-z0-9:_-]{1,127}$/i.test(key);

function craftFor(id: number, shipId: ShipId, faction: Faction, x: number, y: number, z: number, yaw = 0): SpatialCraft {
  const def = SHIPS[shipId];
  const craft: SpatialCraft = {
    id, x, z, yaw, pitch: 0, speed: 0, steer: 0,
    hull: def.hull, hullMax: def.hull, alive: true,
    root: 0, jam: 0, boost: 0, cloak: 0, untargetable: 0,
    radius: def.radius, lockTargetId: null,
    space: newFlight(yaw),
  };
  craft.space.y = y;
  craft.space.ammo = def.missileAmmo;
  return craft;
}

function createPatrols(session: Session) {
  const patrolRadius = 820;
  for (const faction of ["ussf", "accord"] as const) {
    const roster = FLEET_AI_ROSTER[faction];
    for (let index = 0; index < 2; index += 1) {
      const shipId = roster[index]!;
      const angle = (faction === "ussf" ? 0 : Math.PI) + index * Math.PI * 0.5;
      const x = Math.cos(angle) * patrolRadius;
      const z = Math.sin(angle) * patrolRadius;
      const waypoints = Array.from({ length: 4 }, (_, point) => {
        const a = angle + point * Math.PI / 2;
        return { x: Math.cos(a) * patrolRadius, y: (index ? 110 : -70), z: Math.sin(a) * patrolRadius };
      });
      const numericId = session.nextNumericId++;
      const craft = craftFor(numericId, shipId, faction, x, index ? 110 : -70, z, angle + Math.PI / 2);
      const actor: Actor = {
        actorId: `patrol:${faction}:${index + 1}`,
        numericId, kind: "patrol", faction, shipId, craft,
        shield: SHIPS[shipId].shield, shieldMax: SHIPS[shipId].shield,
        ownerUserId: null, socket: null,
        callsign: `${factionLabel(faction)} Patrol ${index + 1}`,
        input: { ...IDLE }, lastInputAt: 0, lastSeq: 0, disconnectedAt: null,
        waypointIndex: 1, waypoints,
      };
      session.actors.set(actor.actorId, actor);
    }
  }
}

function patrolInput(actor: Actor): FlightControls {
  const target = actor.waypoints[actor.waypointIndex]!;
  const craft = actor.craft;
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

function actorView(actor: Actor, viewer: Actor) {
  const craft = actor.craft;
  const space = craft.space!;
  const own = actor === viewer;
  return {
    actorId: actor.actorId,
    kind: actor.kind,
    faction: actor.faction,
    shipId: actor.shipId,
    callsign: actor.kind === "patrol"
      ? actor.callsign
      : own ? "YOU" : actor.faction === viewer.faction ? "WING PILOT" : "UNIDENTIFIED CONTACT",
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
    own,
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

  function snapshotFor(session: Session, viewer: Actor) {
    const viewerSpace = viewer.craft.space!;
    const radiusSq = NEARBY_RADIUS * NEARBY_RADIUS;
    const nearby = [...session.actors.values()]
      .filter((actor) => {
        if (actor.kind === "pilot" && actor.socket?.readyState !== OPEN && actor !== viewer) return false;
        if (actor === viewer) return true;
        const space = actor.craft.space!;
        const dx = actor.craft.x - viewer.craft.x;
        const dy = space.y - viewerSpace.y;
        const dz = actor.craft.z - viewer.craft.z;
        return dx * dx + dy * dy + dz * dz <= radiusSq;
      })
      .sort((a, b) => {
        if (a === viewer) return -1;
        if (b === viewer) return 1;
        const aSpace = a.craft.space!;
        const bSpace = b.craft.space!;
        const ax = a.craft.x - viewer.craft.x;
        const ay = aSpace.y - viewerSpace.y;
        const az = a.craft.z - viewer.craft.z;
        const bx = b.craft.x - viewer.craft.x;
        const by = bSpace.y - viewerSpace.y;
        const bz = b.craft.z - viewer.craft.z;
        return (ax * ax + ay * ay + az * az) - (bx * bx + by * by + bz * bz);
      })
      .slice(0, MAX_NEARBY_ACTORS)
      .map((actor) => actorView(actor, viewer));
    return {
      protocol: "orbital-freeflight-v1",
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
      if (actor.kind !== "pilot" || !actor.socket || actor.socket.readyState !== OPEN) continue;
      send(actor.socket, { type: "freeflight_snapshot", snapshot: snapshotFor(session, actor) });
    }
  }

  function tickSession(session: Session) {
    session.tick += 1;
    for (const actor of session.actors.values()) {
      if (!actor.craft.alive) continue;
      const def = SHIPS[actor.shipId];
      const input = actor.kind === "patrol"
        ? patrolInput(actor)
        : Date.now() - actor.lastInputAt > INPUT_TIMEOUT_MS ? IDLE : actor.input;
      integrateSpatialFlight(actor.craft, input, ORBITAL_DT, 1, [], def, { boundaryRadius: null });
      if (actor.kind === "pilot") {
        // Hull, shield, ammunition and weapon cooldowns remain server-owned.
        // This movement slice intentionally does not accept client combat outcomes.
        actor.shield = Math.min(actor.shieldMax, actor.shield + 0.15 * ORBITAL_DT);
      }
    }
  }

  async function handle(socket: WebSocketLike, userId: string, packet: Record<string, unknown>) {
    const error = (reason: string) => send(socket, { type: "error", reason });
    if (closed) { error("server_restart"); return; }

    if (packet.type === "freeflight_join") {
      if (Object.keys(packet).length !== 1 || seats.has(socket)) { error("invalid_freeflight_join"); return; }
      let admission: FreeFlightAdmission | null;
      try {
        admission = await options.resolveAdmission(userId);
      } catch {
        error("freeflight_admission_unavailable");
        return;
      }
      if (!admission || !validSessionKey(admission.sessionKey) ||
          (admission.faction !== "ussf" && admission.faction !== "accord") ||
          !Object.hasOwn(SHIPS, admission.shipId) ||
          SHIPS[admission.shipId].faction !== admission.faction) {
        error("freeflight_not_authorized");
        return;
      }

      const existing = userSeats.get(userId);
      if (existing && existing.session.key !== admission.sessionKey) {
        if (existing.actor.socket?.readyState === OPEN) {
          error("freeflight_session_already_active");
          return;
        }
        detach(existing.actor.socket);
      }
      const session = sessionFor(admission.sessionKey, Date.now());
      if (!session) { error("freeflight_capacity"); return; }
      let actor = session.pilotByUser.get(userId);
      if (!actor) {
        if (session.pilotByUser.size >= MAX_PILOTS_PER_SESSION) { error("freeflight_session_full"); return; }
        const pilotIndex = session.pilotByUser.size;
        const x = ((pilotIndex % 5) - 2) * 14;
        const z = -Math.floor(pilotIndex / 5) * 18;
        const numericId = session.nextNumericId++;
        const craft = craftFor(numericId, admission.shipId, admission.faction, x, 0, z);
        actor = {
          actorId: `pilot:${randomUUID()}`,
          numericId, kind: "pilot", faction: admission.faction, shipId: admission.shipId, craft,
          shield: SHIPS[admission.shipId].shield, shieldMax: SHIPS[admission.shipId].shield,
          ownerUserId: userId, socket: null,
          callsign: "Pilot", input: { ...IDLE }, lastInputAt: Date.now(),
          lastSeq: 0, disconnectedAt: null, waypointIndex: 0, waypoints: [],
        };
        session.actors.set(actor.actorId, actor);
        session.pilotByUser.set(userId, actor);
      }
      if (actor.socket && actor.socket !== socket && actor.socket.readyState === OPEN) {
        actor.socket.close(4001, "Pilot reconnected");
      }
      const previousSeat = userSeats.get(userId);
      if (previousSeat) seats.delete(previousSeat.actor.socket!);
      actor.socket = socket;
      actor.disconnectedAt = null;
      actor.lastInputAt = Date.now();
      actor.input = { ...IDLE };
      const seat = { session, actor, userId };
      seats.set(socket, seat);
      userSeats.set(userId, seat);
      session.emptySince = null;
      send(socket, { type: "freeflight_joined", nextInputSeq: actor.lastSeq + 1, snapshot: snapshotFor(session, actor) });
      publish(session);
      return;
    }

    const seat = seats.get(socket);
    if (!seat || seat.userId !== userId) { error("freeflight_join_required"); return; }
    if (packet.type === "freeflight_input") {
      if (Object.keys(packet).length !== 2 || !packet.input || typeof packet.input !== "object" || Array.isArray(packet.input)) {
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
      const budget = (seat.actor as Actor & { inputWindowAt?: number; inputCount?: number });
      if (!budget.inputWindowAt || now - budget.inputWindowAt >= 1_000) {
        budget.inputWindowAt = now;
        budget.inputCount = 0;
      }
      budget.inputCount = (budget.inputCount ?? 0) + 1;
      if (budget.inputCount > INPUT_RATE_LIMIT) { error("freeflight_rate_limited"); return; }
      seat.actor.lastSeq = input.seq;
      seat.actor.lastInputAt = now;
      seat.actor.input = {
        throttle: input.throttle, yaw: input.yaw, pitch: input.pitch, strafe: input.strafe,
        vertical: input.vertical, roll: input.roll, boost: input.boost, brake: input.brake,
        inertial: input.inertial, aimAssist: input.aimAssist,
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

  function detach(socket: WebSocketLike | null) {
    if (!socket) return;
    const seat = seats.get(socket);
    if (!seat) return;
    seats.delete(socket);
    // A delayed close from a replaced socket must not detach the new socket
    // that now owns this same server-side pilot actor.
    if (seat.actor.socket !== socket) return;
    if (userSeats.get(seat.userId)?.actor === seat.actor) userSeats.delete(seat.userId);
    seat.actor.socket = null;
    seat.actor.input = { ...IDLE };
    seat.actor.disconnectedAt = Date.now();
    seat.session.emptySince = [...seat.session.actors.values()].every((actor) =>
      actor.kind !== "pilot" || actor.socket?.readyState !== OPEN,
    ) ? Date.now() : null;
  }

  function advance(now = Date.now()) {
    if (closed) return;
    for (const [key, session] of sessions) {
      const elapsed = Math.max(0, Math.min(250, now - session.lastAdvanceAt));
      session.lastAdvanceAt = now;
      session.accumulatorMs += elapsed;
      let steps = 0;
      while (session.accumulatorMs >= 1000 / TICK_RATE && steps < 8) {
        tickSession(session);
        session.accumulatorMs -= 1000 / TICK_RATE;
        steps += 1;
      }
      for (const actor of [...session.actors.values()]) {
        if (actor.kind === "pilot" && actor.disconnectedAt !== null &&
            now - actor.disconnectedAt > DISCONNECT_GRACE_MS) {
          session.actors.delete(actor.actorId);
          session.pilotByUser.delete(actor.ownerUserId!);
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
