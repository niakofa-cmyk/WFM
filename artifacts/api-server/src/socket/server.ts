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
const ROOM_ID = /^[a-z0-9][a-z0-9-]{5,23}$/i;

type Room = {
  id: string;
  wing: ReturnType<typeof createWing>;
  sockets: Set<WebSocket>;
  slotSockets: Map<number, WebSocket>;
  emptySince: number | null;
};

type Client = {
  playerId: string;
  roomId: string;
  room: Room | null;
  slotId: number | null;
};

export async function startWingSocketServer(port: number, host = "0.0.0.0") {
  const rooms = new Map<string, Room>();
  const clients = new Map<WebSocket, Client>();

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
    const roomId = (url.searchParams.get("room") ?? "").trim();
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
    const client: Client = { playerId: randomUUID(), roomId, room: null, slotId: null };
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

      if (packet.type === "join") {
        if (client.slotId !== null) return;
        let room = client.room ?? rooms.get(client.roomId);
        if (!room) {
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
          };
          rooms.set(room.id, room);
        }

        const name =
          typeof packet.name === "string"
            ? packet.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24) || "Pilot"
            : "Pilot";
        const reconnectToken =
          typeof packet.reconnectToken === "string" && packet.reconnectToken.length <= 128
            ? packet.reconnectToken
            : null;
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
        if (previous && previous !== socket) previous.close(4001, "Pilot reconnected");
        send(socket, {
          type: "joined",
          roomId: room.id,
          slotId: result.slotId,
          team: result.team,
          reconnectToken: result.reconnectToken,
          snapshot: room.wing.snapshot(),
        });
        return;
      }

      if (packet.type === "input" && client.room && client.slotId !== null) {
        const input = packet.input;
        if (!input || typeof input !== "object") return;
        const value = input as Record<string, unknown>;
        const seq = value.seq;
        if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 1) return;
        const wingInput: WingInput = {
          seq,
          throttle: numberOrZero(value.throttle),
          yaw: numberOrZero(value.yaw),
          strafe: numberOrZero(value.strafe),
          pitch: numberOrZero(value.pitch),
          fire: value.fire === true,
          ult: value.ult === true,
          lock: value.lock === true,
          evade: numberOrZero(value.evade),
          preset:
            value.preset === 0 || value.preset === 1 || value.preset === 2 || value.preset === 3
              ? value.preset
              : null,
        };
        client.room.wing.input(client.slotId, wingInput);
        return;
      }

      if (packet.type !== "join") socket.close(1008, "Join before sending input");
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
      }
      if (room.sockets.size === 0) room.emptySince = Date.now();
    });
    socket.on("error", () => {
      // The close handler owns room and seat cleanup.
    });
  });

  sockets.on("error", () => {
    // Per-socket close handlers own room and seat cleanup.
  });

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      if (room.sockets.size === 0 && room.emptySince !== null && now - room.emptySince > ROOM_IDLE_MS) {
        rooms.delete(id);
        continue;
      }
      room.wing.tick(now);
      const message = JSON.stringify({ type: "snapshot", snapshot: room.wing.snapshot(now) });
      for (const socket of room.sockets) {
        if (socket.readyState === WebSocket.OPEN) socket.send(message);
      }
      room.wing.match.fx.length = 0;
    }
  }, 1000 / TICK_RATE);
  timer.unref();

  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
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
      for (const socket of sockets.clients) socket.close(1001, "Server shutting down");
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

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
