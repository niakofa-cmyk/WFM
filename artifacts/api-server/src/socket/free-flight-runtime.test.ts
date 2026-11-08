import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { WebSocket } from "ws";
import { startWingSocketServer } from "./server";
import { authenticateTestSocket, createSocketTestAuth } from "./test-session-auth";

type Packet = { type?: string; [key: string]: unknown };
const testAuth = createSocketTestAuth();

function nextPacket(
  socket: WebSocket,
  accept: (packet: Packet) => boolean,
  timeoutMs = 4_000,
) {
  return new Promise<Packet>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for free-flight packet."));
    }, timeoutMs);
    const onMessage = (data: Buffer) => {
      let packet: Packet;
      try { packet = JSON.parse(data.toString()) as Packet; } catch { return; }
      if (!accept(packet)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(packet);
    };
    socket.on("message", onMessage);
  });
}

async function connect(url: string, userId = `pilot-${randomUUID()}`) {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  await authenticateTestSocket(socket, testAuth, userId);
  return socket;
}

async function join(socket: WebSocket) {
  const joined = nextPacket(socket, (packet) => packet.type === "freeflight_joined");
  socket.send(JSON.stringify({ type: "freeflight_join" }));
  return (await joined).snapshot as {
    protocol: string;
    sessionInstanceId: string;
    tick: number;
    ownActorId: string;
    actors: Array<{
      actorId: string;
      kind: string;
      faction: string;
      shipId: string;
      callsign: string;
      position: { x: number; y: number; z: number };
      [key: string]: unknown;
    }>;
  };
}

function close(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}

function flightInput(seq: number, overrides: Record<string, unknown> = {}) {
  return {
    version: 5,
    seq,
    targetId: null,
    throttle: 0,
    yaw: 0,
    pitch: 0,
    strafe: 0,
    vertical: 0,
    roll: 0,
    fire: false,
    missile: false,
    boost: false,
    brake: false,
    inertial: false,
    aimAssist: false,
    ...overrides,
  };
}

function startRuntime() {
  return startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async (userId) => {
      if (userId === "isolated-pilot") {
        return { sessionKey: "mars:rust-disc", faction: "ussf", shipId: "duskbreaker" };
      }
      if (userId === "accord-pilot") {
        return { sessionKey: "mars:phobos-yard", faction: "accord", shipId: "mandjet" };
      }
      return { sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "duskbreaker" };
    },
    snapshotIntervalMs: 75,
  });
}

test("authenticated pilots receive exact nearby 3D actors only inside their server-derived spatial session", async () => {
  const runtime = await startRuntime();
  const sockets: WebSocket[] = [];
  try {
    const url = `ws://127.0.0.1:${runtime.port}/ws?freeflight=1`;
    const first = await connect(url, "ussf-pilot");
    const second = await connect(url, "accord-pilot");
    const isolated = await connect(url, "isolated-pilot");
    sockets.push(first, second, isolated);

    const [firstSnapshot, secondSnapshot, isolatedSnapshot] = await Promise.all([
      join(first), join(second), join(isolated),
    ]);
    assert.equal(firstSnapshot.protocol, "orbital-freeflight-v1");
    assert.equal(firstSnapshot.sessionInstanceId, secondSnapshot.sessionInstanceId);
    assert.notEqual(firstSnapshot.sessionInstanceId, isolatedSnapshot.sessionInstanceId);

    const firstOtherPilots = firstSnapshot.actors.filter((actor) =>
      actor.kind === "pilot" && actor.actorId !== firstSnapshot.ownActorId,
    );
    assert.equal(firstOtherPilots.length, 1);
    assert.ok(firstSnapshot.actors.some((actor) => actor.kind === "patrol" && actor.faction === "ussf"));
    assert.ok(firstSnapshot.actors.some((actor) => actor.kind === "patrol" && actor.faction === "accord"));
    assert.equal(isolatedSnapshot.actors.filter((actor) => actor.kind === "pilot").length, 1);

    for (const actor of firstSnapshot.actors) {
      assert.equal(Object.hasOwn(actor, "userId"), false);
      assert.equal(Object.hasOwn(actor, "playerId"), false);
    }
    assert.equal(firstOtherPilots[0]!.callsign, "WING PILOT");
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("server advances pilot and enemy patrol ships and publishes authoritative snapshots", async () => {
  const runtime = await startRuntime();
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "moving-pilot");
  try {
    const initial = await join(socket);
    const ownBefore = initial.actors.find((actor) => actor.actorId === initial.ownActorId)!;
    const patrolBefore = initial.actors.find((actor) => actor.kind === "patrol")!;
    const accepted = nextPacket(socket, (packet) => packet.type === "freeflight_input_accepted");
    socket.send(JSON.stringify({ type: "freeflight_input", input: flightInput(1, { throttle: 1 }) }));
    assert.equal((await accepted).seq, 1);

    const moved = await nextPacket(socket, (packet) => {
      if (packet.type !== "freeflight_snapshot") return false;
      const snapshot = packet.snapshot as typeof initial;
      const own = snapshot.actors.find((actor) => actor.actorId === snapshot.ownActorId);
      return snapshot.tick > initial.tick + 5 && Boolean(own && own.position.z < ownBefore.position.z - 0.01);
    }, 5_000);
    const movedSnapshot = moved.snapshot as typeof initial;
    const ownAfter = movedSnapshot.actors.find((actor) => actor.actorId === movedSnapshot.ownActorId)!;
    assert.ok(ownAfter.position.z < ownBefore.position.z);

    const patrolMoved = await nextPacket(socket, (packet) => {
      if (packet.type !== "freeflight_snapshot") return false;
      const snapshot = packet.snapshot as typeof initial;
      const patrol = snapshot.actors.find((actor) => actor.actorId === patrolBefore.actorId);
      return snapshot.tick > initial.tick + 20 && Boolean(patrol &&
        (Math.abs(patrol.position.x - patrolBefore.position.x) > 0.01 ||
         Math.abs(patrol.position.z - patrolBefore.position.z) > 0.01));
    }, 5_000);
    assert.ok((patrolMoved.snapshot as typeof initial).tick > initial.tick + 20);
  } finally {
    await close(socket);
    await runtime.close();
  }
});

test("free-flight rejects client-owned combat outcomes and malformed spatial state", async () => {
  const runtime = await startRuntime();
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "combat-probe");
  try {
    await join(socket);
    const combatError = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({
      type: "freeflight_input",
      input: flightInput(1, { fire: true }),
    }));
    assert.equal((await combatError).reason, "freeflight_combat_not_enabled");

    const malformedError = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({
      type: "freeflight_input",
      input: { ...flightInput(1), position: { x: 999999, y: 0, z: 0 } },
    }));
    assert.equal((await malformedError).reason, "freeflight_invalid_packet");
  } finally {
    await close(socket);
    await runtime.close();
  }
});

test("free-flight admission is mandatory and the server does not accept a client-selected session", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: testAuth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => null,
  });
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "unprovisioned-pilot");
  try {
    const denied = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({ type: "freeflight_join", sessionKey: "mars:forged-location" }));
    assert.equal((await denied).reason, "invalid_freeflight_join");
  } finally {
    await close(socket);
    await runtime.close();
  }
});
