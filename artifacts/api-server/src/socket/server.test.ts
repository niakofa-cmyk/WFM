import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { MAX_PLAYERS } from "../game/wing";
import { startWingSocketServer } from "./server";

type Packet = { type?: string; [key: string]: unknown };

function nextPacket(socket: WebSocket, accept: (packet: Packet) => boolean, timeoutMs = 3000) {
  return new Promise<Packet>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket packet."));
    }, timeoutMs);
    const onMessage = (data: Buffer) => {
      let packet: Packet;
      try {
        packet = JSON.parse(data.toString()) as Packet;
      } catch {
        return;
      }
      if (!accept(packet)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(packet);
    };
    socket.on("message", onMessage);
  });
}

async function connect(url: string) {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
}

async function join(socket: WebSocket, name: string, reconnectToken?: string) {
  const joinedPacket = nextPacket(socket, (packet) => packet.type === "joined");
  socket.send(JSON.stringify({ type: "join", name, reconnectToken }));
  const packet = await joinedPacket;
  return {
    slotId: Number(packet.slotId),
    team: Number(packet.team),
    roomId: String(packet.roomId),
    reconnectToken: String(packet.reconnectToken),
  };
}

function close(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}

test("ten WebSocket clients fill one room, reconnect, and remain isolated from another room", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1");
  const sockets: WebSocket[] = [];
  try {
    const url = (roomId: string) => `ws://127.0.0.1:${runtime.port}/ws?room=${roomId}`;
    const mainRoomClients = await Promise.all(
      Array.from({ length: MAX_PLAYERS }, () => connect(url("mars-alpha"))),
    );
    sockets.push(...mainRoomClients);
    const seats = await Promise.all(mainRoomClients.map((socket, index) => join(socket, `Pilot ${index}`)));
    assert.deepEqual(seats.map((seat) => seat.slotId).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(seats.filter((seat) => seat.team === 0).length, 5);
    assert.equal(seats.filter((seat) => seat.team === 1).length, 5);
    assert.ok(seats.every((seat) => seat.roomId === "mars-alpha"));

    const beforeReconnect = seats[0];
    await close(mainRoomClients[0]);
    const replacement = await connect(url("mars-alpha"));
    sockets.push(replacement);
    const reclaimed = await join(replacement, "Pilot 0", beforeReconnect.reconnectToken);
    assert.equal(reclaimed.slotId, beforeReconnect.slotId);
    assert.equal(reclaimed.reconnectToken, beforeReconnect.reconnectToken);

    const isolated = await connect(url("mars-beta"));
    sockets.push(isolated);
    const isolatedSeat = await join(isolated, "Other room");
    assert.equal(isolatedSeat.slotId, 0);
    assert.equal(isolatedSeat.roomId, "mars-beta");
    assert.equal(runtime.roomCount, 2);

    const mainSnapshot = nextPacket(
      replacement,
      (packet) =>
        packet.type === "snapshot" &&
        (packet.snapshot as { players?: Array<{ lastSeq?: number }> } | undefined)?.players?.[0]?.lastSeq === 1,
    );
    replacement.send(
      JSON.stringify({
        type: "input",
        input: { seq: 1, throttle: 1, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null },
      }),
    );
    const acknowledged = await mainSnapshot;
    assert.equal(
      (acknowledged.snapshot as { players: Array<{ lastSeq: number }> }).players[0].lastSeq,
      1,
    );

    const isolatedSnapshot = nextPacket(
      isolated,
      (packet) => packet.type === "snapshot" && Boolean(packet.snapshot),
    );
    const otherRoom = await isolatedSnapshot;
    assert.equal(
      (otherRoom.snapshot as { players: Array<{ lastSeq: number }> }).players[0].lastSeq,
      0,
    );
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});
