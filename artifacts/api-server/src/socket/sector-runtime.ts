import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import {
  isOrbitalSectorSimulationContract,
  orbitalRuntimeForSectorProtocol,
  ORBITAL_SECTOR_SIMULATION_CONTRACT,
  SECTOR_ORBITAL_PROTOCOL_VERSION,
} from "@workspace/orbital-sim";
import { SHIPS, type ShipId } from "../game/ships";
import { createFlight, stepFlight, removeHostileProjectilesInPlace, NEUTRAL_FLIGHT_INPUT, type FlightInput, type FlightSector, type FlightState } from "../game/flight-sector";
import {
  sectorMission, SECTOR_STEP, type SectorMission, type SectorProgress,
  type SectorCommandRequest, type SectorSnapshot, type SectorSettlement, type SectorTacticalCommand,
  type IronEclipseCommandRequest, type IronEclipseOrder, type IronEclipseSubsystemId, type SectorProtocolVersion,
  SECTOR_PROTOCOL_VERSION,
} from "../game/sector-missions";
import { validSectorCompletion, type CompletedSectorMission } from "../game/sector-completion";
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
};
type Room = {
  code: string; matchId: string; mission: SectorMission; pilots: Pilot[]; hostSlot: number;
  ownerUserId: string; publicListing: boolean; operationSync: Promise<void>;
  phase: SectorSnapshot["phase"]; tick: number; droneHull: number; touched: number;
  command: SectorTacticalCommand | null; commandAt: number | null;
  operation: IronEclipseState | null;
  flightSector: FlightSector;
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
  isAtCinderRing?: (userId: string) => Promise<boolean>;
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
      };
      send(own.socket, snapshot);
    }
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
      if (room && room.mission.id !== mission.id) { error("sector_mission_mismatch"); return; }
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
          activeTicks: 0, acceptedInputs: 0, progress,
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
    if (packet.type === "sector_launch") {
      if (Object.keys(packet).length !== 1 || room.phase !== "lobby" || pilot.slot !== room.hostSlot) { error("sector_host_required"); return; }
      if (!room.pilots.every(p => p.socket?.readyState === WebSocket.OPEN && p.ready)) { error("sector_all_pilots_ready_required"); return; }
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
      if (now < pilot.nextRetry) { error("sector_retry_later"); return; }
      void settle(room, pilot, now); return;
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
        if (room.tick > 900 / SECTOR_STEP) { room.phase = "interrupted"; continue; }
        if (room.operation) {
          if (room.pilots.some(p => p.flight.discoveries > 0)) markIronEclipseCapitalEngaged(room.operation);
          const host = room.pilots.find(p => p.slot === room.hostSlot);
          advanceIronEclipse(room.operation, SECTOR_STEP, host?.flight.position ?? room.mission.sector.relay, room.mission.sector.relay);
          room.droneHull = ironEclipseTarget(room.operation)?.hull ?? 0;
        }
        const pointDefenseDisabled = room.operation?.view.subsystems.some(
          item => item.id === "point-defense" && item.disabled,
        ) === true;
        room.flightSector.hostileFireDisabled =
          room.mission.sector.hostileFireDisabled === true || pointDefenseDisabled;
        const flightSector = room.flightSector;
        for (const pilot of room.pilots) {
          if (pilot.socket?.readyState !== WebSocket.OPEN) continue;
          const input = now - pilot.lastInput < 350 ? pilot.input : idleInput;
          if (now - pilot.lastInput < 350 &&
              (input.throttle > 0.05 || Math.abs(input.pitch) + Math.abs(input.yaw) + Math.abs(input.roll) > 0.05 || input.fire)) pilot.activeTicks++;
          const operationTarget = room.operation ? ironEclipseTarget(room.operation) : undefined;
          if (room.operation) {
            const targetPosition = operationTarget?.position ?? room.operation.view.capitalPosition;
            copyPosition(pilot.flight.drone.position, targetPosition);
            if (pointDefenseDisabled) removeHostileProjectilesInPlace(pilot.flight.projectiles);
          }
          pilot.flight.drone.hull = room.droneHull;
          const hullBefore = pilot.flight.hull;
          physics(pilot.flight, input, SECTOR_STEP, flightSector);
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
          } else {
            room.droneHull = Math.min(room.droneHull, pilot.flight.drone.hull);
          }
          if (pilot.flight.stage === "complete" && !pilot.proof && pilot.settlement.status === "not_started") {
            const proof: CompletedSectorMission = Object.freeze({
              matchId: room.matchId, userId: pilot.userId, missionId: room.mission.id, rulesVersion: 1,
              status: "completed", elapsed: pilot.flight.elapsed, activeTicks: pilot.activeTicks,
              acceptedInputs: pilot.acceptedInputs, discoveries: pilot.flight.discoveries,
              droneHull: room.droneHull, stage: "complete", connectedAtEnd: true,
            });
            if (validSectorCompletion(proof)) { pilot.proof = proof; void settle(room, pilot, now); }
            else pilot.settlement = { status: "not_eligible", reason: "verified_participation_required" };
          }
        }
        // Synchronize the shared objective for all pilots at the same authoritative tick.
        for (const pilot of room.pilots) {
          pilot.flight.drone.hull = room.droneHull;
          if (room.operation) {
            const targetPosition = ironEclipseTarget(room.operation)?.position ?? room.operation.view.capitalPosition;
            copyPosition(pilot.flight.drone.position, targetPosition);
          }
        }
        if (room.pilots.every(p => ["complete", "destroyed"].includes(p.flight.stage) ||
            (p.disconnectedAt !== null && now - p.disconnectedAt > 5000))) {
          if (room.operation) {
            const succeeded = room.pilots.some(p => p.flight.stage === "complete");
            completeIronEclipse(room.operation, succeeded);
            room.phase = succeeded ? "complete" : "failed";
          } else room.phase = "complete";
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
