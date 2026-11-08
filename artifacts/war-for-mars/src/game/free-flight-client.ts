import {
  ORBITAL_RULES_VERSION,
  isFreeFlightEnvironmentV1,
  isFreeFlightSnapshotV1,
  normalizeFlightControls,
  type FlightControlFrame,
  type FreeFlightEnvironmentV1,
  type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import { currentWingSocketUrl } from "./socket-endpoint";
import { reconnectDelayMs } from "./reconnect-policy";

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

  constructor(private readonly options: FreeFlightClientOptions) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.generation += 1;
    this.joined = false;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "Leaving Orbital free flight");
    }
  }

  sendControls(value: Partial<FlightControlFrame>) {
    const socket = this.socket;
    if (!this.joined || !socket || socket.readyState !== WebSocket.OPEN) return;
    const controls = normalizeFlightControls(value);
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
      countermeasure: controls.countermeasure,
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
        socket.send(JSON.stringify({ type: "freeflight_join" }));
        return;
      }
      if (packet.type === "freeflight_joined") {
        if (!Number.isSafeInteger(packet.nextInputSeq) ||
            (packet.nextInputSeq as number) < 1 ||
            (packet.nextInputSeq as number) > 0x7fffffff) {
          this.scheduleReconnect("invalid_input_sequence");
          socket.close(1008, "Invalid free-flight sequence");
          return;
        }
        this.nextInputSeq = packet.nextInputSeq as number;
        this.joined = true;
        this.attempt = 0;
        this.options.onState?.("joined");
        this.acceptSnapshot(packet.snapshot);
        this.acceptEnvironment(packet.environment);
        // Capability negotiation keeps older server/client pairs on their
        // existing movement rules during a rolling deployment.
        socket.send(JSON.stringify({ type: "freeflight_environment_request" }));
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
      if (packet.type === "freeflight_engagement_started" ||
          packet.type === "freeflight_engagement_state" ||
          packet.type === "freeflight_weapon_fired" ||
          packet.type === "freeflight_weapon_event" ||
          packet.type === "freeflight_combat_result") {
        this.options.onCombatPacket?.(packet);
        return;
      }
      if (packet.type === "error" && typeof packet.reason === "string") {
        if (this.joined) {
          this.options.onCombatPacket?.({ type: "freeflight_error", reason: packet.reason });
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
    this.options.onSnapshot({
      snapshot: value,
      receivedAt: typeof performance === "undefined" ? Date.now() : performance.now(),
    });
  }

  private acceptEnvironment(value: unknown) {
    this.options.onEnvironment?.(
      isFreeFlightEnvironmentV1(value) ? value : null,
    );
  }

  private scheduleReconnect(reason: string) {
    if (this.stopped || this.reconnectTimer !== null) return;
    this.joined = false;
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
