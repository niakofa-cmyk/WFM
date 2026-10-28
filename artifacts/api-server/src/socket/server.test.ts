import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { WebSocket } from "ws";
import { MAX_PLAYERS } from "../game/wing";
import { startNetworkImpairmentProxy } from "./impairment-proxy";
import { startWingSocketServer } from "./server";
import { authenticateTestSocket, createSocketTestAuth } from "./test-session-auth";

type Packet = { type?: string; [key: string]: unknown };
const testAuth = createSocketTestAuth();

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

async function connect(url: string, playerId = `pilot-${randomUUID()}`) {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  await authenticateTestSocket(socket, testAuth, playerId);
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

test("socket rejects unauthenticated commands and binds reconnect seats to the verified player", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
  });
  const sockets: WebSocket[] = [];
  try {
    const url = `ws://127.0.0.1:${runtime.port}/ws?room=mars-auth`;
    const unauthenticated = new WebSocket(url);
    sockets.push(unauthenticated);
    await new Promise<void>((resolve, reject) => {
      unauthenticated.once("open", resolve);
      unauthenticated.once("error", reject);
    });
    const unauthenticatedError = nextPacket(
      unauthenticated,
      (packet) => packet.type === "error",
    );
    unauthenticated.send(JSON.stringify({
      type: "join",
      name: "Forged pilot",
      playerId: "forged-client-identity",
    }));
    assert.equal((await unauthenticatedError).reason, "authentication_required");
    assert.equal(runtime.roomCount, 0);

    const owner = await connect(url, "verified-player-a");
    sockets.push(owner);
    const ownerSeat = await join(owner, "Pilot A");
    const duplicateIdentity = await connect(url, "verified-player-a");
    sockets.push(duplicateIdentity);
    const duplicateSeatError = nextPacket(
      duplicateIdentity,
      (packet) => packet.type === "error",
    );
    duplicateIdentity.send(JSON.stringify({ type: "join", name: "Second seat" }));
    assert.equal((await duplicateSeatError).reason, "session_lost");
    await close(duplicateIdentity);
    await close(owner);

    const intruder = await connect(url, "verified-player-b");
    sockets.push(intruder);
    const stolenSeatError = nextPacket(
      intruder,
      (packet) => packet.type === "error",
    );
    intruder.send(JSON.stringify({
      type: "join",
      name: "Pilot B",
      playerId: "verified-player-a",
      reconnectToken: ownerSeat.reconnectToken,
    }));
    assert.equal((await stolenSeatError).reason, "session_lost");

    const ownerReconnect = await connect(url, "verified-player-a");
    sockets.push(ownerReconnect);
    const reclaimedSeat = await join(
      ownerReconnect,
      "Pilot A",
      ownerSeat.reconnectToken,
    );
    assert.equal(reclaimedSeat.slotId, ownerSeat.slotId);
    assert.equal(reclaimedSeat.reconnectToken, ownerSeat.reconnectToken);
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("ten-client lobby gates launch, reconnects safely, and isolates separate rooms", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
  });
  const sockets: WebSocket[] = [];
  try {
    const url = (roomId: string) => `ws://127.0.0.1:${runtime.port}/ws?room=${roomId}`;
    const mainRoomClients = await Promise.all(
      Array.from({ length: MAX_PLAYERS }, (_, index) => connect(url("mars-alpha"), `pilot-${index}`)),
    );
    sockets.push(...mainRoomClients);
    const seats = await Promise.all(mainRoomClients.map((socket, index) => join(socket, `Pilot ${index}`)));
    assert.deepEqual(seats.map((seat) => seat.slotId).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(seats.filter((seat) => seat.team === 0).length, 5);
    assert.equal(seats.filter((seat) => seat.team === 1).length, 5);
    assert.ok(seats.every((seat) => seat.roomId === "mars-alpha"));
    const overflow = await connect(url("mars-alpha"));
    sockets.push(overflow);
    const fullRoomError = nextPacket(overflow, (packet) => packet.type === "error");
    overflow.send(JSON.stringify({ type: "join", name: "Eleventh pilot" }));
    assert.equal((await fullRoomError).reason, "full");

    const nonHostStart = nextPacket(
      mainRoomClients[1],
      (packet) => packet.type === "error" && packet.reason === "host_only",
    );
    mainRoomClients[1].send(JSON.stringify({ type: "start" }));
    await nonHostStart;

    const refusedStart = nextPacket(
      mainRoomClients[0],
      (packet) => packet.type === "error" && packet.reason === "pilots_not_ready",
    );
    mainRoomClients[0].send(JSON.stringify({ type: "start" }));
    await refusedStart;

    const fullyReady = nextPacket(mainRoomClients[0], (packet) => {
      if (packet.type !== "lobby") return false;
      const lobby = packet as { players?: Array<{ connected?: boolean; ready?: boolean }> };
      return Boolean(lobby.players?.filter((player) => player.connected).every((player) => player.ready));
    });
    for (const socket of mainRoomClients) socket.send(JSON.stringify({ type: "ready", ready: true }));
    await fullyReady;
    const started = nextPacket(mainRoomClients[0], (packet) => packet.type === "started");
    mainRoomClients[0].send(JSON.stringify({ type: "start" }));
    await started;

    const lateJoiner = await connect(url("mars-alpha"));
    sockets.push(lateJoiner);
    const lateError = nextPacket(lateJoiner, (packet) => packet.type === "error");
    lateJoiner.send(JSON.stringify({ type: "join", name: "Late pilot" }));
    assert.equal((await lateError).reason, "match_started");

    const beforeReconnect = seats[0];
    await close(mainRoomClients[0]);
    const replacement = await connect(url("mars-alpha"), "pilot-0");
    sockets.push(replacement);
    const rejoined = nextPacket(replacement, (packet) => packet.type === "joined");
    replacement.send(JSON.stringify({
      type: "join",
      name: "Pilot 0",
      reconnectToken: beforeReconnect.reconnectToken,
    }));
    const reclaimedPacket = await rejoined;
    assert.equal(Number(reclaimedPacket.slotId), beforeReconnect.slotId);
    assert.equal(reclaimedPacket.phase, "active");
    assert.equal(String(reclaimedPacket.reconnectToken), beforeReconnect.reconnectToken);

    const inputAck = nextPacket(
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
    const acknowledged = await inputAck;
    assert.equal((acknowledged.snapshot as { players: Array<{ lastSeq: number }> }).players[0].lastSeq, 1);

    const delayedAck = nextPacket(
      replacement,
      (packet) =>
        packet.type === "snapshot" &&
        (packet.snapshot as { players?: Array<{ lastSeq?: number }> } | undefined)?.players?.[0]?.lastSeq === 2,
    );
    setTimeout(() => replacement.send(JSON.stringify({
      type: "input",
      input: { seq: 2, throttle: 0.2, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null },
    })), 150);
    await delayedAck;

    const isolated = await connect(url("mars-beta"));
    sockets.push(isolated);
    const isolatedSeat = await join(isolated, "Other room");
    assert.equal(isolatedSeat.slotId, 0);
    assert.equal(isolatedSeat.team, 0);
    assert.equal(isolatedSeat.roomId, "mars-beta");
    assert.equal(runtime.roomCount, 2);
    const isolatedReady = nextPacket(isolated, (packet) => {
      const lobby = packet as { players?: Array<{ slotId: number; ready: boolean }> };
      return packet.type === "lobby" && Boolean(lobby.players?.find((player) => player.slotId === 0)?.ready);
    });
    isolated.send(JSON.stringify({ type: "ready", ready: true }));
    await isolatedReady;
    const otherStarted = nextPacket(isolated, (packet) => packet.type === "started");
    isolated.send(JSON.stringify({ type: "start" }));
    await otherStarted;
    const isolatedSnapshot = await nextPacket(isolated, (packet) => packet.type === "snapshot" && Boolean(packet.snapshot));
    assert.equal((isolatedSnapshot.snapshot as { players: Array<{ lastSeq: number }> }).players[0].lastSeq, 0);

    const invalidInput = nextPacket(replacement, (packet) => packet.type === "error" && packet.reason === "invalid_input");
    replacement.send(JSON.stringify({
      type: "input",
      input: { seq: 1_000_000, throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null },
    }));
    await invalidInput;
    const invalidAxis = nextPacket(replacement, (packet) => packet.type === "error" && packet.reason === "invalid_input");
    replacement.send(JSON.stringify({
      type: "input",
      input: { seq: 2, throttle: 100, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null },
    }));
    await invalidAxis;
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("two pilots control separate slots and receive identical authoritative snapshots", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
    tickIntervalMs: 2,
    snapshotIntervalMs: 20,
  });
  const sockets: WebSocket[] = [];
  try {
    const url = `ws://127.0.0.1:${runtime.port}/ws?room=mars-pilots`;
    const pilots = await Promise.all([connect(url), connect(url)]);
    sockets.push(...pilots);
    const seats = await Promise.all(pilots.map((socket, index) => join(socket, `Human ${index}`)));
    assert.notEqual(seats[0].slotId, seats[1].slotId);
    assert.notEqual(seats[0].team, seats[1].team);

    const ready = nextPacket(pilots[0], (packet) => {
      if (packet.type !== "lobby") return false;
      const state = packet as { players?: Array<{ connected: boolean; ready: boolean }> };
      return Boolean(state.players?.filter((player) => player.connected).every((player) => player.ready));
    });
    pilots.forEach((socket) => socket.send(JSON.stringify({ type: "ready", ready: true })));
    await ready;

    const starts = pilots.map((socket) => nextPacket(socket, (packet) => packet.type === "started"));
    pilots[0].send(JSON.stringify({ type: "start" }));
    const startPackets = await Promise.all(starts);
    const initialSnapshot = startPackets[0].snapshot as { match: {
      player: { x: number; z: number };
      enemies: Array<{ x: number; z: number }>;
    } };
    const initialMatch = initialSnapshot.match;

    const hasBothInputs = (packet: Packet) => {
      if (packet.type !== "snapshot") return false;
      const snapshot = packet.snapshot as { players?: Array<{ lastSeq?: number }> } | undefined;
      return seats.every((seat) => snapshot?.players?.[seat.slotId]?.lastSeq === 1);
    };
    const receivedSnapshots = pilots.map((socket) => nextPacket(socket, hasBothInputs));
    for (const [index, socket] of pilots.entries()) {
      socket.send(JSON.stringify({
        type: "input",
        input: {
          seq: 1,
          throttle: index === 0 ? 1 : -1,
          yaw: 0,
          strafe: 0,
          pitch: 0,
          fire: index === 0,
          ult: false,
          lock: false,
          evade: 0,
          preset: null,
        },
      }));
    }
    const [first, second] = await Promise.all(receivedSnapshots);
    assert.deepEqual(first.snapshot, second.snapshot);

    const snapshot = first.snapshot as {
      players: Array<{ lastSeq: number }>;
      match: { player: { ai: boolean; x: number; z: number }; enemies: Array<{ x: number; z: number }> };
    };
    assert.equal(snapshot.players[seats[0].slotId].lastSeq, 1);
    assert.equal(snapshot.players[seats[1].slotId].lastSeq, 1);
    assert.equal(snapshot.match.player.ai, false);
    assert.notDeepEqual(
      { x: snapshot.match.player.x, z: snapshot.match.player.z },
      { x: initialMatch.player.x, z: initialMatch.player.z },
    );
    assert.notDeepEqual(
      { x: snapshot.match.enemies[0].x, z: snapshot.match.enemies[0].z },
      { x: initialMatch.enemies[0].x, z: initialMatch.enemies[0].z },
    );
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("seeded impairment proxy exercises delayed, jittered, and lost input/snapshot frames", async (t) => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
    tickIntervalMs: 2,
    snapshotIntervalMs: 20,
  });
  let proxy: Awaited<ReturnType<typeof startNetworkImpairmentProxy>> | undefined;
  let socket: WebSocket | undefined;
  const clients: WebSocket[] = [];
  try {
    proxy = await startNetworkImpairmentProxy(`ws://127.0.0.1:${runtime.port}`, {
      latencyMs: 35,
      jitterMs: 20,
      frameLossRate: 0.2,
      seed: 41027,
    });
    socket = await connect(`ws://127.0.0.1:${proxy.port}/ws?room=mars-netem`, "impaired-pilot");
    clients.push(socket);
    const client = socket;
    const seat = await join(client, "Impaired pilot");
    const ready = nextPacket(client, (packet) => {
      if (packet.type !== "lobby") return false;
      const state = packet as { players?: Array<{ connected: boolean; ready: boolean }> };
      return Boolean(state.players?.filter((player) => player.connected).every((player) => player.ready));
    });
    client.send(JSON.stringify({ type: "ready", ready: true }));
    await ready;
    const started = nextPacket(client, (packet) => packet.type === "started");
    client.send(JSON.stringify({ type: "start" }));
    await started;

    const acknowledged = nextPacket(
      client,
      (packet) =>
        packet.type === "snapshot" &&
        ((packet.snapshot as { players?: Array<{ lastSeq?: number }> } | undefined)
          ?.players?.[seat.slotId]?.lastSeq ?? 0) >= 80,
      10_000,
    );
    for (let seq = 1; seq <= 100; seq += 1) {
      client.send(JSON.stringify({
        type: "input",
        input: {
          seq,
          throttle: 0.6,
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
      await new Promise((resolve) => setTimeout(resolve, 33));
    }
    const snapshot = await acknowledged;
    const lastSeq = (snapshot.snapshot as { players: Array<{ lastSeq: number }> }).players[seat.slotId].lastSeq;

    await close(client);
    socket = await connect(`ws://127.0.0.1:${proxy.port}/ws?room=mars-netem`, "impaired-pilot");
    clients.push(socket);
    const reclaimed = await join(socket, "Impaired pilot", seat.reconnectToken);
    assert.equal(reclaimed.slotId, seat.slotId);
    assert.equal(reclaimed.reconnectToken, seat.reconnectToken);
    const afterReconnect = nextPacket(
      socket,
      (packet) =>
        packet.type === "snapshot" &&
        ((packet.snapshot as { players?: Array<{ lastSeq?: number }> } | undefined)
          ?.players?.[seat.slotId]?.lastSeq ?? 0) >= 120,
      10_000,
    );
    for (let seq = 101; seq <= 140; seq += 1) {
      socket.send(JSON.stringify({
        type: "input",
        input: {
          seq,
          throttle: 0.6,
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
      await new Promise((resolve) => setTimeout(resolve, 33));
    }
    const resumedSnapshot = await afterReconnect;
    const resumedSeq = (resumedSnapshot.snapshot as { players: Array<{ lastSeq: number }> }).players[seat.slotId].lastSeq;
    const measured = proxy.metrics;

    assert.ok(lastSeq >= 60);
    assert.ok(resumedSeq >= 120);
    assert.ok(measured.clientToServer.dropped > 0, "the configured input-frame loss was exercised");
    assert.ok(measured.serverToClient.dropped > 0, "the configured snapshot-frame loss was exercised");
    for (const direction of [measured.clientToServer, measured.serverToClient]) {
      assert.ok(direction.forwarded > 0);
      assert.ok(direction.delaySamples > 0);
      assert.ok(direction.minDelayMs >= 15);
      assert.ok(direction.maxDelayMs <= 55);
      assert.ok(direction.maxDelayMs > direction.minDelayMs);
    }
    t.diagnostic(JSON.stringify({
      seed: 41027,
      latencyMs: 35,
      jitterMs: 20,
      frameLossRate: 0.2,
      lastSeq,
      resumedSeq,
      clientToServer: measured.clientToServer,
      serverToClient: measured.serverToClient,
    }));
  } finally {
    for (const client of clients) await close(client);
    if (proxy) await proxy.close();
    await runtime.close();
  }
});

test("a restarted socket notifies every pilot, rejects stale sessions, and accepts fresh rooms", async () => {
  let runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
  });
  const sockets: WebSocket[] = [];
  try {
    const roomUrl = `ws://127.0.0.1:${runtime.port}/ws?room=mars-recovery`;
    const oldSocket = await connect(roomUrl);
    const peerSocket = await connect(roomUrl);
    sockets.push(oldSocket, peerSocket);
    const oldSeat = await join(oldSocket, "Pilot");
    await join(peerSocket, "Wingmate");
    const allPilotsReady = nextPacket(oldSocket, (packet) => {
      if (packet.type !== "lobby") return false;
      const players = packet.players as Array<{ connected?: boolean; ready?: boolean }> | undefined;
      return Boolean(players?.filter((player) => player.connected).every((player) => player.ready));
    });
    oldSocket.send(JSON.stringify({ type: "ready", ready: true }));
    peerSocket.send(JSON.stringify({ type: "ready", ready: true }));
    await allPilotsReady;

    const bothStarted = Promise.all([
      nextPacket(oldSocket, (packet) => packet.type === "started"),
      nextPacket(peerSocket, (packet) => packet.type === "started"),
    ]);
    oldSocket.send(JSON.stringify({ type: "start" }));
    await bothStarted;

    const interrupted = [oldSocket, peerSocket].map((socket) =>
      nextPacket(socket, (packet) => packet.type === "interrupted"));
    const closed = [oldSocket, peerSocket].map((socket) =>
      new Promise<{ code: number; reason: string }>((resolve) => {
        socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
      }));
    const shutdown = runtime.close();
    const repeatedShutdown = runtime.close();
    const lateConnectionAccepted = connect(roomUrl)
      .then(async (lateSocket) => {
        sockets.push(lateSocket);
        await close(lateSocket);
        return true;
      })
      .catch(() => false);
    assert.equal(await lateConnectionAccepted, false);
    assert.deepEqual((await Promise.all(interrupted)).map((packet) => packet.reason), [
      "server_restart",
      "server_restart",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(oldSocket.readyState, WebSocket.OPEN);
    assert.equal(peerSocket.readyState, WebSocket.OPEN);
    oldSocket.send(JSON.stringify({ type: "interrupted_ack" }));
    peerSocket.send(JSON.stringify({ type: "interrupted_ack" }));
    await Promise.all([shutdown, repeatedShutdown]);
    assert.deepEqual(await Promise.all(closed), [
      { code: 4002, reason: "server_restart" },
      { code: 4002, reason: "server_restart" },
    ]);
    runtime = await startWingSocketServer(0, "127.0.0.1", {
      verifySessionToken: testAuth.verifySessionToken,
    });

    const staleSession = await connect(`ws://127.0.0.1:${runtime.port}/ws?room=mars-recovery`);
    sockets.push(staleSession);
    const expired = nextPacket(staleSession, (packet) => packet.type === "error");
    staleSession.send(JSON.stringify({ type: "join", name: "Pilot", reconnectToken: oldSeat.reconnectToken }));
    assert.equal((await expired).reason, "session_lost");
    assert.equal(runtime.roomCount, 0);

    const fresh = await connect(`ws://127.0.0.1:${runtime.port}/ws?room=mars-fresh`);
    sockets.push(fresh);
    const freshSeat = await join(fresh, "Fresh pilot");
    assert.equal(freshSeat.slotId, 0);
    assert.equal(freshSeat.roomId, "mars-fresh");
    const freshReady = nextPacket(fresh, (packet) => packet.type === "lobby" &&
      Boolean((packet.players as Array<{ slotId: number; ready: boolean }> | undefined)?.find((player) => player.slotId === 0)?.ready));
    fresh.send(JSON.stringify({ type: "ready", ready: true }));
    await freshReady;
    const freshStarted = nextPacket(fresh, (packet) => packet.type === "started");
    fresh.send(JSON.stringify({ type: "start" }));
    await freshStarted;
    const limited = nextPacket(fresh, (packet) => packet.type === "error" && packet.reason === "rate_limited");
    for (let seq = 1; seq <= 46; seq += 1) {
      fresh.send(JSON.stringify({
        type: "input",
        input: { seq, throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null },
      }));
    }
    await limited;
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("an active pilot is closed safely after the bounded acknowledgement wait", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
    shutdownAckTimeoutMs: 20,
  });
  const sockets: WebSocket[] = [];
  try {
    const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?room=mars-timeout`);
    sockets.push(socket);
    await join(socket, "Pilot");
    const ready = nextPacket(socket, (packet) => {
      if (packet.type !== "lobby") return false;
      const players = packet.players as Array<{ ready?: boolean }> | undefined;
      return Boolean(players?.some((player) => player.ready));
    });
    socket.send(JSON.stringify({ type: "ready", ready: true }));
    await ready;
    const started = nextPacket(socket, (packet) => packet.type === "started");
    socket.send(JSON.stringify({ type: "start" }));
    await started;

    const interrupted = nextPacket(socket, (packet) => packet.type === "interrupted");
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
    });
    await runtime.close();
    assert.equal((await interrupted).reason, "server_restart");
    assert.deepEqual(await closed, { code: 4002, reason: "server_restart" });
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("ten concurrent pilots receive the authoritative match result at the strike boundary", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
    tickIntervalMs: 1,
    snapshotIntervalMs: 33,
  });
  const sockets: WebSocket[] = [];
  const inputTimers: NodeJS.Timeout[] = [];
  try {
    const url = `ws://127.0.0.1:${runtime.port}/ws?room=mars-full-match`;
    const pilots = await Promise.all(Array.from({ length: MAX_PLAYERS }, () => connect(url)));
    sockets.push(...pilots);
    const seats = await Promise.all(pilots.map((socket, index) => join(socket, `Pilot ${index}`)));
    assert.equal(seats.filter((seat) => seat.team === 0).length, 5);
    assert.equal(seats.filter((seat) => seat.team === 1).length, 5);

    const ready = nextPacket(pilots[0], (packet) => {
      if (packet.type !== "lobby") return false;
      const lobby = packet as { players?: Array<{ connected: boolean; ready: boolean }> };
      return Boolean(lobby.players?.filter((player) => player.connected).every((player) => player.ready));
    });
    for (const socket of pilots) socket.send(JSON.stringify({ type: "ready", ready: true }));
    await ready;

    const started = nextPacket(pilots[0], (packet) => packet.type === "started");
    pilots[0].send(JSON.stringify({ type: "start" }));
    await started;

    pilots.forEach((socket) => {
      let seq = 0;
      inputTimers.push(setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        seq += 1;
        socket.send(JSON.stringify({
          type: "input",
          input: { seq, throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false, lock: false, evade: 0, preset: null },
        }));
      }, 33));
    });

    const finished = await nextPacket(
      pilots[0],
      (packet) => {
        const match = (packet.snapshot as { match?: { over?: string } } | undefined)?.match;
        return packet.type === "snapshot" && Boolean(match?.over);
      },
      30_000,
    );
    const result = (finished.snapshot as { match: { over: string; time: number }; players: unknown[] });
    assert.ok(["win", "loss", "draw"].includes(result.match.over));
    assert.ok(result.match.time >= 360);
    assert.equal(result.players.length, MAX_PLAYERS);
  } finally {
    inputTimers.forEach(clearInterval);
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});
