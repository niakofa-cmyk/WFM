import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { MAX_PLAYERS } from "../game/wing";
import { startNetworkImpairmentProxy } from "./impairment-proxy";
import { startWingSocketServer } from "./server";

type Packet = { type?: string; [key: string]: unknown };
type Seat = { slotId: number; team: number; reconnectToken: string };
type Snapshot = {
  tick: number;
  players: Array<{ slotId: number; connected: boolean; lastSeq: number }>;
  match: { over?: string; time: number };
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function nextPacket(
  socket: WebSocket,
  accept: (packet: Packet) => boolean,
  timeoutMs = 5000,
  description = "expected packet",
) {
  return new Promise<Packet>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${description} after ${timeoutMs}ms.`));
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
  const joined = nextPacket(
    socket,
    (packet) => packet.type === "joined" || packet.type === "error",
    10_000,
    `join response for ${name}`,
  );
  socket.send(JSON.stringify({ type: "join", name, ...(reconnectToken ? { reconnectToken } : {}) }));
  const packet = await joined;
  if (packet.type === "error") {
    throw new Error(`Join for ${name} was rejected: ${String(packet.reason ?? "unknown")}.`);
  }
  return {
    slotId: Number(packet.slotId),
    team: Number(packet.team),
    reconnectToken: String(packet.reconnectToken),
    phase: String(packet.phase),
  };
}

async function terminate(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1000);
    socket.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.terminate();
  });
}

function waitUntil(predicate: () => boolean, timeoutMs: number, label: string) {
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${label}.`));
      }
    }, 20);
  });
}

test("ten impaired pilots share authoritative match state, reconnect, and finish together", async (t) => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    tickIntervalMs: 1,
    snapshotIntervalMs: 33,
  });
  const proxies: Array<Awaited<ReturnType<typeof startNetworkImpairmentProxy>>> = [];
  const sockets: WebSocket[] = [];
  const inputTimers: NodeJS.Timeout[] = [];
  try {
    const proxyConfigs = Array.from({ length: MAX_PLAYERS }, (_, slotId) => ({
      latencyMs: 35,
      jitterMs: 20,
      frameLossRate: 0.12,
      seed: 91_021 + slotId * 977,
    }));
    for (const config of proxyConfigs) {
      proxies.push(await startNetworkImpairmentProxy(`ws://127.0.0.1:${runtime.port}`, config));
    }

    const socketsByPilot: WebSocket[] = [];
    const seatsByPilot: Seat[] = [];
    const frameHistory = Array.from({ length: MAX_PLAYERS }, () => new Map<number, string>());
    const completed: Array<Snapshot | undefined> = Array.from({ length: MAX_PLAYERS });
    let commonFrame: { tick: number; serialized: string } | undefined;

    const observe = (slotId: number, socket: WebSocket) => {
      socket.on("message", (data: Buffer) => {
        let packet: Packet;
        try {
          packet = JSON.parse(data.toString()) as Packet;
        } catch {
          return;
        }
        if (packet.type !== "snapshot" || !packet.snapshot || typeof packet.snapshot !== "object") return;
        const snapshot = packet.snapshot as Snapshot;
        const serialized = JSON.stringify(snapshot);
        const frames = frameHistory[slotId];
        frames.set(snapshot.tick, serialized);
        const oldestRetainedTick = snapshot.tick - 500;
        for (const tick of frames.keys()) {
          if (tick < oldestRetainedTick) frames.delete(tick);
        }
        if (snapshot.match.over) completed[slotId] = snapshot;

        if (!commonFrame) {
          const sharedTicks = [...frameHistory[0].keys()].filter((tick) =>
            frameHistory.every((history) => history.has(tick)),
          );
          const tick = sharedTicks.find((candidate) => {
            const reference = frameHistory[0].get(candidate);
            return frameHistory.every((history) => history.get(candidate) === reference);
          });
          if (tick !== undefined) {
            commonFrame = { tick, serialized: frameHistory[0].get(tick)! };
          }
        }
      });
    };

    for (let slotId = 0; slotId < MAX_PLAYERS; slotId += 1) {
      const socket = await connect(`ws://127.0.0.1:${proxies[slotId].port}/ws?room=impaired-ten`);
      sockets.push(socket);
      socketsByPilot[slotId] = socket;
      observe(slotId, socket);
      seatsByPilot[slotId] = await join(socket, `Pilot ${slotId}`);
    }
    assert.deepEqual(seatsByPilot.map((seat) => seat.slotId).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(seatsByPilot.filter((seat) => seat.team === 0).length, 5);
    assert.equal(seatsByPilot.filter((seat) => seat.team === 1).length, 5);

    const ready = nextPacket(socketsByPilot[0], (packet) => {
      if (packet.type !== "lobby") return false;
      const players = packet.players as Array<{ connected: boolean; ready: boolean }> | undefined;
      return Boolean(players?.filter((player) => player.connected).every((player) => player.ready));
    }, 10_000, "all pilots ready");
    for (const socket of socketsByPilot) socket.send(JSON.stringify({ type: "ready", ready: true }));
    await ready;
    const started = nextPacket(socketsByPilot[0], (packet) => packet.type === "started", 10_000, "match start");
    socketsByPilot[0].send(JSON.stringify({ type: "start" }));
    await started;

    const sequences = Array.from({ length: MAX_PLAYERS }, () => 0);
    for (let pilotIndex = 0; pilotIndex < MAX_PLAYERS; pilotIndex += 1) {
      inputTimers.push(setInterval(() => {
        const socket = socketsByPilot[pilotIndex];
        if (socket.readyState !== WebSocket.OPEN) return;
        sequences[pilotIndex] += 1;
        socket.send(JSON.stringify({
          type: "input",
          input: {
            seq: sequences[pilotIndex],
            throttle: 0,
            yaw: 0,
            strafe: 0,
            pitch: 0,
            fire: false,
            ult: false,
            lock: false,
            evade: 0,
            preset: null,
          },
        }));
      }, 45));
    }

    const hardReconnect = async (pilotIndex: number) => {
      const seat = seatsByPilot[pilotIndex];
      const priorSocket = socketsByPilot[pilotIndex];
      await terminate(priorSocket);
      await delay(250);
      const replacement = await connect(`ws://127.0.0.1:${proxies[pilotIndex].port}/ws?room=impaired-ten`);
      sockets.push(replacement);
      socketsByPilot[pilotIndex] = replacement;
      observe(pilotIndex, replacement);
      const reclaimed = await join(replacement, `Pilot ${pilotIndex}`, seat.reconnectToken);
      assert.equal(reclaimed.slotId, seat.slotId);
      assert.equal(reclaimed.reconnectToken, seat.reconnectToken);
      assert.equal(reclaimed.phase, "active");
    };

    await delay(1300);
    await hardReconnect(2);
    await delay(250);
    await hardReconnect(7);

    await waitUntil(() => Boolean(commonFrame), 20_000, "a matching authoritative snapshot frame at every client");
    assert.ok(commonFrame, "all ten clients received the same server snapshot at the same tick");

    await waitUntil(() => completed.every(Boolean), 20_000, "the completed match snapshot at every client");
    const finalSnapshots = completed as Snapshot[];
    await waitUntil(() => {
      const sharedOverTicks = [...frameHistory[0].keys()].filter((tick) =>
        frameHistory.every((history) => history.has(tick)),
      );
      return sharedOverTicks.some((tick) => {
        const frame = frameHistory[0].get(tick);
        if (!frame || !JSON.parse(frame).match.over) return false;
        return frameHistory.every((history) => history.get(tick) === frame);
      });
    }, 20_000, "a shared final match snapshot at the same server tick");
    const commonFinalFrame = [...frameHistory[0].keys()]
      .filter((tick) => frameHistory.every((history) => history.has(tick)))
      .map((tick) => frameHistory[0].get(tick)!)
      .find((frame) =>
        Boolean((JSON.parse(frame) as Snapshot).match.over) &&
        frameHistory.every((history) => history.get((JSON.parse(frame) as Snapshot).tick) === frame),
      );
    assert.ok(commonFinalFrame, "all ten clients received the same final snapshot");
    const finalSnapshot = JSON.parse(commonFinalFrame) as Snapshot;
    assert.ok(["win", "loss", "draw"].includes(finalSnapshot.match.over ?? ""));
    assert.ok(Number.isFinite(finalSnapshot.match.time));
    assert.equal(finalSnapshot.players.length, MAX_PLAYERS);
    assert.ok(finalSnapshots.every((snapshot) => snapshot.match.over === finalSnapshot.match.over));
    for (const player of finalSnapshot.players) {
      assert.equal(player.connected, true, `slot ${player.slotId} has reconnected`);
      assert.ok(player.lastSeq >= 50, `slot ${player.slotId} had sequenced inputs accepted`);
    }

    const linkMetrics = proxies.map((proxy) => proxy.metrics);
    for (const [slotId, measured] of linkMetrics.entries()) {
      assert.ok(measured.clientToServer.dropped > 0, `pilot ${slotId} experienced input loss`);
      assert.ok(measured.serverToClient.dropped > 0, `pilot ${slotId} experienced snapshot loss`);
      for (const direction of [measured.clientToServer, measured.serverToClient]) {
        assert.ok(direction.forwarded > 0);
        assert.ok(direction.delaySamples > 0);
        assert.ok(direction.minDelayMs >= 15);
        assert.ok(direction.maxDelayMs <= 55);
        assert.ok(direction.maxDelayMs > direction.minDelayMs);
      }
    }

    t.diagnostic(JSON.stringify({
      clients: MAX_PLAYERS,
      completedAtGameSeconds: finalSnapshot.match.time,
      finalServerTick: finalSnapshot.tick,
      commonSnapshotTick: commonFrame.tick,
      hardReconnectSlots: [seatsByPilot[2].slotId, seatsByPilot[7].slotId],
      frameLossRate: 0.12,
      latencyMs: 35,
      jitterMs: 20,
      perPilot: linkMetrics.map((metrics, slotId) => ({
        slotId,
        lastSeq: finalSnapshot.players[slotId].lastSeq,
        clientToServer: metrics.clientToServer,
        serverToClient: metrics.serverToClient,
      })),
    }));
  } finally {
    inputTimers.forEach(clearInterval);
    await Promise.all(sockets.map(terminate));
    await Promise.all(proxies.map((proxy) => proxy.close()));
    await runtime.close();
  }
});
