import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createWing, MAX_PLAYERS, TICK_RATE, type WingInput } from "../game/wing";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const wing = createWing();
const httpServer = createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", tick: wing.tickCount }));
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
const slotSockets = new Map<number, WebSocket>();
const clients = new Map<WebSocket, { playerId: string; slotId: number | null }>();

httpServer.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  if (pathname !== "/ws" && pathname !== "/ws/") {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (client) => {
    sockets.emit("connection", client, request);
  });
});

sockets.on("connection", (socket) => {
  const client = { playerId: randomUUID(), slotId: null as number | null };
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
      const name =
        typeof packet.name === "string"
          ? packet.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24) || "Pilot"
          : "Pilot";
      const reconnectToken =
        typeof packet.reconnectToken === "string" && packet.reconnectToken.length <= 128
          ? packet.reconnectToken
          : null;
      const result = wing.join(client.playerId, name, reconnectToken);
      if (!result.ok) {
        send(socket, { type: "error", reason: "full" });
        socket.close(1008, "Wing is full");
        return;
      }

      const previous = slotSockets.get(result.slotId);
      client.slotId = result.slotId;
      slotSockets.set(result.slotId, socket);
      if (previous && previous !== socket) previous.close(4001, "Pilot reconnected");
      send(socket, {
        type: "joined",
        slotId: result.slotId,
        team: result.team,
        reconnectToken: result.reconnectToken,
        snapshot: wing.snapshot(),
      });
      return;
    }

    if (packet.type === "input" && client.slotId !== null) {
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
      wing.input(client.slotId, wingInput);
      return;
    }

    if (packet.type !== "join") socket.close(1008, "Join before sending input");
  });

  socket.on("close", () => {
    const slotId = client.slotId;
    clients.delete(socket);
    if (slotId !== null && slotSockets.get(slotId) === socket) {
      slotSockets.delete(slotId);
      wing.disconnect(slotId);
    }
  });

  socket.on("error", () => {
    // The close handler owns slot cleanup.
  });
});

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

const timer = setInterval(() => {
  wing.tick();
  const snapshot = wing.snapshot();
  const message = JSON.stringify({ type: "snapshot", snapshot });
  for (const socket of sockets.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
  wing.match.fx.length = 0;
}, 1000 / TICK_RATE);

const heartbeat = setInterval(() => {
  for (const socket of sockets.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.ping();
  }
}, 15_000);

httpServer.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Wing socket server listening on ${port} (${MAX_PLAYERS} seats)\n`);
});

function shutdown() {
  clearInterval(timer);
  clearInterval(heartbeat);
  for (const socket of sockets.clients) socket.close(1001, "Server shutting down");
  sockets.close();
  httpServer.close();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
