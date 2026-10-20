import { randomInt, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  createWing,
  DISCONNECT_GRACE_MS,
  MAX_PLAYERS,
  TICK_RATE,
  type WingInput,
} from "../game/wing";

const MAX_ROOMS = 64;
const ROOM_IDLE_MS = DISCONNECT_GRACE_MS * 2;
const LOBBY_IDLE_MS = 15 * 60_000;
const ROOM_ID = /^[a-z0-9][a-z0-9-]{5,23}$/i;

type Room = {
  id: string;
  wing: ReturnType<typeof createWing>;
  sockets: Set<WebSocket>;
  slotSockets: Map<number, WebSocket>;
  emptySince: number | null;
  phase: "lobby" | "active";
  hostSlotId: number | null;
  readySlots: Set<number>;
  lastActivityAt: number;
};

type Client = {
  playerId: string;
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
};

const MAX_MESSAGES_PER_SECOND = 80;
const MAX_INPUTS_PER_SECOND = 45;
export async function startWingSocketServer(
  port: number,
  host = "0.0.0.0",
  options: { tickIntervalMs?: number; snapshotIntervalMs?: number } = {},
) {
  const rooms = new Map<string, Room>();
  const clients = new Map<WebSocket, Client>();
  const tickIntervalMs = options.tickIntervalMs ?? 1000 / TICK_RATE;
  const snapshotIntervalMs = options.snapshotIntervalMs ?? 1000 / TICK_RATE;

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
  const roomIds = new WeakMap<WebSocket, string>();

  httpServer.on("upgrade", (request, socket, head) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    } catch {
      rejectUpgrade(socket, "400 Bad Request");
      return;
    }
    const roomId = (url.searchParams.get("room") ?? "").trim().toLowerCase();
    if ((url.pathname !== "/ws" && url.pathname !== "/ws/") || !ROOM_ID.test(roomId)) {
      rejectUpgrade(socket, "400 Bad Request");
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      roomIds.set(client, roomId);
      sockets.emit("connection", client, request);
    });
  });

  sockets.on("connection", (socket) => {
    const roomId = roomIds.get(socket) ?? "";
    const client: Client = {
      playerId: randomUUID(),
      roomId,
      room: null,
      slotId: null,
      messageWindow: Date.now(),
      messageCount: 0,
      inputWindow: Date.now(),
      inputCount: 0,
      invalidInputs: 0,
      isAlive: true,
      lastInputAt: Date.now(),
    };
    clients.set(socket, client);

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

      if (packet.type === "join") {
        if (client.slotId !== null) {
          send(socket, { type: "error", reason: "already_joined" });
          return;
        }
        let room = client.room ?? rooms.get(client.roomId);
        const suppliedReconnectToken =
          typeof packet.reconnectToken === "string" && packet.reconnectToken.length <= 128
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
          room = {
            id: client.roomId,
            wing: createWing(randomInt(1, 0x7fffffff)),
            sockets: new Set(),
            slotSockets: new Map(),
            emptySince: null,
            phase: "lobby",
            hostSlotId: null,
            readySlots: new Set(),
            lastActivityAt: Date.now(),
          };
          rooms.set(room.id, room);
        }

        const name =
          typeof packet.name === "string"
            ? packet.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24) || "Pilot"
            : "Pilot";
        const reconnectToken = suppliedReconnectToken;
        if (room.phase === "active" && (!reconnectToken || !room.wing.canReconnect(reconnectToken))) {
          send(socket, { type: "error", reason: reconnectToken ? "session_lost" : "match_started" });
          socket.close(1008, "This match has already started");
          return;
        }
        const result = room.wing.join(client.playerId, name, reconnectToken);
        if (!result.ok) {
          send(socket, { type: "error", reason: "full" });
          socket.close(1008, "Wing is full");
          return;
        }

        const previous = room.slotSockets.get(result.slotId);
        client.room = room;
        client.slotId = result.slotId;
        room.sockets.add(socket);
        room.slotSockets.set(result.slotId, socket);
        room.emptySince = null;
        room.lastActivityAt = Date.now();
        if (previous && previous !== socket) previous.close(4001, "Pilot reconnected");
        if (room.phase === "lobby" && room.hostSlotId === null) room.hostSlotId = result.slotId;
        send(socket, {
          type: "joined",
          roomId: room.id,
          slotId: result.slotId,
          team: result.team,
          phase: room.phase,
          reconnectToken: result.reconnectToken,
          snapshot: room.wing.snapshot(),
        });
        if (room.phase === "lobby") broadcastLobby(room);
        return;
      }

      if (packet.type === "ready" && client.room && client.slotId !== null) {
        const room = client.room;
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
        const current = room.wing.snapshot().players.filter((player) => player.connected);
        if (room.phase !== "lobby") {
          send(socket, { type: "error", reason: "match_started" });
          return;
        }
        if (room.hostSlotId !== client.slotId) {
          send(socket, { type: "error", reason: "host_only" });
          return;
        }
        if (current.length === 0 || !current.every((player) => room.readySlots.has(player.slotId))) {
          send(socket, { type: "error", reason: "pilots_not_ready" });
          return;
        }
        room.phase = "active";
        room.lastActivityAt = Date.now();
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
          !(value.preset === null || value.preset === 0 || value.preset === 1 || value.preset === 2 || value.preset === 3)
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
        client.room.wing.input(client.slotId, wingInput);
        return;
      }

      send(socket, { type: "error", reason: client.slotId === null ? "join_required" : "unknown_message" });
      socket.close(1008, "Unsupported message");
    });

    socket.on("close", () => {
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
            room.wing.snapshot().players.find((player) => player.connected)?.slotId ?? null;
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

  let lastBroadcastAt = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    const shouldBroadcast = now - lastBroadcastAt >= snapshotIntervalMs;
    if (shouldBroadcast) lastBroadcastAt = now;
    for (const [id, room] of rooms) {
      if (room.sockets.size === 0 && room.emptySince !== null && now - room.emptySince > ROOM_IDLE_MS) {
        rooms.delete(id);
        continue;
      }
      if (room.phase === "lobby" && now - room.lastActivityAt > LOBBY_IDLE_MS) {
        rooms.delete(id);
        for (const socket of room.sockets) socket.close(1001, "Lobby expired");
        continue;
      }
      room.wing.expireDisconnected(now);
      if (room.phase !== "active") continue;
      for (const socket of room.sockets) {
        const client = clients.get(socket);
        if (client && now - client.lastInputAt > DISCONNECT_GRACE_MS) {
          socket.terminate();
        }
      }
      room.wing.tick(now);
      if (!shouldBroadcast) {
        room.wing.match.fx.length = 0;
        continue;
      }
      const message = JSON.stringify({ type: "snapshot", snapshot: room.wing.snapshot(now) });
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
  if (!address || typeof address === "string") throw new Error("Wing socket failed to bind a TCP port.");

  return {
    port: address.port,
    get roomCount() {
      return rooms.size;
    },
    async close() {
      clearInterval(timer);
      clearInterval(heartbeat);
      for (const socket of sockets.clients) {
        const client = clients.get(socket);
        const room = client?.room;
        const interrupted =
          room?.phase === "active" && !room.wing.match.over && socket.readyState === WebSocket.OPEN;
        if (interrupted) {
          send(socket, { type: "interrupted", reason: "server_restart" });
          socket.close(4002, "server_restart");
        } else {
          socket.close(1001, "Server shutting down");
        }
      }
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function rejectUpgrade(socket: import("node:stream").Duplex, status: string) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function validAxis(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1;
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
  const players = room.wing.snapshot().players;
  const connectedCount = players.filter((player) => player.connected).length;
  const payload = {
    type: "lobby",
    roomId: room.id,
    phase: room.phase,
    hostSlotId: room.hostSlotId,
    connectedCount,
    maxPlayers: MAX_PLAYERS,
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
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
