import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import {
  isOrbitalSectorSimulationContract,
  orbitalRuntimeForSectorProtocol,
  ORBITAL_RUNTIME_ID,
  ORBITAL_SECTOR_SIMULATION_CONTRACT,
  SECTOR_ORBITAL_PROTOCOL_VERSION,
} from "@workspace/orbital-sim";
import { SHIPS, type ShipId } from "../game/ships";
import { createFlight, stepFlight, removeHostileProjectilesInPlace, NEUTRAL_FLIGHT_INPUT, vectorLength, type FlightInput, type FlightSector, type FlightState } from "../game/flight-sector";
import {
  sectorMission, SECTOR_STEP, type SectorMission, type SectorProgress,
  type SectorCommandRequest, type SectorSnapshot, type SectorSettlement, type SectorTacticalCommand,
  type IronEclipseCommandRequest, type IronEclipseOrder, type IronEclipseSubsystemId, type SectorProtocolVersion,
  type SectorScoutResult, type SectorEvidencePickup,
  type SectorHostileFleetShip, type SectorHostileFleetSnapshot,
  SECTOR_PROTOCOL_VERSION,
} from "../game/sector-missions";
import { validSectorCompletion, type CompletedSectorMission } from "../game/sector-completion";
import {
  decideFactionContact, ExplorationEncounter, readExplorationReceipt,
  type ExplorationReceipt, type FactionContactDecision, type PilotTransponder,
} from "../game/exploration-encounter";
import type { ExplorationSettlement } from "../game/exploration-settlement";
import {
  patrolShipActorId,
  type UniversePatrolEncounter,
} from "../game/universe-patrols";
import {
  absorbWingDamage, advanceIronEclipse, completeIronEclipse, createIronEclipseState,
  damageIronEclipseTarget, ironEclipseSnapshot, ironEclipseTarget, markIronEclipseCapitalEngaged,
  setIronEclipseOrder, setIronEclipseTarget, type IronEclipseState,
} from "../game/iron-eclipse";

type Pilot = {
  userId: string; slot: number; shipId: ShipId; socket: WebSocket | null; ready: boolean;
  flight: FlightState; input: FlightInput; seq: number; lastInput: number; disconnectedAt: number | null;
  activeTicks: number; acceptedInputs: number; progress: SectorProgress; settlement: SectorSettlement;
  proof: CompletedSectorMission | null; settling: Promise<void> | null; nextRetry: number; attempts: number;
  transponder: PilotTransponder; transponderChangedAt: number | null;
  factionContact?: FactionContactDecision; lastHostileActionTick?: number;
  scoutResult?: SectorScoutResult;
  scoutResultStatus?: "pending" | "recorded" | "unavailable";
  evidenceRecovered: Set<string>;
  evidenceRecovering: Set<string>;
  evidenceUnavailable: Set<string>;
  evidenceActionAt: number | null;
};
type Room = {
  code: string; matchId: string; mission: SectorMission; pilots: Pilot[]; hostSlot: number;
  ownerUserId: string; publicListing: boolean; operationSync: Promise<void>;
  phase: SectorSnapshot["phase"]; tick: number; droneHull: number; touched: number;
  command: SectorTacticalCommand | null; commandAt: number | null;
  operation: IronEclipseState | null;
  flightSector: FlightSector;
  scoutFaction?: "ussf" | "accord";
  scoutEncounter?: ExplorationEncounter;
  scoutReceipt?: ExplorationReceipt;
  scoutPersisting?: Promise<void> | null;
  scoutPosition: FlightState["position"];
  universePatrol?: UniversePatrolEncounter;
  patrolFleet?: SectorHostileFleetShip[];
};
export type SectorOperationPresence = {
  instanceId: string;
  ownerUserId: string;
  phase: "assembling" | "ready" | "active" | "complete" | "closed";
  currentPlayers: number;
  visibility: "public" | "unlisted";
};
type Options = {
  loadProgress?: (userId: string) => Promise<SectorProgress>;
  settle?: (proof: CompletedSectorMission) => Promise<{ progress: SectorProgress; replayed: boolean }>;
  recordScoutResults?: (entries: readonly { userId: string; result: SectorScoutResult }[]) => Promise<void>;
  settleScoutEncounter?: (receipt: ExplorationReceipt) => Promise<ExplorationSettlement>;
  recoverNarrativeEvidence?: (
    userId: string,
    evidenceId: string,
    encounterId: string,
  ) => Promise<"recovered" | "duplicate">;
  isAtCinderRing?: (userId: string) => Promise<boolean>;
  resolveUniversePatrol?: (userId: string, faction: "ussf" | "accord") => Promise<UniversePatrolEncounter | null>;
  reserveUniversePatrol?: (
    userIds: readonly string[],
    faction: "ussf" | "accord",
    contact: Pick<UniversePatrolEncounter, "patrolId" | "locationId" | "faction">,
    encounterId: string,
  ) => Promise<UniversePatrolEncounter | null>;
  publishOperation?: (state: SectorOperationPresence) => Promise<void>;
  /** Selected by deployment configuration, never by a client-supplied field. */
  protocolVersion?: SectorProtocolVersion;
  /** Trusted dependency seam for tests; runtime always uses stepFlight. */
  physics?: typeof stepFlight;
};
const numericAxes = ["throttle", "pitch", "yaw", "roll"] as const;
const optionalNumericAxes = ["strafe", "vertical"] as const;
const buttons = ["boost", "brake", "fire", "lock", "missile", "countermeasure"] as const;
const inputKeys = new Set<string>([...numericAxes, ...optionalNumericAxes, ...buttons, "drift"]);
const idleInput: FlightInput = { ...NEUTRAL_FLIGHT_INPUT, brake: true };
const copyPosition = (target: FlightState["drone"]["position"], source: FlightState["drone"]["position"]) => {
  target.x = source.x; target.y = source.y; target.z = source.z;
};
const PALE_BEACON_EVIDENCE = [
  { id: "pale-beacon-record", title: "PALE BEACON RECEIVER HISTORY", position: { x: 620, y: 210, z: -740 } },
  { id: "earth-first-response", title: "EARTH RELAY PACKET", position: { x: 1260, y: 390, z: -1510 } },
] as const;
const PALE_BEACON_PATROL_ROUTE = [
  { x: 950, y: 300, z: -1150 },
  { x: 1370, y: 360, z: -900 },
  { x: 1300, y: 470, z: -500 },
  { x: 820, y: 410, z: -430 },
  { x: 560, y: 300, z: -760 },
] as const;
const PATROL_LEG_TICKS = 900;
const EVIDENCE_RECOVERY_RADIUS_METERS = 55;
const UNIVERSE_PATROL_ROUTE = [
  { x: 20, y: 150, z: -530 },
  { x: 300, y: 200, z: -590 },
  { x: 370, y: 270, z: -850 },
  { x: 60, y: 310, z: -1030 },
  { x: -230, y: 180, z: -820 },
] as const;

function universePatrolPosition(tick: number, slot: number): FlightState["position"] {
  const routeTicks = UNIVERSE_PATROL_ROUTE.length * PATROL_LEG_TICKS;
  const routeTick = ((Math.max(0, Math.floor(tick)) % routeTicks) + routeTicks) % routeTicks;
  const leg = Math.floor(routeTick / PATROL_LEG_TICKS);
  const fraction = (routeTick - leg * PATROL_LEG_TICKS) / PATROL_LEG_TICKS;
  const from = UNIVERSE_PATROL_ROUTE[leg]!;
  const to = UNIVERSE_PATROL_ROUTE[(leg + 1) % UNIVERSE_PATROL_ROUTE.length]!;
  const angle = tick / 120 + slot * (Math.PI * 2 / 5);
  return {
    x: from.x + (to.x - from.x) * fraction + Math.cos(angle) * (30 + slot * 7),
    y: from.y + (to.y - from.y) * fraction + Math.sin(angle * 0.7) * 18 + slot * 7,
    z: from.z + (to.z - from.z) * fraction + Math.sin(angle) * (34 + slot * 6),
  };
}

function buildPatrolFleet(contact: UniversePatrolEncounter, tick = 0): SectorHostileFleetShip[] {
  return contact.ships.slice(0, 4).map((ship, slot) => ({
    actorId: patrolShipActorId(ship.id),
    shipId: ship.hullId,
    callsign: ship.callsign,
    position: universePatrolPosition(tick, slot),
    hull: SHIPS[ship.hullId].hull,
    maxHull: SHIPS[ship.hullId].hull,
    destroyed: false,
  }));
}

function nearestLivingPatrolShip(
  room: Room,
  position: FlightState["position"],
): SectorHostileFleetShip | undefined {
  return room.patrolFleet?.filter((ship) => !ship.destroyed && ship.hull > 0)
    .map((ship) => ({
      ship,
      distance: vectorLength({
        x: position.x - ship.position.x,
        y: position.y - ship.position.y,
        z: position.z - ship.position.z,
      }),
    }))
    .sort((a, b) => a.distance - b.distance || a.ship.actorId.localeCompare(b.ship.actorId))[0]?.ship;
}

export function roamingPatrolPosition(tick: number): FlightState["position"] {
  const routeLength = PALE_BEACON_PATROL_ROUTE.length;
  const routeTicks = routeLength * PATROL_LEG_TICKS;
  const routeTick = ((Math.max(0, Math.floor(tick)) % routeTicks) + routeTicks) % routeTicks;
  const leg = Math.floor(routeTick / PATROL_LEG_TICKS);
  const fraction = (routeTick - leg * PATROL_LEG_TICKS) / PATROL_LEG_TICKS;
  const from = PALE_BEACON_PATROL_ROUTE[leg]!;
  const to = PALE_BEACON_PATROL_ROUTE[(leg + 1) % routeLength]!;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  };
}

export function parseSectorEvidenceRecovery(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    (value as Record<string, unknown>).type === "sector_recover_evidence";
}
export function parseSectorInput(value: unknown): FlightInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length < numericAxes.length + buttons.length ||
      keys.length > numericAxes.length + optionalNumericAxes.length + buttons.length + 1 ||
      keys.some(key => !inputKeys.has(key)) ||
      [...numericAxes, ...buttons].some(key => !Object.hasOwn(input, key))) return null;
  for (const key of numericAxes) {
    const n = input[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n > 1 || n < (key === "throttle" ? 0 : -1)) return null;
  }
  for (const key of optionalNumericAxes) {
    if (!Object.hasOwn(input, key)) continue;
    const n = input[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n > 1 || n < -1) return null;
  }
  if (buttons.some(key => typeof input[key] !== "boolean")) return null;
  if (Object.hasOwn(input, "drift") && typeof input.drift !== "boolean") return null;
  return {
    ...input,
    strafe: typeof input.strafe === "number" ? input.strafe : 0,
    vertical: typeof input.vertical === "number" ? input.vertical : 0,
    drift: input.drift === true,
  } as FlightInput;
}
export function parseSectorCommand(value: unknown): SectorCommandRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const packet = value as Record<string, unknown>;
  if (packet.type !== "sector_command" || typeof packet.order !== "string") return null;
  const exactKeys = (...expected: string[]) =>
    Object.keys(packet).length === expected.length && expected.every(key => Object.hasOwn(packet, key));
  if (packet.order === "attack" && exactKeys("type", "order")) return { type: "sector_command", order: "attack" };
  if (packet.order === "regroup" && exactKeys("type", "order")) return { type: "sector_command", order: "regroup" };
  if ((packet.order === "defend" || packet.order === "escort") &&
      exactKeys("type", "order", "targetSlot") &&
      Number.isSafeInteger(packet.targetSlot) && (packet.targetSlot as number) >= 0 && (packet.targetSlot as number) < 8) {
    return { type: "sector_command", order: packet.order, targetSlot: packet.targetSlot as number };
  }
  return null;
}
export function parseIronEclipseCommand(value: unknown): IronEclipseCommandRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const packet = value as Record<string, unknown>;
  const exactKeys = (...expected: string[]) =>
    Object.keys(packet).length === expected.length && expected.every(key => Object.hasOwn(packet, key));
  if (packet.type === "iron_eclipse_order" && exactKeys("type", "order") &&
      ["attack", "defend", "escort", "regroup"].includes(packet.order as string)) {
    return packet as IronEclipseCommandRequest;
  }
  if (packet.type === "iron_eclipse_target" && exactKeys("type", "target") &&
      ["point-defense", "shield-array", "reactor"].includes(packet.target as string)) {
    return packet as IronEclipseCommandRequest;
  }
  return null;
}
export function parseSectorTransponder(value: unknown): PilotTransponder | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const packet = value as Record<string, unknown>;
  if (Object.keys(packet).length !== 2 || packet.type !== "sector_transponder" ||
      (packet.mode !== "broadcast" && packet.mode !== "silent")) return null;
  return packet.mode;
}
function sensorLineOfSight(from: FlightState["position"], to: FlightState["position"], sector: FlightSector): boolean {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared < 1) return true;
  const blocked = (body: { position: FlightState["position"]; radius: number }) => {
    const px = body.position.x - from.x, py = body.position.y - from.y, pz = body.position.z - from.z;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / lengthSquared));
    if (t < 0.01 || t > 0.99) return false;
    const x = from.x + dx * t - body.position.x;
    const y = from.y + dy * t - body.position.y;
    const z = from.z + dz * t - body.position.z;
    return x * x + y * y + z * z <= body.radius * body.radius;
  };
  if (sector.rocks.some(blocked)) return false;
  if (sector.planet && blocked(sector.planet)) return false;
  return true;
}
const neutral = (): FlightInput => ({ ...NEUTRAL_FLIGHT_INPUT, brake: true });
function send(socket: WebSocket | null, value: unknown) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 1_048_576) { socket.close(1013, "Snapshot backpressure"); return; }
  socket.send(JSON.stringify(value));
}
export function createSectorRuntime(options: Options) {
  const protocolVersion = options.protocolVersion ?? SECTOR_PROTOCOL_VERSION;
  const rooms = new Map<string, Room>();
  const seats = new Map<WebSocket, { room: Room; pilot: Pilot }>();
  const loading = new Set<WebSocket>();
  const joiningUsers = new Map<string, WebSocket>();
  let closed = false, lastTick: number | null = null, accumulated = 0, lastSnapshot = 0;
  const inputBudget = new WeakMap<WebSocket, { windowAt: number; count: number }>();
  const latencyProbeBudget = new WeakMap<WebSocket, number>();
  const roomRuntime = orbitalRuntimeForSectorProtocol(protocolVersion);
  const orbitalSectorPhysics: typeof stepFlight = (state, input, seconds, sector) =>
    stepFlight(state, input, seconds, sector, roomRuntime);
  const physics = options.physics ?? orbitalSectorPhysics;
  function publishOperationState(room: Room): void {
    if (!options.publishOperation || room.mission.id !== "rust-disc") return;
    const currentPlayers = room.pilots.filter((pilot) => pilot.socket?.readyState === WebSocket.OPEN).length;
    const phase: SectorOperationPresence["phase"] = currentPlayers === 0 || room.phase === "interrupted" || room.phase === "failed"
      ? "closed"
      : room.phase === "complete"
        ? "complete"
        : room.phase === "active"
          ? "active"
          : room.pilots.length > 0 && room.pilots.every((pilot) => pilot.socket?.readyState === WebSocket.OPEN && pilot.ready)
            ? "ready"
            : "assembling";
    const state = {
      instanceId: room.matchId,
      ownerUserId: room.ownerUserId,
      phase,
      currentPlayers,
      visibility: room.publicListing ? "public" as const : "unlisted" as const,
    };
    room.operationSync = room.operationSync
      .then(() => options.publishOperation!(state))
      .catch(() => undefined);
  }
  function publish(room: Room) {
    for (const own of room.pilots) {
      const snapshot: SectorSnapshot = {
        type: "sector_snapshot", version: protocolVersion, roomCode: room.code, missionId: room.mission.id,
        ...(protocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
          ? { simulation: ORBITAL_SECTOR_SIMULATION_CONTRACT }
          : {}),
        phase: room.phase, tick: room.tick, ownSlot: own.slot, hostSlot: room.hostSlot,
        capabilities: {
          vectorDrift: true,
          tacticalCommands: room.operation === null,
          ironEclipse: room.operation !== null,
        },
        command: room.command,
        ...(room.operation ? { operation: ironEclipseSnapshot(room.operation) } : {}),
        pilots: room.pilots.map(pilot => ({
          slot: pilot.slot, shipId: pilot.shipId, connected: pilot.socket?.readyState === WebSocket.OPEN,
          ready: pilot.ready, flight: pilot.flight,
        })),
        progress: own.progress, settlement: own.settlement,
        ...(own.scoutResult ? { scoutResult: own.scoutResult } : {}),
        ...(own.scoutResultStatus ? { scoutResultStatus: own.scoutResultStatus } : {}),
        ...(own.factionContact ? { factionContact: own.factionContact } : {}),
        ...(room.mission.id === "universe-patrol" && room.universePatrol && room.patrolFleet
          ? {
              hostileFleet: {
                patrolId: room.universePatrol.patrolId,
                callsign: room.universePatrol.callsign,
                locationId: room.universePatrol.locationId,
                faction: room.universePatrol.faction,
                ships: room.patrolFleet.map((ship) => ({ ...ship, position: { ...ship.position } })),
              } satisfies SectorHostileFleetSnapshot,
            }
          : {}),
        ...(protocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION && room.mission.id === "pale-beacons"
          ? { evidence: PALE_BEACON_EVIDENCE.map((record): SectorEvidencePickup => ({
              ...record,
              position: { ...record.position },
              state: own.evidenceRecovered.has(record.id) ? "recovered"
                : own.evidenceRecovering.has(record.id) ? "recovering"
                  : own.evidenceUnavailable.has(record.id) || !options.recoverNarrativeEvidence
                    ? "unavailable" : "available",
            })) }
          : {}),
      };
      send(own.socket, snapshot);
    }
  }
  function updateFactionContact(room: Room, pilot: Pilot, input: FlightInput): FactionContactDecision | undefined {
    if (!room.scoutEncounter ||
        !["pale-beacons", "universe-patrol"].includes(room.mission.id) ||
        !room.scoutFaction) return undefined;
    const actorFaction = room.scoutFaction === "ussf" ? "accord" : "ussf";
    const delta = {
      x: pilot.flight.drone.position.x - pilot.flight.position.x,
      y: pilot.flight.drone.position.y - pilot.flight.position.y,
      z: pilot.flight.drone.position.z - pilot.flight.position.z,
    };
    const distanceMeters = vectorLength(delta);
    const previous = pilot.factionContact;
    const warningTicks = previous && (previous.stage === "warning" || previous.stage === "challenging")
      ? Math.max(0, room.tick - previous.enteredAtTick)
      : 0;
    const decision = decideFactionContact({
      actorFaction,
      pilotFaction: SHIPS[pilot.shipId].faction,
      territory: "contested",
      transponder: pilot.transponder,
      distanceMeters,
      sensorRangeMeters: 2100,
      speedMetersPerSecond: vectorLength(pilot.flight.velocity),
      speedLimitMetersPerSecond: SHIPS[pilot.shipId].maxSpeed * 2.5,
      lineOfSight: sensorLineOfSight(pilot.flight.position, pilot.flight.drone.position, room.flightSector),
      weaponsHot: input.fire || input.missile,
      targeting: input.lock || pilot.flight.lock > 0.05,
      recentHostileAction: pilot.lastHostileActionTick !== undefined &&
        room.tick - pilot.lastHostileActionTick <= 300,
      warningTicks,
      tick: room.tick,
    });
    return previous?.stage === decision.stage
      ? { ...decision, enteredAtTick: previous.enteredAtTick }
      : decision;
  }
  function releaseJoinReservation(userId: string, socket: WebSocket) {
    loading.delete(socket);
    if (joiningUsers.get(userId) === socket) joiningUsers.delete(userId);
  }
  function releaseSocketReservation(socket: WebSocket) {
    loading.delete(socket);
    for (const [userId, pendingSocket] of joiningUsers) {
      if (pendingSocket === socket) joiningUsers.delete(userId);
    }
  }
  async function settle(room: Room, pilot: Pilot, now: number) {
    if (!pilot.proof || pilot.settling || pilot.settlement.status === "recorded") return;
    if (!options.settle || !pilot.progress.persistenceAvailable) {
      pilot.settlement = { status: "unavailable", reason: "discovery_database_unavailable" };
      return;
    }
    pilot.settlement = { status: "pending", reason: "verifying_discovery" };
    pilot.settling = (async () => {
      try {
        const saved = await options.settle!(pilot.proof!);
        pilot.progress = saved.progress;
        pilot.settlement = { status: "recorded", reason: "discovery_and_mission_access_saved", replayed: saved.replayed };
      } catch {
        pilot.attempts++;
        pilot.nextRetry = now + 2000 * pilot.attempts;
        pilot.settlement = { status: "unavailable", reason: "discovery_not_confirmed_retry_available" };
      } finally { pilot.settling = null; publish(room); }
    })();
    await pilot.settling;
  }
  function finalizeScoutEncounter(
    room: Room,
    outcome: "completed" | "aborted",
    objectiveCompleted: boolean,
  ): void {
    if (!room.scoutEncounter) return;
    if (!room.scoutReceipt) {
      room.scoutReceipt = room.scoutEncounter.finalize(room.tick, outcome, objectiveCompleted);
    }
    const result = readExplorationReceipt(room.scoutReceipt);
    for (const pilot of room.pilots) {
      const pilotResult = result.pilots.find((entry) => entry.playerId === pilot.userId);
      if (!pilotResult) continue;
      pilot.scoutResult = {
        encounterId: result.encounterId,
        missionId: result.missionId,
        sectorId: result.sectorId,
        runtime: result.runtime,
        policyId: result.policyId,
        outcome: result.outcome,
        finalTick: result.finalTick,
        objectiveCompleted: result.objectiveCompleted,
        kills: pilotResult.kills,
        assists: pilotResult.assists,
        destroyedActorIds: [...pilotResult.destroyedActorIds],
        rewardableNpcKills: pilotResult.rewardableNpcKills,
        creditsAwarded: 0,
        ...(result.patrol ? {
          patrolId: result.patrol.patrolId,
          patrolLocationId: result.patrol.locationId,
          opposingFaction: result.patrol.faction,
        } : {}),
        fingerprint: result.fingerprint,
      };
      pilot.scoutResultStatus = "pending";
    }
  }
  async function persistScoutResults(room: Room): Promise<void> {
    if (!room.scoutReceipt) return;
    if (room.scoutPersisting) return room.scoutPersisting;
    const entries = room.pilots.flatMap((pilot) =>
      pilot.scoutResult ? [{ userId: pilot.userId, result: pilot.scoutResult }] : []);
    if (!entries.length) return;
    const completed = readExplorationReceipt(room.scoutReceipt).outcome === "completed";
    if (completed ? !options.settleScoutEncounter : !options.recordScoutResults) {
      for (const pilot of room.pilots) if (pilot.scoutResult) pilot.scoutResultStatus = "unavailable";
      publish(room);
      return;
    }
    for (const pilot of room.pilots) if (pilot.scoutResult) pilot.scoutResultStatus = "pending";
    room.scoutPersisting = (async () => {
      try {
        if (completed) {
          const settlement = await options.settleScoutEncounter!(room.scoutReceipt!);
          if (settlement.status !== "settled" && settlement.status !== "duplicate") {
            throw new Error("completed_scout_reward_not_settled");
          }
          for (const pilot of room.pilots) {
            if (!pilot.scoutResult) continue;
            const award = settlement.awards.find((entry) => entry.playerId === pilot.userId);
            if (!award) throw new Error("completed_scout_award_missing");
            pilot.scoutResult.creditsAwarded = award.credits;
          }
        } else {
          await options.recordScoutResults!(entries);
        }
        for (const pilot of room.pilots) if (pilot.scoutResult) pilot.scoutResultStatus = "recorded";
      } catch {
        for (const pilot of room.pilots) if (pilot.scoutResult) pilot.scoutResultStatus = "unavailable";
      } finally {
        room.scoutPersisting = null;
        publish(room);
      }
    })();
    await room.scoutPersisting;
  }
  async function handle(socket: WebSocket, userId: string, missionId: string, code: string, packet: Record<string, unknown>, now = Date.now()) {
    const error = (reason: string) => send(socket, { type: "error", reason });
    if (closed) { error("server_restart"); return; }
    if (packet.type === "sector_join") {
      if (seats.has(socket) || loading.has(socket)) { error("already_joined"); return; }
      if (packet.version !== protocolVersion) { error("sector_version_mismatch"); return; }
      if (protocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION &&
          !isOrbitalSectorSimulationContract(packet.simulation)) {
        error("sector_simulation_mismatch"); return;
      }
      if (Object.keys(packet).some(key => ![
        "type", "version", "shipId", "publicListing",
        ...(protocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION ? ["simulation"] : []),
      ].includes(key)) ||
          (packet.publicListing !== undefined && typeof packet.publicListing !== "boolean")) { error("invalid_sector_join"); return; }
      const mission = sectorMission(missionId);
      if (!mission || !/^[a-z0-9][a-z0-9-]{5,23}$/i.test(code) ||
          typeof packet.shipId !== "string" || !Object.hasOwn(SHIPS, packet.shipId)) { error("invalid_sector_join"); return; }
      if ((mission.id === "pale-beacons" || mission.id === "universe-patrol") &&
          protocolVersion !== SECTOR_ORBITAL_PROTOCOL_VERSION) {
        error("scout_requires_orbital_runtime"); return;
      }
      const existingOtherRoom = [...rooms.values()].some(candidate =>
        candidate.code !== code && candidate.pilots.some(pilot => pilot.userId === userId));
      if (existingOtherRoom) { error("sector_session_exists"); return; }
      const pendingJoin = joiningUsers.get(userId);
      if (pendingJoin && pendingJoin !== socket) { error("sector_session_exists"); return; }
      joiningUsers.set(userId, socket);
      loading.add(socket);
      let progress: SectorProgress;
      try {
        progress = options.loadProgress ? await options.loadProgress(userId) : { completed: [], persistenceAvailable: false };
      } catch { error("discovery_database_unavailable"); return; }
      finally { releaseJoinReservation(userId, socket); }
      if (closed || socket.readyState !== WebSocket.OPEN) return;
      if (mission.prerequisite && !progress.completed.includes(mission.prerequisite)) { error("sector_mission_locked"); return; }
      let room = rooms.get(code);
      let universePatrol = room?.universePatrol ?? null;
      if (mission.id === "universe-patrol") {
        const faction = SHIPS[packet.shipId as ShipId].faction;
        if (room && faction !== room.scoutFaction) { error("scout_faction_mismatch"); return; }
        if (!room) {
          if (!options.resolveUniversePatrol) { error("universe_patrol_unavailable"); return; }
          try { universePatrol = await options.resolveUniversePatrol(userId, faction); }
          catch { error("universe_patrol_unavailable"); return; }
          if (!universePatrol) { error("no_opposing_patrol_at_location"); return; }
        }
      }
      if (room && room.mission.id !== mission.id) { error("sector_mission_mismatch"); return; }
      if (room && (mission.id === "pale-beacons" || mission.id === "universe-patrol") &&
          SHIPS[packet.shipId as ShipId].faction !== room.scoutFaction) {
        error("scout_faction_mismatch"); return;
      }
      const publicOperationRequested = mission.id === "rust-disc" &&
        (room ? room.publicListing : packet.publicListing === true);
      if (publicOperationRequested) {
        if (!options.isAtCinderRing) { error("operation_location_unavailable"); return; }
        try {
          if (!await options.isAtCinderRing(userId)) { error("operation_not_at_location"); return; }
        } catch {
          error("operation_location_unavailable"); return;
        }
      }
      const previousSeat = [...seats.entries()].find(([, seat]) => seat.pilot.userId === userId);
      if (previousSeat && previousSeat[1].room !== room) {
        error("sector_session_exists");
        return;
      }
      if (!room) {
        if (rooms.size >= 32) { error("sector_capacity"); return; }
        room = {
          code, matchId: randomUUID(), mission, pilots: [], hostSlot: 0, phase: "lobby",
          ownerUserId: userId, publicListing: packet.publicListing === true, operationSync: Promise.resolve(),
          tick: 0, droneHull: mission.sector.droneHull ?? 60, touched: now,
          command: null, commandAt: null,
          operation: mission.id === "iron-eclipse" ? createIronEclipseState(mission.sector) : null,
          scoutFaction: SHIPS[packet.shipId as ShipId].faction,
          scoutPersisting: null,
          scoutPosition: { ...(mission.sector.drone ?? mission.sector.relay) },
          ...(universePatrol ? { universePatrol } : {}),
          ...(mission.id === "universe-patrol" && universePatrol
            ? { patrolFleet: buildPatrolFleet(universePatrol) }
            : {}),
          // Keep a per-room mutable wrapper so the hot simulation loop does
          // not allocate a replacement sector object for every pilot/tick.
          flightSector: { ...mission.sector },
        };
        rooms.set(code, room);
      }
      if (previousSeat && previousSeat[0] !== socket) {
        detach(previousSeat[0], now);
        previousSeat[0].close(4001, "Session moved");
      }
      let pilot = room.pilots.find(p => p.userId === userId);
      if (pilot?.disconnectedAt !== null && pilot?.disconnectedAt !== undefined &&
          now - pilot.disconnectedAt > 5000 && room.phase !== "lobby" && pilot.flight.stage !== "complete") {
        error("sector_reconnect_expired"); return;
      }
      if (!pilot && room.phase !== "lobby") { error("sector_match_in_progress"); return; }
      if (room.phase === "interrupted") { error("server_restart"); return; }
      if (!pilot && room.pilots.length >= 8) { error("sector_room_full"); return; }
      if (!pilot) {
        const shipId = packet.shipId as ShipId;
        const slot = Array.from({ length: 8 }, (_, index) => index).find(index => !room!.pilots.some(p => p.slot === index))!;
        pilot = {
          userId, slot, shipId, socket, ready: false, flight: createFlight(shipId, mission.sector),
          input: neutral(), seq: -1, lastInput: now, disconnectedAt: null,
          transponder: "broadcast", transponderChangedAt: null,
          activeTicks: 0, acceptedInputs: 0, progress,
          evidenceRecovered: new Set(), evidenceRecovering: new Set(), evidenceUnavailable: new Set(),
          evidenceActionAt: null,
          settlement: { status: "not_started", reason: "complete_server_mission_to_record_discovery" },
          proof: null, settling: null, nextRetry: 0, attempts: 0,
        };
        pilot.flight.position.x = slot * 8;
        room.pilots.push(pilot);
      }
      pilot.socket = socket; pilot.disconnectedAt = null; pilot.seq = -1;
      pilot.input = neutral(); pilot.lastInput = now; pilot.progress = progress;
      seats.set(socket, { room, pilot }); room.touched = now; publish(room); publishOperationState(room); return;
    }
    const seat = seats.get(socket);
    if (!seat || seat.pilot.userId !== userId) { error("sector_join_required"); return; }
    const { room, pilot } = seat;
    if (packet.type === "sector_ping") {
      if (Object.keys(packet).length !== 2 || !Number.isSafeInteger(packet.nonce) ||
          (packet.nonce as number) < 1 || (packet.nonce as number) > 2_147_483_647) {
        error("invalid_sector_ping"); return;
      }
      const lastProbeAt = latencyProbeBudget.get(socket);
      if (lastProbeAt !== undefined && now - lastProbeAt < 1000) return;
      latencyProbeBudget.set(socket, now);
      send(socket, { type: "sector_pong", nonce: packet.nonce });
      return;
    }
    room.touched = now;
    if (packet.type === "sector_ready") {
      if (Object.keys(packet).length !== 2 || typeof packet.ready !== "boolean" || room.phase !== "lobby") { error("invalid_sector_ready"); return; }
      pilot.ready = packet.ready; publish(room); publishOperationState(room); return;
    }
    if (packet.type === "sector_transponder") {
      const mode = parseSectorTransponder(packet);
      if (!mode || !["pale-beacons", "universe-patrol"].includes(room.mission.id) || room.phase !== "active") {
        error("invalid_sector_transponder"); return;
      }
      if (mode === pilot.transponder) { publish(room); return; }
      if (pilot.transponderChangedAt !== null && now - pilot.transponderChangedAt < 1000) {
        error("sector_transponder_rate_limited"); return;
      }
      pilot.transponder = mode;
      pilot.transponderChangedAt = now;
      publish(room); return;
    }
    if (packet.type === "sector_recover_evidence") {
      if (!parseSectorEvidenceRecovery(packet) || room.mission.id !== "pale-beacons" ||
          protocolVersion !== SECTOR_ORBITAL_PROTOCOL_VERSION || room.phase !== "active" || !room.scoutEncounter) {
        error("invalid_sector_evidence_recovery"); return;
      }
      if (pilot.evidenceActionAt !== null && now - pilot.evidenceActionAt < 900) {
        error("sector_evidence_rate_limited"); return;
      }
      pilot.evidenceActionAt = now;
      const nearest = PALE_BEACON_EVIDENCE
        .filter((record) => !pilot.evidenceRecovered.has(record.id) && !pilot.evidenceRecovering.has(record.id))
        .map((record) => ({
          record,
          distance: vectorLength({
            x: pilot.flight.position.x - record.position.x,
            y: pilot.flight.position.y - record.position.y,
            z: pilot.flight.position.z - record.position.z,
          }),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > EVIDENCE_RECOVERY_RADIUS_METERS ||
          !sensorLineOfSight(pilot.flight.position, nearest.record.position, room.flightSector)) {
        error("evidence_not_in_recovery_range"); return;
      }
      if (!options.recoverNarrativeEvidence) {
        pilot.evidenceUnavailable.add(nearest.record.id);
        publish(room);
        error("evidence_archive_unavailable"); return;
      }
      pilot.evidenceUnavailable.delete(nearest.record.id);
      pilot.evidenceRecovering.add(nearest.record.id);
      publish(room);
      void options.recoverNarrativeEvidence(pilot.userId, nearest.record.id, room.matchId)
        .then((result) => {
          if (result === "recovered" || result === "duplicate") {
            pilot.evidenceRecovered.add(nearest.record.id);
          } else {
            pilot.evidenceUnavailable.add(nearest.record.id);
            error("evidence_archive_unavailable");
          }
        })
        .catch(() => {
          pilot.evidenceUnavailable.add(nearest.record.id);
          error("evidence_archive_unavailable");
        })
        .finally(() => {
          pilot.evidenceRecovering.delete(nearest.record.id);
          publish(room);
        });
      return;
    }
    if (packet.type === "sector_launch") {
      if (Object.keys(packet).length !== 1 || room.phase !== "lobby" || pilot.slot !== room.hostSlot) { error("sector_host_required"); return; }
      if (!room.pilots.every(p => p.socket?.readyState === WebSocket.OPEN && p.ready)) { error("sector_all_pilots_ready_required"); return; }
      if (room.mission.id === "pale-beacons") {
        if (protocolVersion !== SECTOR_ORBITAL_PROTOCOL_VERSION ||
            room.pilots.some((candidate) => SHIPS[candidate.shipId].faction !== room.scoutFaction)) {
          error("scout_faction_or_runtime_mismatch"); return;
        }
        const playerFaction = room.scoutFaction!;
        const scoutFaction = playerFaction === "ussf" ? "accord" : "ussf";
        room.scoutEncounter = new ExplorationEncounter({
          encounterId: room.matchId,
          sectorId: room.mission.sector.id,
          runtime: ORBITAL_RUNTIME_ID,
          authority: "server",
          mode: "universe-exploration",
          actors: [
            ...room.pilots.map((candidate) => ({
              id: `pilot-${candidate.slot}`,
              faction: SHIPS[candidate.shipId].faction,
              hull: 100,
              playerId: candidate.userId,
            })),
            {
              id: "scout-pale-beacons",
              faction: scoutFaction,
              hull: room.droneHull,
              rewardEligible: true,
            },
          ],
          // This first integration persists only the kill/assist result. No
          // client-authored result is accepted; all rewards settle server-side.
          rewardPolicy: {
            id: "pale-beacon-npc-bounty-v1",
            creditsPerNpcKill: 12,
            completionCredits: 0,
            maxCreditsPerEncounter: 24,
          },
        });
        room.scoutPosition = roamingPatrolPosition(0);
      }
      if (room.mission.id === "universe-patrol") {
        if (protocolVersion !== SECTOR_ORBITAL_PROTOCOL_VERSION || !room.universePatrol ||
            !options.reserveUniversePatrol ||
            room.pilots.some((candidate) => SHIPS[candidate.shipId].faction !== room.scoutFaction)) {
          error("scout_faction_or_runtime_mismatch"); return;
        }
        let reserved: UniversePatrolEncounter | null;
        try {
          reserved = await options.reserveUniversePatrol(
            room.pilots.map((candidate) => candidate.userId),
            room.scoutFaction!,
            room.universePatrol,
            room.matchId,
          );
        } catch {
          error("universe_patrol_reservation_failed"); return;
        }
        if (!reserved) { error("universe_patrol_unavailable_or_location_mismatch"); return; }
        room.universePatrol = reserved;
        room.patrolFleet = buildPatrolFleet(reserved);
        room.droneHull = room.patrolFleet.reduce((sum, ship) => sum + ship.hull, 0);
        room.scoutPosition = { ...(room.patrolFleet[0]?.position ?? room.mission.sector.drone!) };
        const opposingFaction = reserved.faction;
        room.scoutEncounter = new ExplorationEncounter({
          encounterId: room.matchId,
          missionId: "universe-patrol",
          sectorId: room.mission.sector.id,
          runtime: ORBITAL_RUNTIME_ID,
          authority: "server",
          mode: "universe-exploration",
          patrol: {
            patrolId: reserved.patrolId,
            locationId: reserved.locationId,
            faction: opposingFaction,
          },
          actors: [
            ...room.pilots.map((candidate) => ({
              id: `pilot-${candidate.slot}`,
              faction: SHIPS[candidate.shipId].faction,
              hull: 100,
              playerId: candidate.userId,
            })),
            ...room.patrolFleet.map((ship) => ({
              id: ship.actorId,
              faction: opposingFaction,
              hull: ship.hull,
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
      }
      room.phase = "active"; publish(room); publishOperationState(room); return;
    }
    if (packet.type === "sector_input") {
      const input = parseSectorInput(packet.input);
      if (Object.keys(packet).length !== 3 || !input || !Number.isSafeInteger(packet.seq) ||
          (packet.seq as number) < 0 || (packet.seq as number) <= pilot.seq || (packet.seq as number) > 2147483647) {
        error("invalid_sector_input"); return;
      }
      if (room.phase !== "active") return;
      let budget = inputBudget.get(socket);
      if (!budget || now - budget.windowAt >= 1000) {
        budget = { windowAt: now, count: 0 };
        inputBudget.set(socket, budget);
      }
      if (budget.count >= 30 || (pilot.seq >= 0 && (packet.seq as number) - pilot.seq > 120)) {
        error("sector_input_rate_limited");
        return;
      }
      budget.count++;
      pilot.seq = packet.seq as number; pilot.input = input; pilot.lastInput = now; pilot.acceptedInputs++; return;
    }
    if (packet.type === "sector_command") {
      if (room.phase !== "active") { error("sector_command_active_match_required"); return; }
      if (room.operation) { error("iron_eclipse_command_required"); return; }
      if (pilot.slot !== room.hostSlot) { error("sector_command_host_required"); return; }
      const request = parseSectorCommand(packet);
      if (!request) { error("invalid_sector_command"); return; }
      if (room.commandAt !== null && now - room.commandAt < 750) {
        error("sector_command_rate_limited");
        return;
      }
      let command: SectorTacticalCommand;
      if (request.order === "attack") {
        if (room.droneHull <= 0) { error("sector_command_target_unavailable"); return; }
        command = {
          order: "attack", target: "drone", targetSlot: null,
          issuedBySlot: pilot.slot, issuedAtTick: room.tick,
        };
      } else {
        const targetSlot = request.order === "regroup" ? room.hostSlot : request.targetSlot;
        const target = room.pilots.find(candidate =>
          candidate.slot === targetSlot &&
          candidate.slot !== pilot.slot &&
          candidate.socket?.readyState === WebSocket.OPEN);
        if (request.order !== "regroup" && !target) { error("sector_command_target_unavailable"); return; }
        command = {
          order: request.order, target: "pilot",
          targetSlot: request.order === "regroup" ? room.hostSlot : target!.slot,
          issuedBySlot: pilot.slot, issuedAtTick: room.tick,
        };
      }
      room.command = command;
      room.commandAt = now;
      publish(room);
      return;
    }
    if (packet.type === "iron_eclipse_order" || packet.type === "iron_eclipse_target") {
      if (!room.operation) { error("iron_eclipse_mission_required"); return; }
      if (room.phase !== "active") { error("iron_eclipse_active_match_required"); return; }
      if (pilot.slot !== room.hostSlot) { error("iron_eclipse_host_required"); return; }
      const request = parseIronEclipseCommand(packet);
      if (!request) { error("invalid_iron_eclipse_command"); return; }
      if (room.commandAt !== null && now - room.commandAt < 500) {
        error("iron_eclipse_command_rate_limited");
        return;
      }
      if (request.type === "iron_eclipse_target") {
        if (!setIronEclipseTarget(room.operation, request.target as IronEclipseSubsystemId)) {
          error("iron_eclipse_target_unavailable");
          return;
        }
      } else {
        setIronEclipseOrder(room.operation, request.order as IronEclipseOrder);
      }
      room.commandAt = now;
      publish(room);
      return;
    }
    if (packet.type === "sector_retry" && Object.keys(packet).length === 1) {
      if (now < pilot.nextRetry && !pilot.scoutResult) { error("sector_retry_later"); return; }
      if (pilot.proof) void settle(room, pilot, now);
      if (room.scoutReceipt) void persistScoutResults(room);
      return;
    }
    error("unknown_sector_message");
  }
  function detach(socket: WebSocket, now = Date.now()) {
    releaseSocketReservation(socket);
    inputBudget.delete(socket);
    latencyProbeBudget.delete(socket);
    const seat = seats.get(socket); seats.delete(socket);
    if (!seat || seat.pilot.socket !== socket) return;
    const { room, pilot } = seat;
    pilot.socket = null; pilot.disconnectedAt = now; pilot.input = neutral(); pilot.ready = false;
    if (room.command && (
      room.command.issuedBySlot === pilot.slot ||
      (room.command.target === "pilot" && room.command.targetSlot === pilot.slot)
    )) room.command = null;
    if (room.phase === "lobby") {
      room.pilots = room.pilots.filter(p => p !== pilot);
      room.hostSlot = room.pilots[0]?.slot ?? 0;
      const newHost = room.pilots.find((candidate) => candidate.slot === room.hostSlot);
      if (newHost && ["pale-beacons", "universe-patrol"].includes(room.mission.id)) {
        room.scoutFaction = SHIPS[newHost.shipId].faction;
      }
    }
    room.touched = now; publish(room); publishOperationState(room);
  }
  function advance(now = Date.now()) {
    if (closed) return;
    if (lastTick === null) lastTick = now;
    accumulated += Math.max(0, Math.min(5 * SECTOR_STEP, (now - lastTick) / 1000));
    lastTick = now;
    let steps = 0;
    while (accumulated >= SECTOR_STEP && steps++ < 5) {
      accumulated -= SECTOR_STEP;
      for (const room of rooms.values()) {
        if (room.phase !== "active") continue;
        room.tick++;
        if (room.tick > 900 / SECTOR_STEP) {
          room.phase = "interrupted";
          if (room.scoutEncounter) {
            finalizeScoutEncounter(room, "aborted", false);
            void persistScoutResults(room);
          }
          publishOperationState(room);
          continue;
        }
        if (room.operation) {
          if (room.pilots.some(p => p.flight.discoveries > 0)) markIronEclipseCapitalEngaged(room.operation);
          const host = room.pilots.find(p => p.slot === room.hostSlot);
          advanceIronEclipse(room.operation, SECTOR_STEP, host?.flight.position ?? room.mission.sector.relay, room.mission.sector.relay);
          room.droneHull = ironEclipseTarget(room.operation)?.hull ?? 0;
        }
        if (room.mission.id === "universe-patrol" && room.patrolFleet) {
          room.patrolFleet.forEach((ship, slot) => {
            if (!ship.destroyed) ship.position = universePatrolPosition(room.tick, slot);
          });
          room.droneHull = room.patrolFleet.reduce(
            (sum, ship) => sum + (ship.destroyed ? 0 : ship.hull),
            0,
          );
          const lead = room.patrolFleet.find((ship) => !ship.destroyed);
          if (lead) room.scoutPosition = { ...lead.position };
        } else if (room.scoutEncounter) {
          room.scoutPosition = roamingPatrolPosition(room.tick);
        }
        const pointDefenseDisabled = room.operation?.view.subsystems.some(
          item => item.id === "point-defense" && item.disabled,
        ) === true;
        const baseHostileFireDisabled =
          room.mission.sector.hostileFireDisabled === true || pointDefenseDisabled;
        const flightSector = room.flightSector;
        for (const pilot of room.pilots) {
          if (pilot.socket?.readyState !== WebSocket.OPEN) continue;
          const input = now - pilot.lastInput < 350 ? pilot.input : idleInput;
          const patrolTarget = room.mission.id === "universe-patrol"
            ? nearestLivingPatrolShip(room, pilot.flight.position)
            : undefined;
          if (room.scoutEncounter) {
            copyPosition(pilot.flight.drone.position, patrolTarget?.position ?? room.scoutPosition);
          }
          pilot.factionContact = updateFactionContact(room, pilot, input);
          const contactCanEngage = pilot.factionContact?.action === "intercept" ||
            pilot.factionContact?.action === "request_reinforcements";
          flightSector.hostileFireDisabled = baseHostileFireDisabled ||
            (!!room.scoutEncounter && !contactCanEngage);
          if (now - pilot.lastInput < 350 &&
              (input.throttle > 0.05 || Math.abs(input.pitch) + Math.abs(input.yaw) + Math.abs(input.roll) > 0.05 || input.fire)) pilot.activeTicks++;
          const operationTarget = room.operation ? ironEclipseTarget(room.operation) : undefined;
          if (room.operation) {
            const targetPosition = operationTarget?.position ?? room.operation.view.capitalPosition;
            copyPosition(pilot.flight.drone.position, targetPosition);
            if (pointDefenseDisabled) removeHostileProjectilesInPlace(pilot.flight.projectiles);
          }
          if (room.scoutEncounter) {
            copyPosition(pilot.flight.drone.position, patrolTarget?.position ?? room.scoutPosition);
          }
          const targetHullBefore = patrolTarget?.hull ?? room.droneHull;
          pilot.flight.drone.hull = room.mission.id === "universe-patrol"
            ? (patrolTarget?.hull ?? 0)
            : room.droneHull;
          const hullBefore = pilot.flight.hull;
          physics(pilot.flight, input, SECTOR_STEP, flightSector);
          if (room.scoutEncounter && targetHullBefore > pilot.flight.drone.hull) {
            const hullDamage = targetHullBefore - pilot.flight.drone.hull;
            room.scoutEncounter.recordDamage({
              eventId: `tick-${room.tick}-pilot-${pilot.slot}`,
              tick: room.tick,
              attackerActorId: `pilot-${pilot.slot}`,
              targetActorId: patrolTarget?.actorId ?? "scout-pale-beacons",
              hullDamage,
            });
            pilot.lastHostileActionTick = room.tick;
            if (patrolTarget) {
              patrolTarget.hull = Math.max(0, pilot.flight.drone.hull);
              patrolTarget.destroyed = patrolTarget.hull === 0;
              room.droneHull = room.patrolFleet!.reduce(
                (sum, ship) => sum + (ship.destroyed ? 0 : ship.hull),
                0,
              );
            }
          }
          if (room.operation) {
            const playerDamage = Math.max(0, room.droneHull - pilot.flight.drone.hull);
            if (playerDamage > 0) damageIronEclipseTarget(room.operation, playerDamage);
            room.droneHull = ironEclipseTarget(room.operation)?.hull ?? 0;
            if (room.operation.view.phase === "extract" && pilot.flight.stage === "drone") pilot.flight.stage = "extract";
            else if (room.operation.view.phase !== "extract" && pilot.flight.stage === "extract") pilot.flight.stage = "drone";
            const receivedDamage = Math.max(0, hullBefore - pilot.flight.hull);
            const absorbed = absorbWingDamage(room.operation, pilot.flight.position, room.mission.sector.relay, receivedDamage);
            if (absorbed > 0) {
              pilot.flight.hull = Math.min(100, pilot.flight.hull + absorbed);
              if (pilot.flight.stage === "destroyed" && pilot.flight.hull > 0) {
                pilot.flight.stage = room.operation.view.phase === "extract" ? "extract" : pilot.flight.discoveries > 0 ? "drone" : "relay";
              }
            }
          } else if (room.mission.id !== "universe-patrol") {
            room.droneHull = Math.min(room.droneHull, pilot.flight.drone.hull);
          }
          if (room.mission.id === "universe-patrol") {
            const remaining = room.patrolFleet?.filter((ship) => !ship.destroyed && ship.hull > 0) ?? [];
            if (remaining.length === 0) {
              room.droneHull = 0;
              for (const candidate of room.pilots) {
                if (!["complete", "destroyed"].includes(candidate.flight.stage)) candidate.flight.stage = "extract";
              }
            } else if (pilot.flight.stage === "extract" || pilot.flight.stage === "complete") {
              pilot.flight.stage = "drone";
            }
          }
          pilot.factionContact = updateFactionContact(room, pilot, input);
        }
        // Synchronize the shared objective for all pilots at the same authoritative tick.
        for (const pilot of room.pilots) {
          const patrolTarget = room.mission.id === "universe-patrol"
            ? nearestLivingPatrolShip(room, pilot.flight.position)
            : undefined;
          pilot.flight.drone.hull = room.mission.id === "universe-patrol"
            ? (patrolTarget?.hull ?? 0)
            : room.droneHull;
          if (room.scoutEncounter) {
            copyPosition(pilot.flight.drone.position, patrolTarget?.position ?? room.scoutPosition);
          }
          if (room.operation) {
            const targetPosition = ironEclipseTarget(room.operation)?.position ?? room.operation.view.capitalPosition;
            copyPosition(pilot.flight.drone.position, targetPosition);
          }
        }
        if (room.pilots.every(p => ["complete", "destroyed"].includes(p.flight.stage) ||
            (p.disconnectedAt !== null && now - p.disconnectedAt > 5000))) {
          let succeeded: boolean;
          if (room.operation) {
            succeeded = room.pilots.some(p => p.flight.stage === "complete");
            completeIronEclipse(room.operation, succeeded);
            room.phase = succeeded ? "complete" : "failed";
          } else {
            succeeded = room.pilots.some(p => p.flight.stage === "complete") &&
              (!["pale-beacons", "universe-patrol"].includes(room.mission.id) || room.droneHull <= 0);
            room.phase = succeeded ? "complete" : "failed";
          }
          if (room.scoutEncounter) {
            finalizeScoutEncounter(room, succeeded ? "completed" : "aborted", succeeded);
            void persistScoutResults(room);
          }
          for (const completedPilot of room.pilots) {
            if (completedPilot.flight.stage !== "complete" || completedPilot.proof ||
                completedPilot.settlement.status !== "not_started") continue;
            const proof: CompletedSectorMission = Object.freeze({
              matchId: room.matchId, userId: completedPilot.userId, missionId: room.mission.id, rulesVersion: 1,
              status: "completed", elapsed: completedPilot.flight.elapsed, activeTicks: completedPilot.activeTicks,
              acceptedInputs: completedPilot.acceptedInputs, discoveries: completedPilot.flight.discoveries,
              droneHull: room.droneHull, stage: "complete", connectedAtEnd: completedPilot.socket?.readyState === WebSocket.OPEN,
              ...(completedPilot.scoutResult ? { scoutResult: completedPilot.scoutResult } : {}),
            });
            if (validSectorCompletion(proof)) { completedPilot.proof = proof; void settle(room, completedPilot, now); }
            else completedPilot.settlement = { status: "not_eligible", reason: "verified_participation_required" };
          }
          publishOperationState(room);
        }
      }
    }
    for (const [code, room] of rooms) {
      for (const pilot of room.pilots) {
        if (pilot.proof && pilot.settlement.status === "unavailable" &&
            pilot.attempts > 0 && pilot.attempts < 3 && now >= pilot.nextRetry) void settle(room, pilot, now);
      }
      if (!room.pilots.some(p => p.socket?.readyState === WebSocket.OPEN) && now - room.touched > 10000) rooms.delete(code);
      else if (room.phase === "lobby" && now - room.touched > 900000) {
        room.phase = "interrupted"; publish(room); publishOperationState(room);
        for (const pilot of room.pilots) pilot.socket?.close(4002, "Lobby expired");
      }
      if (now - lastSnapshot >= 100) publish(room);
    }
    if (now - lastSnapshot >= 100) lastSnapshot = now;
  }
  return {
    handle, detach, advance,
    async flushOperationUpdates() {
      await Promise.all([...rooms.values()].map((room) => room.operationSync));
    },
    get roomCount() { return rooms.size; },
    async close() {
      closed = true;
      const pending: Promise<void>[] = [];
      for (const room of rooms.values()) {
        if (room.phase === "active" || room.phase === "lobby") room.phase = "interrupted";
          if (room.scoutEncounter && !room.scoutReceipt) {
            finalizeScoutEncounter(room, "aborted", false);
            pending.push(persistScoutResults(room));
          } else if (room.scoutPersisting) {
            pending.push(room.scoutPersisting);
          }
        publish(room); publishOperationState(room);
        for (const pilot of room.pilots) {
          if (pilot.settling) pending.push(pilot.settling);
          send(pilot.socket, { type: "interrupted", reason: "server_restart" });
          pilot.socket?.close(4002, "server_restart");
        }
      }
      await Promise.all(pending);
      await Promise.all([...rooms.values()].map((room) => room.operationSync));
      seats.clear(); rooms.clear(); loading.clear(); joiningUsers.clear();
    },
  };
}
