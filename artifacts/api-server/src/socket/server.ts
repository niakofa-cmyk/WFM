import { randomInt, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { socketOriginAllowed } from "./origin-policy";
import type { SocketSessionVerifier } from "./clerk-session-verifier";
import {
  createWing,
  DISCONNECT_GRACE_MS,
  isMeaningfulWingInput,
  MAX_PLAYERS,
  TICK_RATE,
  type WingInput,
} from "../game/wing";
import { outcomeForTeam } from "../game/sim";
import type {
  CompletedWingMatch,
  WingMatchMode,
  WingRewardNotice,
  WingTeam,
} from "../game/wing-reward-policy";

const MAX_ROOMS = 64;
const MAX_COMPETITIVE_QUEUE = 1_000;
const COMPETITIVE_QUEUE_WAIT_MS = 15 * 60_000;
const DEFAULT_CASUAL_AI_FILL_WAIT_MS = 30_000;
const ROOM_IDLE_MS = DISCONNECT_GRACE_MS * 2;
const LOBBY_IDLE_MS = 15 * 60_000;
const ROOM_ID = /^[a-z0-9][a-z0-9-]{5,23}$/i;
const AUTH_QUERY_PARAMETER =
  /^(?:token|access_token|session_token|auth_token|authorization|jwt)$/i;
const SOCKET_AUTH_TIMEOUT_MS = 5_000;
const MAX_SESSION_TOKEN_LENGTH = 8 * 1024;

type Room = {
  id: string;
  wing: ReturnType<typeof createWing>;
  sockets: Set<WebSocket>;
  slotSockets: Map<number, WebSocket>;
  emptySince: number | null;
  phase: "lobby" | "active";
  matchMode: WingMatchMode;
  autoStartAt: number | null;
  lastCountdownSecond: number | null;
  hostSlotId: number | null;
  readySlots: Set<number>;
  lastActivityAt: number;
  matchId: string | null;
  matchParticipants: Map<number, MatchParticipant>;
  admittedPlayerIds: Set<string> | null;
  lastTickAt: number;
  settlementPromise: Promise<void> | null;
  settlementDone: boolean;
  settlementAttempts: number;
  nextSettlementAt: number;
  pendingNoticeSent: boolean;
  rewardNotices: Map<string, WingRewardNotice>;
};

type MatchParticipant = {
  playerId: string;
  slotId: number;
  team: WingTeam;
  acceptedInputs: number;
  activeMs: number;
  lastParticipatingInputAt: number | null;
};

type Client = {
  socket: WebSocket;
  playerId: string | null;
  authenticating: boolean;
  roomId: string;
  room: Room | null;
  slotId: number | null;
  messageWindow: number;
  messageCount: number;
  inputWindow: number;
  inputCount: number;
  invalidInputs: number;
  isAlive: boolean;
  lastInputAt: number;
  queueRequested: boolean;
  aiFillQueueRequested: boolean;
  queueEnteredAt: number | null;
};

type PendingCompetitiveAssignment = {
  roomId: string;
  reconnectToken: string;
  expiresAt: number;
};

type ShutdownNoticeResult =
  "acknowledged" | "closed" | "timeout" | "send_error";

const MAX_MESSAGES_PER_SECOND = 80;
const MAX_INPUTS_PER_SECOND = 45;
export async function startWingSocketServer(
  port: number,
  host = "0.0.0.0",
  options: {
    verifySessionToken: SocketSessionVerifier;
    enableCompetitiveQueue?: boolean;
    enableCasualAiQueue?: boolean;
    enableWingRewards?: boolean;
    casualAiFillWaitMs?: number;
    /**
     * Trusted server-only resolver. It must return "competitive" only for
     * room IDs issued by an authoritative competitive queue. Never derive this
     * from a client packet, room-code format, or environment string.
     */
    resolveServerMatchMode?: (roomId: string) => WingMatchMode;
    settleWingMatch?: (
      input: CompletedWingMatch,
    ) => Promise<Map<string, WingRewardNotice>>;
    tickIntervalMs?: number;
    snapshotIntervalMs?: number;
    allowedOrigins?: ReadonlySet<string>;
    shutdownAckTimeoutMs?: number;
  },
) {
  const rooms = new Map<string, Room>();
  const clients = new Map<WebSocket, Client>();
  const competitiveQueue: Client[] = [];
  const casualAiFillWaitMs = options.casualAiFillWaitMs ?? DEFAULT_CASUAL_AI_FILL_WAIT_MS;
  let casualAiRoomId: string | null = null;
  const pendingCompetitiveAssignments = new Map<
    string,
    PendingCompetitiveAssignment
  >();
  const shutdownAckWaiters = new Map<
    WebSocket,
    (result: ShutdownNoticeResult) => void
  >();
  const tickIntervalMs = options.tickIntervalMs ?? 1000 / TICK_RATE;
  const snapshotIntervalMs = options.snapshotIntervalMs ?? 1000 / TICK_RATE;
  const shutdownAckTimeoutMs = options.shutdownAckTimeoutMs ?? 1_500;
  let isShuttingDown = false;
  let closePromise: Promise<void> | null = null;

  const httpServer = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 8 * 1024,
    perMessageDeflate: false,
  });
  const connectionRequests = new WeakMap<
    WebSocket,
    {
      roomId: string;
      queueRequested: boolean;
      aiFillQueueRequested: boolean;
    }
  >();

  httpServer.on("upgrade", (request, socket, head) => {
    if (isShuttingDown) {
      rejectUpgrade(socket, "503 Service Unavailable");
      return;
    }
    if (!socketOriginAllowed(request.headers.origin, options.allowedOrigins)) {
      rejectUpgrade(socket, "403 Forbidden");
      return;
    }
    let url: URL;
    try {
      url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`,
      );
    } catch {
      rejectUpgrade(socket, "400 Bad Request");
      return;
    }
    if (
      [...url.searchParams.keys()].some((key) => AUTH_QUERY_PARAMETER.test(key))
    ) {
      rejectUpgrade(socket, "400 Bad Request");
      return;
    }
    const roomId = (url.searchParams.get("room") ?? "").trim().toLowerCase();
    const queueOnly =
      !url.searchParams.has("room") && url.searchParams.size === 1;
    const competitiveQueueRequested =
      queueOnly && url.searchParams.get("queue") === "competitive";
    const aiFillQueueRequested =
      queueOnly && url.searchParams.get("queue") === "casual-ai";
    const queueRequested =
      competitiveQueueRequested || aiFillQueueRequested;
    const roomRequested =
      !url.searchParams.has("queue") &&
      ROOM_ID.test(roomId);
    if (
      competitiveQueueRequested &&
      options.enableCompetitiveQueue !== true
    ) {
      rejectUpgrade(socket, "503 Service Unavailable");
      return;
    }
    if (
      aiFillQueueRequested &&
      options.enableCasualAiQueue !== true
    ) {
      rejectUpgrade(socket, "503 Service Unavailable");
      return;
    }
    if (
      (url.pathname !== "/ws" && url.pathname !== "/ws/") ||
      (!queueRequested && !roomRequested)
    ) {
      rejectUpgrade(socket, "400 Bad Request");
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      connectionRequests.set(client, {
        roomId: queueRequested ? "" : roomId,
        queueRequested,
        aiFillQueueRequested,
      });
      sockets.emit("connection", client, request);
    });
  });

  function createRoom(roomId: string, matchMode: WingMatchMode): Room {
    return {
      id: roomId,
      wing: createWing(randomInt(1, 0x7fffffff)),
      sockets: new Set(),
      slotSockets: new Map(),
      emptySince: null,
      phase: "lobby",
      matchMode,
      autoStartAt: null,
      lastCountdownSecond: null,
      hostSlotId: null,
      readySlots: new Set(),
      lastActivityAt: Date.now(),
      matchId: null,
      matchParticipants: new Map(),
      admittedPlayerIds: matchMode === "competitive" ? new Set() : null,
      lastTickAt: Date.now(),
      settlementPromise: null,
      settlementDone: false,
      settlementAttempts: 0,
      nextSettlementAt: 0,
      pendingNoticeSent: false,
      rewardNotices: new Map(),
    };
  }

  function publishCompetitiveQueueStatus(reason?: string) {
    const statusReason =
      reason ?? (rooms.size >= MAX_ROOMS ? "server_capacity" : undefined);
    competitiveQueue.forEach((queuedClient, index) => {
      const socket = socketForClient(queuedClient);
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      send(socket, {
        type: "queue_status",
        mode: "competitive",
        position: index + 1,
        queuedCount: competitiveQueue.length,
        requiredPilots: MAX_PLAYERS,
        ...(statusReason ? { reason: statusReason } : {}),
      });
    });
  }

  function socketForClient(client: Client) {
    return client.socket;
  }

  function removeFromCompetitiveQueue(client: Client) {
    const index = competitiveQueue.indexOf(client);
    if (index < 0) return false;
    competitiveQueue.splice(index, 1);
    client.queueEnteredAt = null;
    publishCompetitiveQueueStatus();
    return true;
  }

  function attachQueuedPilot(
    socket: WebSocket,
    client: Client,
    room: Room,
    reconnectToken?: string,
  ): { slotId: number; team: 0 | 1; reconnectToken: string } | null {
    const playerId = client.playerId;
    if (!playerId) return null;
    const result = room.wing.join(playerId, "Pilot", reconnectToken);
    if (!result.ok) return null;
    const previous = room.slotSockets.get(result.slotId);
    client.roomId = room.id;
    client.room = room;
    client.slotId = result.slotId;
    client.queueEnteredAt = null;
    client.lastInputAt = Date.now();
    room.sockets.add(socket);
    room.slotSockets.set(result.slotId, socket);
    if (previous && previous !== socket) {
      previous.close(4001, "Pilot reconnected");
    }
    room.emptySince = null;
    room.lastActivityAt = Date.now();
    if (room.hostSlotId === null) room.hostSlotId = result.slotId;
    room.admittedPlayerIds?.add(playerId);
    return result;
  }

  function sendJoinedPacket(
    socket: WebSocket,
    room: Room,
    result: { slotId: number; team: 0 | 1; reconnectToken: string },
    snapshot = room.wing.snapshot(),
  ) {
    send(socket, {
      type: "joined",
      roomId: room.id,
      slotId: result.slotId,
      team: result.team,
      phase: room.phase,
      matchMode: room.matchMode,
      ...(room.matchMode === "casual_ai" && room.autoStartAt !== null
        ? {
            countdownSeconds: Math.max(
              0,
              Math.ceil((room.autoStartAt - Date.now()) / 1000),
            ),
          }
        : {}),
      reconnectToken: result.reconnectToken,
      snapshot,
    });
  }

  function startCasualAiMatch(room: Room, now = Date.now()) {
    if (room.phase !== "lobby" || room.matchMode !== "casual_ai") return false;
    room.phase = "active";
    room.autoStartAt = null;
    room.lastCountdownSecond = null;
    room.matchId = randomUUID();
    room.lastActivityAt = now;
    room.lastTickAt = now;
    room.readySlots.clear();
    room.matchParticipants.clear();
    for (const player of room.wing.snapshot(now).players) {
      if (!player.connected) continue;
      const socket = room.slotSockets.get(player.slotId);
      const client = socket ? clients.get(socket) : null;
      if (!socket || !client?.playerId) continue;
      room.matchParticipants.set(player.slotId, {
        playerId: client.playerId,
        slotId: player.slotId,
        team: player.team,
        acceptedInputs: 0,
        activeMs: 0,
        lastParticipatingInputAt: null,
      });
    }
    if (casualAiRoomId === room.id) casualAiRoomId = null;
    const snapshot = room.wing.snapshot(now);
    for (const socket of room.sockets) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      send(socket, {
        type: "started",
        roomId: room.id,
        matchMode: room.matchMode,
        snapshot,
      });
    }
    return true;
  }

  function joinCasualAiQueue(client: Client, socket: WebSocket, now: number) {
    const playerId = client.playerId;
    if (!playerId) {
      send(socket, { type: "error", reason: "authentication_required" });
      socket.close(1008, "Authentication required");
      return;
    }
    if (
      competitiveQueue.some((queued) => queued.playerId === playerId) ||
      [...rooms.values()].some(
        (room) =>
          room.phase === "active" &&
          !room.wing.match.over &&
          room.wing
            .participants()
            .some((participant) => participant.userId === playerId),
      )
    ) {
      send(socket, { type: "error", reason: "already_in_match" });
      return;
    }

    let room = casualAiRoomId ? rooms.get(casualAiRoomId) ?? null : null;
    if (room?.autoStartAt !== null && room?.autoStartAt !== undefined && room.autoStartAt <= now) {
      startCasualAiMatch(room, now);
      room = null;
    }
    if (
      room &&
      (room.phase !== "lobby" ||
        room.matchMode !== "casual_ai" ||
        room.wing.participants().length >= MAX_PLAYERS)
    ) {
      if (casualAiRoomId === room.id) casualAiRoomId = null;
      room = null;
    }
    if (!room) {
      if (rooms.size >= MAX_ROOMS) {
        send(socket, { type: "error", reason: "capacity" });
        return;
      }
      let roomId = "";
      do {
        roomId = randomUUID().replaceAll("-", "").slice(0, 20).toLowerCase();
      } while (rooms.has(roomId));
      room = createRoom(roomId, "casual_ai");
      rooms.set(room.id, room);
      casualAiRoomId = room.id;
    }

    if (
      room.wing
        .participants()
        .some((participant) => participant.userId === playerId)
    ) {
      send(socket, { type: "error", reason: "already_queued" });
      return;
    }
    const result = attachQueuedPilot(socket, client, room);
    if (!result) {
      send(socket, { type: "error", reason: "queue_assignment_failed" });
      return;
    }
    room.autoStartAt = now + casualAiFillWaitMs;
    room.lastCountdownSecond = Math.ceil(casualAiFillWaitMs / 1000);
    room.lastActivityAt = now;
    sendJoinedPacket(socket, room, result);
    broadcastLobby(room);
    const connectedCount = room.wing
      .snapshot(now)
      .players.filter((player) => player.connected).length;
    if (connectedCount >= MAX_PLAYERS) {
      startCasualAiMatch(room, now);
    }
  }

  function startCompetitiveMatch(pilots: Client[]) {
    let roomId = "";
    do {
      roomId = randomUUID().replaceAll("-", "").slice(0, 20).toLowerCase();
    } while (rooms.has(roomId));
    const room = createRoom(roomId, "competitive");
    const playerIds = pilots.map((pilot) => pilot.playerId);
    if (
      playerIds.some((playerId) => !playerId) ||
      new Set(playerIds).size !== MAX_PLAYERS
    ) {
      for (const pilot of pilots) {
        const socket = socketForClient(pilot);
        if (socket) {
          send(socket, { type: "error", reason: "queue_identity_conflict" });
          socket.close(1008, "Competitive queue identity conflict");
        }
      }
      return false;
    }
    room.admittedPlayerIds = new Set(playerIds as string[]);
    room.phase = "active";
    room.matchId = randomUUID();
    room.lastActivityAt = Date.now();
    room.lastTickAt = room.lastActivityAt;
    rooms.set(room.id, room);

    const assignments: Array<{
      pilot: Client;
      socket: WebSocket;
      result: { slotId: number; team: 0 | 1; reconnectToken: string };
    }> = [];
    const abortAssignment = () => {
      rooms.delete(room.id);
      for (const pilot of pilots) {
        pilot.room = null;
        pilot.slotId = null;
        pilot.roomId = "";
        pilot.queueEnteredAt = null;
        if (pilot.playerId) {
          pendingCompetitiveAssignments.delete(pilot.playerId);
        }
        const socket = socketForClient(pilot);
        if (socket?.readyState === WebSocket.OPEN) {
          send(socket, { type: "error", reason: "queue_assignment_failed" });
          socket.close(1011, "Competitive match could not be assigned");
        }
      }
    };
    for (const pilot of pilots) {
      const socket = socketForClient(pilot);
      const result =
        socket?.readyState === WebSocket.OPEN
          ? attachQueuedPilot(socket, pilot, room)
          : null;
      if (!socket || !result) {
        abortAssignment();
        return false;
      }
      assignments.push({ pilot, socket, result });
      const participant = room.wing.participants().find(
        (entry) => entry.userId === pilot.playerId,
      );
      if (!participant) {
        abortAssignment();
        return false;
      }
      room.matchParticipants.set(participant.slotId, {
        playerId: participant.userId,
        slotId: participant.slotId,
        team: participant.team,
        acceptedInputs: 0,
        activeMs: 0,
        lastParticipatingInputAt: null,
      });
      pendingCompetitiveAssignments.set(participant.userId, {
        roomId: room.id,
        reconnectToken: result.reconnectToken,
        expiresAt: Date.now() + COMPETITIVE_QUEUE_WAIT_MS,
      });
    }
    const snapshot = room.wing.snapshot();
    for (const assignment of assignments) {
      sendJoinedPacket(assignment.socket, room, assignment.result, snapshot);
    }
    publishCompetitiveQueueStatus();
    return true;
  }

  function matchCompetitiveQueue() {
    for (let index = competitiveQueue.length - 1; index >= 0; index -= 1) {
      const client = competitiveQueue[index]!;
      const socket = socketForClient(client);
      if (!socket || socket.readyState !== WebSocket.OPEN || !client.playerId) {
        competitiveQueue.splice(index, 1);
        client.queueEnteredAt = null;
      }
    }
    while (
      competitiveQueue.length >= MAX_PLAYERS &&
      rooms.size < MAX_ROOMS
    ) {
      const pilots = competitiveQueue.splice(0, MAX_PLAYERS);
      if (!startCompetitiveMatch(pilots)) break;
    }
    publishCompetitiveQueueStatus();
  }

  sockets.on("connection", (socket) => {
    const request = connectionRequests.get(socket);
    const client: Client = {
      socket,
      playerId: null,
      authenticating: false,
      roomId: request?.roomId ?? "",
      room: null,
      slotId: null,
      messageWindow: Date.now(),
      messageCount: 0,
      inputWindow: Date.now(),
      inputCount: 0,
      invalidInputs: 0,
      isAlive: true,
      lastInputAt: Date.now(),
      queueRequested: request?.queueRequested ?? false,
      aiFillQueueRequested: request?.aiFillQueueRequested ?? false,
      queueEnteredAt: null,
    };
    clients.set(socket, client);
    let authenticationTimeout: ReturnType<typeof setTimeout> | null =
      setTimeout(() => {
        if (client.playerId !== null || socket.readyState !== WebSocket.OPEN)
          return;
        send(socket, { type: "error", reason: "authentication_required" });
        socket.close(1008, "Authentication required");
      }, SOCKET_AUTH_TIMEOUT_MS);
    authenticationTimeout.unref?.();

    const clearAuthenticationTimeout = () => {
      if (authenticationTimeout !== null) clearTimeout(authenticationTimeout);
      authenticationTimeout = null;
    };

    const rejectAuthentication = () => {
      clearAuthenticationTimeout();
      if (socket.readyState === WebSocket.OPEN) {
        send(socket, { type: "error", reason: "authentication_required" });
        socket.close(1008, "Authentication required");
      }
    };

    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, "Text messages only");
        return;
      }

      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        socket.close(1007, "Invalid JSON");
        return;
      }
      if (!message || typeof message !== "object") return;
      const packet = message as Record<string, unknown>;
      const now = Date.now();
      if (now - client.messageWindow >= 1000) {
        client.messageWindow = now;
        client.messageCount = 0;
      }
      client.messageCount += 1;
      if (client.messageCount > MAX_MESSAGES_PER_SECOND) {
        send(socket, { type: "error", reason: "rate_limited" });
        socket.close(1008, "Message rate exceeded");
        return;
      }

      if (client.playerId === null) {
        if (
          packet.type !== "authenticate" ||
          client.authenticating ||
          typeof packet.token !== "string" ||
          packet.token.length === 0 ||
          packet.token.length > MAX_SESSION_TOKEN_LENGTH
        ) {
          rejectAuthentication();
          return;
        }

        client.authenticating = true;
        void options
          .verifySessionToken(packet.token)
          .then((playerId) => {
            if (socket.readyState !== WebSocket.OPEN) return;
            if (
              typeof playerId !== "string" ||
              playerId.length === 0 ||
              playerId.length > 256
            ) {
              rejectAuthentication();
              return;
            }
            client.playerId = playerId;
            client.authenticating = false;
            clearAuthenticationTimeout();
            send(socket, { type: "authenticated" });
          })
          .catch(() => {
            client.authenticating = false;
            rejectAuthentication();
          });
        return;
      }

      if (packet.type === "authenticate") {
        send(socket, { type: "error", reason: "already_authenticated" });
        socket.close(1008, "Already authenticated");
        return;
      }

      if (packet.type === "queue_join") {
        if (!client.queueRequested || client.room || client.slotId !== null) {
          send(socket, {
            type: "error",
            reason: "competitive_queue_not_requested",
          });
          return;
        }
        if (!client.playerId) {
          rejectAuthentication();
          return;
        }
        if (client.aiFillQueueRequested) {
          joinCasualAiQueue(client, socket, now);
          return;
        }
        const pending = pendingCompetitiveAssignments.get(client.playerId);
        if (pending) {
          const pendingRoom = rooms.get(pending.roomId);
          if (
            pending.expiresAt > now &&
            pendingRoom?.matchMode === "competitive" &&
            pendingRoom.admittedPlayerIds?.has(client.playerId) &&
            pendingRoom.wing.canReconnect(pending.reconnectToken)
          ) {
            const result = attachQueuedPilot(
              socket,
              client,
              pendingRoom,
              pending.reconnectToken,
            );
            if (result) {
              sendJoinedPacket(socket, pendingRoom, result);
              return;
            }
          }
          pendingCompetitiveAssignments.delete(client.playerId);
        }
        const alreadyInMatch = [...rooms.values()].some(
          (room) =>
            room.phase === "active" &&
            !room.wing.match.over &&
            room.wing
              .participants()
              .some((participant) => participant.userId === client.playerId),
        );
        if (alreadyInMatch) {
          send(socket, { type: "error", reason: "already_in_match" });
          return;
        }
        if (
          competitiveQueue.some(
            (queuedClient) => queuedClient.playerId === client.playerId,
          )
        ) {
          send(socket, { type: "error", reason: "already_queued" });
          return;
        }
        if (competitiveQueue.length >= MAX_COMPETITIVE_QUEUE) {
          send(socket, { type: "error", reason: "queue_capacity" });
          return;
        }
        competitiveQueue.push(client);
        client.queueEnteredAt = now;
        matchCompetitiveQueue();
        return;
      }

      if (packet.type === "queue_cancel") {
        if (
          client.aiFillQueueRequested &&
          client.room?.matchMode === "casual_ai" &&
          client.room.phase === "lobby"
        ) {
          send(socket, { type: "queue_cancelled" });
          socket.close(1000, "Casual matchmaking cancelled");
          return;
        }
        if (!client.queueRequested || !removeFromCompetitiveQueue(client)) {
          send(socket, { type: "error", reason: "not_queued" });
          return;
        }
        send(socket, { type: "queue_cancelled" });
        matchCompetitiveQueue();
        return;
      }

      if (packet.type === "interrupted_ack") {
        shutdownAckWaiters.get(socket)?.("acknowledged");
        return;
      }

      if (packet.type === "join") {
        if (client.queueRequested && client.room === null) {
          send(socket, {
            type: "error",
            reason: "competitive_queue_join_required",
          });
          return;
        }
        if (client.slotId !== null) {
          send(socket, { type: "error", reason: "already_joined" });
          return;
        }
        let room = client.room ?? rooms.get(client.roomId);
        const suppliedReconnectToken =
          typeof packet.reconnectToken === "string" &&
          packet.reconnectToken.length <= 128
            ? packet.reconnectToken
            : null;
        if (!room) {
          if (suppliedReconnectToken) {
            send(socket, { type: "error", reason: "session_lost" });
            socket.close(1008, "The match session is no longer available");
            return;
          }
          if (rooms.size >= MAX_ROOMS) {
            send(socket, { type: "error", reason: "capacity" });
            socket.close(1013, "Room capacity reached");
            return;
          }
          room = createRoom(client.roomId, resolveRoomMode(client.roomId));
          rooms.set(room.id, room);
        }

        const name =
          typeof packet.name === "string"
            ? packet.name
                .replace(/[\u0000-\u001f\u007f]/g, "")
                .trim()
                .slice(0, 24) || "Pilot"
            : "Pilot";
        const reconnectToken = suppliedReconnectToken;
        if (
          room.phase === "active" &&
          (!reconnectToken || !room.wing.canReconnect(reconnectToken))
        ) {
          send(socket, {
            type: "error",
            reason: reconnectToken ? "session_lost" : "match_started",
          });
          socket.close(1008, "This match has already started");
          return;
        }
        const authenticatedPlayerId = client.playerId;
        if (authenticatedPlayerId === null) {
          rejectAuthentication();
          return;
        }
        if (
          room.matchMode === "competitive" &&
          (!room.admittedPlayerIds?.has(authenticatedPlayerId) ||
            !suppliedReconnectToken ||
            !room.wing.canReconnect(suppliedReconnectToken))
        ) {
          send(socket, {
            type: "error",
            reason: "competitive_queue_required",
          });
          socket.close(1008, "This match is reserved for queued pilots");
          return;
        }
        const result = room.wing.join(
          authenticatedPlayerId,
          name,
          reconnectToken,
        );
        if (!result.ok) {
          send(socket, { type: "error", reason: result.reason });
          socket.close(
            1008,
            result.reason === "full"
              ? "Wing is full"
              : "Room session belongs to another pilot",
          );
          return;
        }

        const previous = room.slotSockets.get(result.slotId);
        client.room = room;
        client.slotId = result.slotId;
        room.sockets.add(socket);
        room.slotSockets.set(result.slotId, socket);
        room.emptySince = null;
        room.lastActivityAt = Date.now();
        if (previous && previous !== socket)
          previous.close(4001, "Pilot reconnected");
        if (room.phase === "lobby" && room.hostSlotId === null)
          room.hostSlotId = result.slotId;
        send(socket, {
          type: "joined",
          roomId: room.id,
          slotId: result.slotId,
          team: result.team,
          phase: room.phase,
          matchMode: room.matchMode,
          reconnectToken: result.reconnectToken,
          snapshot: room.wing.snapshot(),
        });
        const completedReward =
          room.phase === "active" && room.wing.match.over
            ? room.rewardNotices.get(client.playerId)
            : undefined;
        if (completedReward) {
          send(socket, { type: "wing_reward", ...completedReward });
        }
        if (room.phase === "lobby") broadcastLobby(room);
        return;
      }

      if (packet.type === "ready" && client.room && client.slotId !== null) {
        const room = client.room;
        if (room.matchMode === "casual_ai") {
          send(socket, { type: "error", reason: "auto_launch_only" });
          return;
        }
        if (room.phase !== "lobby" || typeof packet.ready !== "boolean") {
          send(socket, { type: "error", reason: "invalid_lobby_action" });
          return;
        }
        if (packet.ready) room.readySlots.add(client.slotId);
        else room.readySlots.delete(client.slotId);
        room.lastActivityAt = Date.now();
        broadcastLobby(room);
        return;
      }

      if (packet.type === "start" && client.room && client.slotId !== null) {
        const room = client.room;
        if (room.matchMode === "casual_ai") {
          send(socket, { type: "error", reason: "auto_launch_only" });
          return;
        }
        const current = room.wing
          .snapshot()
          .players.filter((player) => player.connected);
        if (room.phase !== "lobby") {
          send(socket, { type: "error", reason: "match_started" });
          return;
        }
        if (room.hostSlotId !== client.slotId) {
          send(socket, { type: "error", reason: "host_only" });
          return;
        }
        if (
          current.length === 0 ||
          !current.every((player) => room.readySlots.has(player.slotId))
        ) {
          send(socket, { type: "error", reason: "pilots_not_ready" });
          return;
        }
        room.phase = "active";
        room.lastActivityAt = Date.now();
        room.matchId = randomUUID();
        room.lastTickAt = room.lastActivityAt;
        room.matchParticipants.clear();
        room.rewardNotices.clear();
        room.settlementPromise = null;
        room.settlementDone = false;
        room.settlementAttempts = 0;
        room.nextSettlementAt = 0;
        room.pendingNoticeSent = false;
        for (const player of current) {
          const playerSocket = room.slotSockets.get(player.slotId);
          const playerClient = playerSocket ? clients.get(playerSocket) : null;
          if (!playerClient?.playerId) continue;
          room.matchParticipants.set(player.slotId, {
            playerId: playerClient.playerId,
            slotId: player.slotId,
            team: player.team,
            acceptedInputs: 0,
            activeMs: 0,
            lastParticipatingInputAt: null,
          });
        }
        room.readySlots.clear();
        const message = {
          type: "started",
          roomId: room.id,
          snapshot: room.wing.snapshot(),
        };
        for (const roomSocket of room.sockets) send(roomSocket, message);
        return;
      }

      if (packet.type === "input" && client.room && client.slotId !== null) {
        if (client.room.phase !== "active") {
          send(socket, { type: "error", reason: "match_not_started" });
          return;
        }
        if (now - client.inputWindow >= 1000) {
          client.inputWindow = now;
          client.inputCount = 0;
        }
        client.inputCount += 1;
        if (client.inputCount > MAX_INPUTS_PER_SECOND) {
          send(socket, { type: "error", reason: "rate_limited" });
          socket.close(1008, "Input rate exceeded");
          return;
        }
        const input = packet.input;
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          rejectInput(socket, client);
          return;
        }
        const value = input as Record<string, unknown>;
        const seq = value.seq;
        const lastSeq = client.room.wing.lastSeq(client.slotId);
        if (
          typeof seq !== "number" ||
          !Number.isSafeInteger(seq) ||
          seq < 1 ||
          seq > lastSeq + 600 ||
          !validAxis(value.throttle) ||
          !validAxis(value.yaw) ||
          !validAxis(value.strafe) ||
          !validAxis(value.pitch) ||
          !validAxis(value.evade) ||
          !validOptionalBoolean(value.fire) ||
          !validOptionalBoolean(value.ult) ||
          !validOptionalBoolean(value.lock) ||
          !(
            value.preset === null ||
            value.preset === 0 ||
            value.preset === 1 ||
            value.preset === 2 ||
            value.preset === 3
          )
        ) {
          rejectInput(socket, client);
          return;
        }
        const wingInput: WingInput = {
          seq,
          throttle: value.throttle,
          yaw: value.yaw,
          strafe: value.strafe,
          pitch: value.pitch,
          fire: value.fire === true,
          ult: value.ult === true,
          lock: value.lock === true,
          evade: value.evade,
          preset: value.preset,
        };
        client.lastInputAt = now;
        const accepted = client.room.wing.input(client.slotId, wingInput, now);
        if (accepted && client.playerId) {
          pendingCompetitiveAssignments.delete(client.playerId);
        }
        if (accepted && isMeaningfulWingInput(wingInput)) {
          const participant = client.room.matchParticipants.get(client.slotId);
          if (
            participant &&
            participant.playerId === client.playerId
          ) {
            participant.acceptedInputs += 1;
            participant.lastParticipatingInputAt = now;
          }
        }
        return;
      }

      send(socket, {
        type: "error",
        reason: client.slotId === null ? "join_required" : "unknown_message",
      });
      socket.close(1008, "Unsupported message");
    });

    socket.on("close", () => {
      clearAuthenticationTimeout();
      shutdownAckWaiters.get(socket)?.("closed");
      if (removeFromCompetitiveQueue(client)) matchCompetitiveQueue();
      const room = client.room;
      const slotId = client.slotId;
      clients.delete(socket);
      if (!room) return;
      room.sockets.delete(socket);
      if (slotId !== null && room.slotSockets.get(slotId) === socket) {
        room.slotSockets.delete(slotId);
        room.wing.disconnect(slotId);
        room.readySlots.delete(slotId);
        if (room.phase === "lobby" && room.hostSlotId === slotId) {
          room.hostSlotId =
            room.wing.snapshot().players.find((player) => player.connected)
              ?.slotId ?? null;
        }
      }
      if (room.sockets.size === 0) room.emptySince = Date.now();
      if (room.phase === "lobby") broadcastLobby(room);
    });
    socket.on("error", () => {
      // The close handler owns room and seat cleanup.
    });
    socket.on("pong", () => {
      client.isAlive = true;
    });
  });

  sockets.on("error", () => {
    // Per-socket close handlers own room and seat cleanup.
  });

  function sendWingRewardNotices(
    room: Room,
    notices: Map<string, WingRewardNotice>,
  ) {
    for (const participant of room.matchParticipants.values()) {
      const notice = notices.get(participant.playerId) ?? {
        status: "unavailable" as const,
        outcome: outcomeForTeam(room.wing.match, participant.team) ?? "draw",
        gain: 0,
        balanceAfter: null,
        revision: null,
        reason: "reward_result_unavailable",
      };
      room.rewardNotices.set(participant.playerId, notice);
      const socket = room.slotSockets.get(participant.slotId);
      const client = socket ? clients.get(socket) : null;
      if (
        socket?.readyState === WebSocket.OPEN &&
        client?.playerId === participant.playerId
      ) {
        send(socket, { type: "wing_reward", ...notice });
      }
    }
    room.settlementDone = true;
  }

  function resolveRoomMode(roomId: string): WingMatchMode {
    const mode = options.resolveServerMatchMode?.(roomId);
    return mode === "competitive" ||
      mode === "practice" ||
      mode === "test" ||
      mode === "private"
      ? mode
      : "private";
  }

  function markWingRewardUnavailable(room: Room, reason: string) {
    const notices = new Map<string, WingRewardNotice>();
    for (const participant of room.matchParticipants.values()) {
      notices.set(participant.playerId, {
        status: "unavailable",
        outcome: outcomeForTeam(room.wing.match, participant.team) ?? "draw",
        gain: 0,
        balanceAfter: null,
        revision: null,
        reason,
      });
    }
    sendWingRewardNotices(room, notices);
  }

  function markWingRewardBlocked(
    room: Room,
    status: "not_eligible" | "disabled",
    reason: string,
  ) {
    const notices = new Map<string, WingRewardNotice>();
    for (const participant of room.matchParticipants.values()) {
      notices.set(participant.playerId, {
        status,
        outcome: outcomeForTeam(room.wing.match, participant.team) ?? "draw",
        gain: 0,
        balanceAfter: null,
        revision: null,
        reason,
      });
    }
    sendWingRewardNotices(room, notices);
  }

  function startWingRewardSettlement(room: Room, now: number) {
    if (
      !room.matchId ||
      !room.wing.match.over ||
      room.settlementDone ||
      room.settlementPromise ||
      now < room.nextSettlementAt
    ) {
      return;
    }
    const result = room.wing.match.over;
    if (result !== "win" && result !== "loss" && result !== "draw") {
      markWingRewardUnavailable(room, "match_result_unavailable");
      return;
    }
    if (room.matchMode !== "competitive") {
      markWingRewardBlocked(room, "not_eligible", "competitive_queue_required");
      return;
    }
    if (!options.enableWingRewards) {
      markWingRewardBlocked(room, "disabled", "rewards_disabled");
      return;
    }
    if (!options.settleWingMatch) {
      markWingRewardUnavailable(room, "reward_database_unavailable");
      return;
    }

    const participants: CompletedWingMatch["participants"] = [
      ...room.matchParticipants.values(),
    ].map((participant) => {
      const socket = room.slotSockets.get(participant.slotId);
      const client = socket ? clients.get(socket) : null;
      return {
        playerId: participant.playerId,
        team: participant.team,
        activeSeconds: participant.activeMs / 1000,
        acceptedInputs: participant.acceptedInputs,
        connectedAtEnd:
          socket?.readyState === WebSocket.OPEN &&
          client?.playerId === participant.playerId,
      };
    });
    const input: CompletedWingMatch = {
      matchId: room.matchId,
      matchMode: room.matchMode,
      result,
      participants,
    };

    if (!room.pendingNoticeSent) {
      room.pendingNoticeSent = true;
      for (const participant of room.matchParticipants.values()) {
        const socket = room.slotSockets.get(participant.slotId);
        const client = socket ? clients.get(socket) : null;
        if (
          socket?.readyState === WebSocket.OPEN &&
          client?.playerId === participant.playerId
        ) {
          send(socket, { type: "wing_reward_pending" });
        }
      }
    }

    room.settlementPromise = (async () => {
      try {
        const notices = await options.settleWingMatch!(input);
        sendWingRewardNotices(room, notices);
      } catch {
        room.settlementAttempts += 1;
        if (room.settlementAttempts >= 3) {
          process.stderr.write(
            `${JSON.stringify({
              event: "wing_reward_settlement_failed",
              attempts: room.settlementAttempts,
            })}\n`,
          );
          markWingRewardUnavailable(room, "reward_verification_unavailable");
        } else {
          room.nextSettlementAt =
            Date.now() + 250 * 2 ** (room.settlementAttempts - 1);
        }
      } finally {
        room.settlementPromise = null;
      }
    })();
  }

  let lastBroadcastAt = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    const shouldBroadcast = now - lastBroadcastAt >= snapshotIntervalMs;
    if (shouldBroadcast) lastBroadcastAt = now;
    for (const client of [...competitiveQueue]) {
      if (
        client.queueEnteredAt !== null &&
        now - client.queueEnteredAt >= COMPETITIVE_QUEUE_WAIT_MS
      ) {
        removeFromCompetitiveQueue(client);
        const socket = socketForClient(client);
        if (socket?.readyState === WebSocket.OPEN) {
          send(socket, { type: "error", reason: "queue_wait_expired" });
          socket.close(1000, "Competitive queue wait expired");
        }
      }
    }
    for (const [playerId, assignment] of pendingCompetitiveAssignments) {
      if (assignment.expiresAt <= now) {
        pendingCompetitiveAssignments.delete(playerId);
      }
    }
    for (const [id, room] of rooms) {
      if (
        room.sockets.size === 0 &&
        room.emptySince !== null &&
        now - room.emptySince > ROOM_IDLE_MS
      ) {
        rooms.delete(id);
        if (casualAiRoomId === id) casualAiRoomId = null;
        matchCompetitiveQueue();
        continue;
      }
      if (room.phase === "lobby" && now - room.lastActivityAt > LOBBY_IDLE_MS) {
        rooms.delete(id);
        if (casualAiRoomId === id) casualAiRoomId = null;
        for (const socket of room.sockets) socket.close(1001, "Lobby expired");
        matchCompetitiveQueue();
        continue;
      }
      if (room.phase === "lobby" && room.matchMode === "casual_ai") {
        const secondsRemaining =
          room.autoStartAt === null
            ? 0
            : Math.max(0, Math.ceil((room.autoStartAt - now) / 1000));
        if (secondsRemaining === 0) {
          startCasualAiMatch(room, now);
        } else if (secondsRemaining !== room.lastCountdownSecond) {
          room.lastCountdownSecond = secondsRemaining;
          broadcastLobby(room);
        }
      }
      room.wing.expireDisconnected(now);
      if (room.phase !== "active") continue;
      const activeDeltaMs = Math.min(
        250,
        Math.max(0, now - room.lastTickAt),
      );
      room.lastTickAt = now;
      for (const socket of room.sockets) {
        const client = clients.get(socket);
        if (client && now - client.lastInputAt > DISCONNECT_GRACE_MS) {
          socket.terminate();
        }
      }
      room.wing.tick(now);
      for (const participant of room.matchParticipants.values()) {
        const socket = room.slotSockets.get(participant.slotId);
        const client = socket ? clients.get(socket) : null;
        if (
          client?.playerId === participant.playerId &&
          participant.lastParticipatingInputAt !== null &&
          now - participant.lastParticipatingInputAt <= 1_000
        ) {
          participant.activeMs += activeDeltaMs;
        }
      }
      if (room.wing.match.over && !room.settlementDone) {
        startWingRewardSettlement(room, now);
        if (!room.settlementDone) {
          room.wing.match.fx.length = 0;
          continue;
        }
      }
      if (!shouldBroadcast) {
        room.wing.match.fx.length = 0;
        continue;
      }
      const message = JSON.stringify({
        type: "snapshot",
        snapshot: room.wing.snapshot(now),
      });
      for (const socket of room.sockets) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        if (socket.bufferedAmount > 1_048_576) {
          socket.close(1013, "Client cannot keep up");
          continue;
        }
        socket.send(message);
      }
      room.wing.match.fx.length = 0;
    }
  }, tickIntervalMs);
  timer.unref();

  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      const client = clients.get(socket);
      if (socket.readyState !== WebSocket.OPEN || !client) continue;
      if (!client.isAlive) {
        socket.terminate();
        continue;
      }
      client.isAlive = false;
      socket.ping();
    }
  }, 15_000);
  heartbeat.unref();

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  const address = httpServer.address();
  if (!address || typeof address === "string")
    throw new Error("Wing socket failed to bind a TCP port.");

  return {
    port: address.port,
    get roomCount() {
      return rooms.size;
    },
    get queuedPilotCount() {
      return competitiveQueue.length;
    },
    async close() {
      if (closePromise) return closePromise;
      isShuttingDown = true;
      clearInterval(timer);
      clearInterval(heartbeat);
      const httpClosed = new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      const shutdownNotices: Promise<ShutdownNoticeResult>[] = [];
      const settlementClosures: Promise<void>[] = [];
      const interruptedPayload = JSON.stringify({
        type: "interrupted",
        reason: "server_restart",
      });
      for (const socket of sockets.clients) {
        const client = clients.get(socket);
        const room = client?.room;
        const interrupted =
          room?.phase === "active" &&
          !room.wing.match.over &&
          socket.readyState === WebSocket.OPEN;
        if (
          room?.wing.match.over &&
          room.settlementPromise &&
          socket.readyState === WebSocket.OPEN
        ) {
          const pendingSettlement = room.settlementPromise;
          settlementClosures.push(
            pendingSettlement.then(() => {
              if (!room.settlementDone) {
                markWingRewardUnavailable(
                  room,
                  "reward_verification_unavailable",
                );
              }
              if (socket.readyState === WebSocket.OPEN) {
                socket.close(1001, "Server shutting down");
              }
            }),
          );
          continue;
        }
        if (interrupted) {
          const shutdownTimer = setTimeout(() => socket.terminate(), 5_000);
          shutdownTimer.unref();
          socket.once("close", () => clearTimeout(shutdownTimer));
          shutdownNotices.push(
            sendShutdownNotice(
              socket,
              interruptedPayload,
              shutdownAckTimeoutMs,
              shutdownAckWaiters,
            ).then((result) => {
              if (socket.readyState === WebSocket.OPEN) {
                if (result === "send_error") socket.terminate();
                else socket.close(4002, "server_restart");
              }
              return result;
            }),
          );
        } else {
          socket.close(1001, "Server shutting down");
        }
      }
      closePromise = (async () => {
        const results = await Promise.all(shutdownNotices);
        await Promise.all(settlementClosures);
        if (results.length > 0) {
          process.stdout.write(
            `${JSON.stringify({
              event: "socket_shutdown_notice_delivery",
              activeSockets: results.length,
              acknowledged: results.filter(
                (result) => result === "acknowledged",
              ).length,
              timedOut: results.filter((result) => result === "timeout").length,
              closedBeforeAck: results.filter((result) => result === "closed")
                .length,
              sendErrors: results.filter((result) => result === "send_error")
                .length,
            })}\n`,
          );
        }
        await new Promise<void>((resolve) => sockets.close(() => resolve()));
        await httpClosed;
      })();
      return closePromise;
    },
  };
}

function sendShutdownNotice(
  socket: WebSocket,
  payload: string,
  timeoutMs: number,
  waiters: Map<WebSocket, (result: ShutdownNoticeResult) => void>,
): Promise<ShutdownNoticeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (result: ShutdownNoticeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("close", onClose);
      if (waiters.get(socket) === finish) waiters.delete(socket);
      resolve(result);
    };
    const onClose = () => finish("closed");
    waiters.set(socket, finish);
    timer = setTimeout(() => finish("timeout"), timeoutMs);
    timer.unref();
    socket.once("close", onClose);
    try {
      socket.send(payload, (error) => {
        if (error) finish("send_error");
      });
    } catch {
      finish("send_error");
    }
  });
}

function rejectUpgrade(socket: import("node:stream").Duplex, status: string) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function validAxis(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -1 &&
    value <= 1
  );
}

function validOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function rejectInput(socket: WebSocket, client: Client) {
  client.invalidInputs += 1;
  send(socket, { type: "error", reason: "invalid_input" });
  if (client.invalidInputs >= 5) socket.close(1008, "Invalid input packets");
}

function broadcastLobby(room: Room) {
  const snapshot = room.wing.snapshot();
  const players = snapshot.players;
  const connectedCount = players.filter((player) => player.connected).length;
  const countdownSeconds =
    room.matchMode === "casual_ai" && room.autoStartAt !== null
      ? Math.max(0, Math.ceil((room.autoStartAt - Date.now()) / 1000))
      : null;
  const payload = {
    type: "lobby",
    roomId: room.id,
    phase: room.phase,
    matchMode: room.matchMode,
    countdownSeconds,
    hostSlotId: room.hostSlotId,
    connectedCount,
    maxPlayers: MAX_PLAYERS,
    battlefield: {
      disc: snapshot.match.disc,
      relays: snapshot.match.relays.map(({ x, z, own }) => ({ x, z, own })),
      rocks: snapshot.match.rocks.map(({ x, z, r }) => ({ x, z, r })),
    },
    players: players.map((player) => ({
      slotId: player.slotId,
      team: player.team,
      connected: player.connected,
      name: player.name,
      ready: room.readySlots.has(player.slotId),
    })),
  };
  for (const socket of room.sockets) send(socket, payload);
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(payload));
}
