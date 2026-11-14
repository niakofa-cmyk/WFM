import { readFreeFlightRecoveryHint } from "./free-flight-recovery-hint";
import { isShipSubsystemTelemetry, type ShipSubsystemTelemetry } from "@workspace/orbital-sim";
import { isCombatRecoveryState } from "./combat-recovery-state";
import {
  ORBITAL_RULES_VERSION,
  FREE_FLIGHT_TARGETING_V1,
  FREE_FLIGHT_ASSIST_V1,
  BARREL_ROLL_CONTROL_PROTOCOL_V1,
  isFreeFlightTargetState,
  isEquipmentTelemetry,
  type EquipmentTelemetry,
  type FreeFlightTargetState,
  VECTOR_BOOST_PROTOCOL_V1,
  isVectorBoostDirection,
  type VectorBoostDirection,
  isFreeFlightEnvironmentV1,
  isFreeFlightSnapshotV1,
  normalizeFlightControls,
  type FlightControlFrame,
  type FreeFlightEnvironmentV1,
  type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import { currentWingSocketUrl } from "./socket-endpoint";
import { reconnectDelayMs } from "./reconnect-policy";
import { FreeFlightInputScheduler } from "./free-flight-input-scheduler";
import { freeFlightJoinPacket } from "./free-flight-opening";

export type FreeFlightConnectionState =
  | "connecting"
  | "authenticating"
  | "joined"
  | "reconnecting"
  | "unavailable";

export type ReceivedFreeFlightSnapshot = {
  snapshot: FreeFlightSnapshotV1;
  receivedAt: number;
};

type FreeFlightClientOptions = {
  openingEncounter?: boolean;
  getSessionToken: () => Promise<string | null>;
  onSnapshot: (frame: ReceivedFreeFlightSnapshot) => void;
  onEnvironment?: (environment: FreeFlightEnvironmentV1 | null) => void;
  onState?: (state: FreeFlightConnectionState, reason?: string) => void;
  onCombatPacket?: (packet: Record<string, unknown>) => void;
};

/** Authenticated adapter for the feature-gated server-owned free-flight stream. */
export class FreeFlightClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private attempt = 0;
  private nextInputSeq = 1;
  private generation = 0;
  private joined = false;
  private vectorBoostAvailable = false;
  private vectorBoostSeq = 1;
  private targetingAvailable = false;
  private nearestTargetingAvailable = false;
  private assistanceAvailable = false;
  private countermeasuresAvailable = false;
  private barrelRollAvailable = false;
  private countermeasureSeq = 1;
  private countermeasureReadyAt = 0;
  get canDeployCountermeasure() { return this.joined && this.countermeasuresAvailable; }
  get canControlBarrelRoll() { return this.joined && this.barrelRollAvailable; }
  get countermeasureCooldownMs() { return Math.max(0, this.countermeasureReadyAt - performance.now()); }
  private targetCycleSeq = 1;
  private lastTargetState: FreeFlightTargetState | null = null;
  private lastEquipmentState: EquipmentTelemetry | null = null;
  private subsystemSeq = 1;
  private subsystemsAvailable = false;
  private lastSubsystemState: ShipSubsystemTelemetry | null = null;
  get subsystemState() { return this.joined ? this.lastSubsystemState : null; }
  cycleSubsystem() {
    if (!this.joined || !this.subsystemsAvailable || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: "freeflight_subsystem_cycle", protocol: 1, seq: this.subsystemSeq++ }));
    return true;
  }
  get equipmentState() { return this.joined ? this.lastEquipmentState : null; }
  get targetState() {
    return this.joined && this.lastTargetState?.sessionInstanceId === this.sessionInstanceId
      ? this.lastTargetState : null;
  }
  get canSelectTarget() { return this.joined && this.targetingAvailable; }
  get canSelectNearestTarget() { return this.canSelectTarget && this.nearestTargetingAvailable; }

  selectNearestTarget() {
    if (!this.canSelectNearestTarget || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({
      type: "freeflight_target_nearest", protocol: FREE_FLIGHT_TARGETING_V1, seq: this.targetCycleSeq++,
    }));
    return true;
  }
  private sessionInstanceId: string | null = null;
  private ownActorId: string | null = null;
  private combatProgressTick = -1;
  private readonly inputScheduler = new FreeFlightInputScheduler();

  constructor(private readonly options: FreeFlightClientOptions) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  requestVectorBoost(direction: VectorBoostDirection) {
    if (!this.joined || !this.vectorBoostAvailable || !isVectorBoostDirection(direction) ||
        this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({
      type: "freeflight_vector_boost", protocol: VECTOR_BOOST_PROTOCOL_V1,
      seq: this.vectorBoostSeq++, direction,
    }));
    return true;
  }

  requestWingSupport() {
    const socket = this.socket;
    if (!this.joined || !this.assistanceAvailable || socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "freeflight_assist_call", protocol: FREE_FLIGHT_ASSIST_V1 }));
    return true;
  }

  respondToWingSupport(callId: string, accept: boolean) {
    const socket = this.socket;
    if (!this.joined || !this.assistanceAvailable || socket?.readyState !== WebSocket.OPEN ||
        !/^[0-9a-f-]{36}$/i.test(callId) || typeof accept !== "boolean") return false;
    socket.send(JSON.stringify({
      type: "freeflight_assist_response",
      protocol: FREE_FLIGHT_ASSIST_V1,
      callId,
      accept,
    }));
    return true;
  }

  stop() {
    this.targetingAvailable = false;
    this.nearestTargetingAvailable = false;
    this.assistanceAvailable = false;
    this.lastTargetState = null;
    this.lastEquipmentState = null;
    this.lastSubsystemState = null;
    this.subsystemsAvailable = false;
    this.vectorBoostAvailable = false;
    this.barrelRollAvailable = false;
    this.stopped = true;
    this.generation += 1;
    this.joined = false;
    this.sessionInstanceId = null;
    this.inputScheduler.reset();
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "Leaving Orbital free flight");
    }
  }

  sendControls(value: Partial<FlightControlFrame> & { lock?: boolean }) {
    const socket = this.socket;
    if (!this.joined || !socket || socket.readyState !== WebSocket.OPEN) return;
    if (value.countermeasure && this.countermeasuresAvailable) socket.send(JSON.stringify({
      type: "freeflight_countermeasure", protocol: 1, seq: this.countermeasureSeq++,
    }));
    // Consume the edge before the 20Hz continuous-input coalescer can drop it.
    if (value.lock && this.targetingAvailable) socket.send(JSON.stringify({
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: this.targetCycleSeq++,
    }));
    const controls = this.inputScheduler.next(
      normalizeFlightControls(value),
      typeof performance === "undefined" ? Date.now() : performance.now(),
    );
    if (!controls) return;
    const input = {
      version: ORBITAL_RULES_VERSION,
      seq: this.nextInputSeq++,
      targetId: null,
      throttle: controls.throttle,
      yaw: controls.yaw,
      pitch: controls.pitch,
      strafe: controls.strafe,
      vertical: controls.vertical,
      roll: controls.roll,
      fire: controls.fire,
      missile: controls.missile,
      boost: controls.boost,
      brake: controls.brake,
      inertial: controls.inertial,
      aimAssist: controls.aimAssist,
      countermeasure: false,
      ...(this.barrelRollAvailable && controls.maneuver?.version === 1 &&
        controls.maneuver.kind === "barrel-roll-control"
        ? { maneuver: controls.maneuver }
        : {}),
    };
    socket.send(JSON.stringify({ type: "freeflight_input", input }));
  }

  engagePatrol(targetActorId: string) {
    const socket = this.socket;
    if (!this.joined || !socket || socket.readyState !== WebSocket.OPEN ||
        !/^([A-Za-z0-9_:-]){8,80}$/.test(targetActorId)) return false;
    socket.send(JSON.stringify({ type: "freeflight_engage", targetActorId }));
    return true;
  }

  recoverDisabledPilot() {
    const socket = this.socket;
    if (!this.joined || !socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "freeflight_recover" }));
    return true;
  }

  private connect() {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.options.onState?.(this.attempt === 0 ? "connecting" : "reconnecting");
    let socket: WebSocket;
    try {
      const url = currentWingSocketUrl();
      url.search = "";
      url.searchParams.set("freeflight", "1");
      socket = new WebSocket(url);
    } catch (error) {
      this.scheduleReconnect(error instanceof Error ? error.message : "socket_url_invalid");
      return;
    }
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (!this.current(socket, generation)) return;
      this.options.onState?.("authenticating");
      void this.options.getSessionToken().then((token) => {
        if (!this.current(socket, generation)) return;
        if (!token) {
          this.scheduleReconnect("authentication_required");
          socket.close(1008, "Authentication required");
          return;
        }
        socket.send(JSON.stringify({ type: "authenticate", token }));
      }).catch(() => {
        if (!this.current(socket, generation)) return;
        this.scheduleReconnect("authentication_unavailable");
        socket.close(1011, "Authentication unavailable");
      });
    });

    socket.addEventListener("message", (event) => {
      if (!this.current(socket, generation)) return;
      let packet: Record<string, unknown>;
      try {
        const value: unknown = JSON.parse(String(event.data));
        if (!value || typeof value !== "object" || Array.isArray(value)) return;
        packet = value as Record<string, unknown>;
      } catch {
        return;
      }
      if (packet.type === "authenticated") {
        socket.send(JSON.stringify(freeFlightJoinPacket(this.options.openingEncounter)));
        return;
      }
      if (packet.type === "freeflight_joined") {
        const targeting = packet.targeting as { protocol?: unknown; nextSeq?: unknown; nearest?: unknown } | undefined;
        this.targetingAvailable = Boolean(targeting &&
          targeting.protocol === FREE_FLIGHT_TARGETING_V1 &&
          Number.isSafeInteger(targeting.nextSeq) && (targeting.nextSeq as number) > 0 &&
          (targeting.nextSeq as number) <= 0x7fffffff);
        if (targeting && this.targetingAvailable) this.targetCycleSeq = targeting.nextSeq as number;
        this.nearestTargetingAvailable = this.targetingAvailable && targeting?.nearest === true;
        this.lastTargetState = null;
        this.lastEquipmentState = null;
        this.lastSubsystemState = null;
        const subsystems = packet.subsystems as { protocol?: unknown; nextSeq?: unknown } | undefined;
        this.subsystemsAvailable = subsystems?.protocol === 1 &&
          Number.isSafeInteger(subsystems.nextSeq) && (subsystems.nextSeq as number) > 0;
        if (this.subsystemsAvailable) this.subsystemSeq = subsystems!.nextSeq as number;
          const assistance = packet.assistance as { protocol?: unknown } | undefined;
          this.assistanceAvailable = assistance?.protocol === FREE_FLIGHT_ASSIST_V1;
        const defenses = packet.countermeasures as { protocol?: unknown; nextSeq?: unknown; cooldownMs?: unknown } | undefined;
        this.countermeasuresAvailable = defenses?.protocol === 1 &&
          Number.isSafeInteger(defenses.nextSeq) && (defenses.nextSeq as number) > 0;
        if (this.countermeasuresAvailable) this.countermeasureSeq = defenses!.nextSeq as number;
        this.countermeasureReadyAt = performance.now() +
          (typeof defenses?.cooldownMs === "number" && Number.isFinite(defenses.cooldownMs)
            ? Math.max(0, Math.min(3500, defenses.cooldownMs)) : 0);
        const vector = packet.vectorBoost as { protocol?: unknown; nextSeq?: unknown } | undefined;
        this.vectorBoostAvailable = vector?.protocol === VECTOR_BOOST_PROTOCOL_V1 &&
          Number.isSafeInteger(vector.nextSeq) && (vector.nextSeq as number) > 0;
        if (this.vectorBoostAvailable) this.vectorBoostSeq = vector!.nextSeq as number;
        const barrelRoll = packet.barrelRoll as { protocol?: unknown } | undefined;
        this.barrelRollAvailable = barrelRoll?.protocol === BARREL_ROLL_CONTROL_PROTOCOL_V1;
        if (!Number.isSafeInteger(packet.nextInputSeq) ||
            (packet.nextInputSeq as number) < 1 ||
            (packet.nextInputSeq as number) > 0x7fffffff) {
          this.scheduleReconnect("invalid_input_sequence");
          socket.close(1008, "Invalid free-flight sequence");
          return;
        }
        this.nextInputSeq = packet.nextInputSeq as number;
        this.joined = true;
        this.inputScheduler.reset();
        this.attempt = 0;
        this.options.onState?.("joined");
        this.acceptSnapshot(packet.snapshot);
        this.acceptEnvironment(packet.environment);
        if (packet.openingEncounter) this.options.onCombatPacket?.({
          type: "freeflight_opening", status: packet.openingEncounter,
        });
        // Capability negotiation keeps older server/client pairs on their
        // existing movement rules during a rolling deployment.
        socket.send(JSON.stringify({ type: "freeflight_environment_request" }));
        return;
      }
      if (packet.type === "freeflight_combat_progress") {
        if (this.joined && isCombatRecoveryState(packet) &&
            packet.sessionInstanceId === this.sessionInstanceId && packet.actorId === this.ownActorId &&
            packet.tick >= this.combatProgressTick) {
          this.combatProgressTick = packet.tick;
          this.options.onCombatPacket?.(packet);
        }
        return;
      }
      if (packet.type === "freeflight_target_state") {
        const state: unknown = packet.state;
        if (this.targetingAvailable && isFreeFlightTargetState(state) &&
            state.sessionInstanceId === this.sessionInstanceId &&
            state.tick >= (this.lastTargetState?.tick ?? -1)) {
          this.lastTargetState = state;
        }
        return;
      }
      if (packet.type === "freeflight_equipment_state" && this.joined && isEquipmentTelemetry(packet)) {
        this.lastEquipmentState = packet;
        return;
      }
      if (packet.type === "freeflight_subsystem_state") {
        if (this.joined && isShipSubsystemTelemetry(packet) &&
            packet.sessionInstanceId === this.sessionInstanceId && packet.actorId === this.ownActorId &&
            packet.tick >= (this.lastSubsystemState?.tick ?? -1)) {
          this.lastSubsystemState = packet;
        }
        return;
      }
      if (packet.type === "freeflight_environment") {
        this.acceptEnvironment(packet.environment);
        return;
      }
      if (packet.type === "freeflight_snapshot") {
        this.acceptSnapshot(packet.snapshot);
        return;
      }
      if (packet.type === "freeflight_countermeasure_state") {
        if (packet.protocol === 1 && typeof packet.cooldownMs === "number" &&
            Number.isFinite(packet.cooldownMs) && packet.cooldownMs >= 0 && packet.cooldownMs <= 3500) {
          this.countermeasureReadyAt = performance.now() + packet.cooldownMs;
          this.options.onCombatPacket?.(packet);
        }
        return;
      }
      if (packet.type === "freeflight_world_impact" ||
          packet.type === "freeflight_vector_boost_state" ||
          packet.type === "freeflight_recovered" ||
          packet.type === "freeflight_assist_request" ||
          packet.type === "freeflight_assist_call_result" ||
          packet.type === "freeflight_assist_call_update" ||
          packet.type === "freeflight_engagement_started" ||
          packet.type === "freeflight_pvp_engagement_started" ||
          packet.type === "freeflight_pvp_result" ||
          packet.type === "freeflight_ally_joined" ||
          packet.type === "freeflight_engagement_state" ||
          packet.type === "freeflight_tactical_snapshot" ||
          packet.type === "freeflight_weapon_fired" ||
          packet.type === "freeflight_weapon_event" ||
          packet.type === "freeflight_combat_result") {
        this.options.onCombatPacket?.(packet);
        return;
      }
      if (packet.type === "error" && typeof packet.reason === "string") {
        if (packet.reason === "freeflight_recovery_required") {
          const recovery = readFreeFlightRecoveryHint(packet.recovery);
          if (recovery) this.options.onCombatPacket?.({ type: "freeflight_recovery_hint", recovery });
        }
        if (this.joined) {
          if (packet.reason !== "freeflight_unknown_message") {
            this.options.onCombatPacket?.({ type: "freeflight_error", reason: packet.reason });
          }
          return;
        }
        this.options.onState?.("unavailable", packet.reason);
        if (!this.joined ||
            packet.reason === "freeflight_not_authorized" ||
            packet.reason === "freeflight_session_full" ||
            packet.reason === "freeflight_capacity") {
          socket.close(1008, packet.reason);
        }
      }
    });

    socket.addEventListener("close", () => {
      if (!this.current(socket, generation)) return;
      this.socket = null;
      this.joined = false;
      this.sessionInstanceId = null;
      this.inputScheduler.reset();
      this.scheduleReconnect("socket_closed");
    });
    socket.addEventListener("error", () => {
      if (this.current(socket, generation)) socket.close();
    });
  }

  private acceptSnapshot(value: unknown) {
    if (!isFreeFlightSnapshotV1(value)) {
      this.options.onState?.("unavailable", "invalid_snapshot");
      return;
    }
    if (this.sessionInstanceId !== value.sessionInstanceId || this.ownActorId !== value.ownActorId)
      this.combatProgressTick = -1;
    this.sessionInstanceId = value.sessionInstanceId;
    this.ownActorId = value.ownActorId;
    this.options.onSnapshot({
      snapshot: value,
      receivedAt: typeof performance === "undefined" ? Date.now() : performance.now(),
    });
  }

  private acceptEnvironment(value: unknown) {
    if (!isFreeFlightEnvironmentV1(value)) {
      this.options.onEnvironment?.(null);
      return;
    }
    if (this.sessionInstanceId !== value.sessionInstanceId) return;
    this.options.onEnvironment?.(value);
  }

  private scheduleReconnect(reason: string) {
    if (this.stopped || this.reconnectTimer !== null) return;
    this.joined = false;
    this.sessionInstanceId = null;
    this.inputScheduler.reset();
    this.options.onState?.("reconnecting", reason);
    const delay = reconnectDelayMs(this.attempt++);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private current(socket: WebSocket, generation: number) {
    return !this.stopped && this.socket === socket && this.generation === generation;
  }
}
