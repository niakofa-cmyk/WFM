import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { WebSocket } from "ws";
import { isFreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import { startWingSocketServer } from "./server";
import { authenticateTestSocket, createSocketTestAuth } from "./test-session-auth";

type Packet = { type?: string; reason?: string; [key: string]: unknown };
const auth = createSocketTestAuth();

function nextPacket(socket: WebSocket, accepts: (packet: Packet) => boolean, timeoutMs = 4_000) {
  return new Promise<Packet>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for free-flight packet."));
    }, timeoutMs);
    const onMessage = (data: Buffer) => {
      let packet: Packet;
      try { packet = JSON.parse(data.toString()) as Packet; } catch { return; }
      if (!accepts(packet)) return;
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
  await authenticateTestSocket(socket, auth, userId);
  return socket;
}

function close(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}

function input(seq: number, values: Record<string, unknown> = {}) {
  return {
    version: 5, seq, targetId: null, throttle: 0, yaw: 0, pitch: 0,
    strafe: 0, vertical: 0, roll: 0, fire: false, missile: false,
    boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false,
    ...values,
  };
}

function makeRuntime() {
  return startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async (userId) => {
      if (userId === "isolated") {
        return { sessionKey: "mars:rust-disc", faction: "ussf", shipId: "duskbreaker" };
      }
      return {
        sessionKey: "mars:phobos-yard",
        faction: userId === "accord" ? "accord" : "ussf",
        shipId: userId === "accord" ? "mandjet" : "duskbreaker",
      };
    },
    snapshotIntervalMs: 75,
  });
}

async function join(socket: WebSocket) {
  const joined = nextPacket(socket, (packet) => packet.type === "freeflight_joined");
  socket.send(JSON.stringify({ type: "freeflight_join" }));
  const packet = await joined;
  assert.ok(isFreeFlightSnapshotV1(packet.snapshot));
  return packet.snapshot as {
    sessionInstanceId: string;
    tick: number;
    ownActorId: string;
    actors: Array<{
      actorId: string;
      kind: string;
      faction: string;
      callsign: string;
      position: { x: number; y: number; z: number };
      [key: string]: unknown;
    }>;
  };
}

test("authenticated pilots see nearby pilots and both server patrol factions only in their admitted location", async () => {
  const runtime = await makeRuntime();
  const sockets: WebSocket[] = [];
  try {
    const url = `ws://127.0.0.1:${runtime.port}/ws?freeflight=1`;
    const ussf = await connect(url, "ussf");
    const accord = await connect(url, "accord");
    const isolated = await connect(url, "isolated");
    sockets.push(ussf, accord, isolated);
    const [first, second, otherLocation] = await Promise.all([
      join(ussf), join(accord), join(isolated),
    ]);
    const sharedPacket = await nextPacket(ussf, (packet) => {
      if (packet.type !== "freeflight_snapshot") return false;
      const snapshot = packet.snapshot as typeof first;
      return snapshot.actors.filter((actor) => actor.kind === "pilot").length === 2;
    });
    const shared = sharedPacket.snapshot as typeof first;
    assert.equal(shared.sessionInstanceId, second.sessionInstanceId);
    assert.notEqual(shared.sessionInstanceId, otherLocation.sessionInstanceId);
    assert.equal(otherLocation.actors.filter((actor) => actor.kind === "pilot").length, 1);
    assert.ok(shared.actors.some((actor) => actor.kind === "patrol" && actor.faction === "ussf"));
    assert.ok(shared.actors.some((actor) => actor.kind === "patrol" && actor.faction === "accord"));
    const remote = shared.actors.find((actor) => actor.kind === "pilot" && actor.actorId !== shared.ownActorId);
    assert.ok(remote);
    assert.equal(remote.callsign, "UNIDENTIFIED CONTACT");
    for (const actor of shared.actors) {
      assert.equal(Object.hasOwn(actor, "userId"), false);
      assert.equal(Object.hasOwn(actor, "playerId"), false);
    }
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("the server advances 3D pilot and patrol movement and rejects client combat state", async () => {
  const runtime = await makeRuntime();
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "moving");
  try {
    const initial = await join(socket);
    const own = initial.actors.find((actor) => actor.actorId === initial.ownActorId)!;
    const patrol = initial.actors.find((actor) => actor.kind === "patrol")!;
    const accepted = nextPacket(socket, (packet) => packet.type === "freeflight_input_accepted");
    socket.send(JSON.stringify({ type: "freeflight_input", input: input(1, { throttle: 1 }) }));
    assert.equal((await accepted).seq, 1);
    const movedPacket = await nextPacket(socket, (packet) => {
      if (packet.type !== "freeflight_snapshot") return false;
      const snapshot = packet.snapshot as typeof initial;
      const current = snapshot.actors.find((actor) => actor.actorId === snapshot.ownActorId);
      return snapshot.tick > initial.tick + 5 && Boolean(current && current.position.z < own.position.z - 0.01);
    });
    const moved = movedPacket.snapshot as typeof initial;
    const currentPatrol = moved.actors.find((actor) => actor.actorId === patrol.actorId)!;
    assert.ok(
      Math.abs(currentPatrol.position.x - patrol.position.x) > 0.01 ||
      Math.abs(currentPatrol.position.z - patrol.position.z) > 0.01,
    );

    const combatError = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({ type: "freeflight_input", input: input(2, { fire: true }) }));
    assert.equal((await combatError).reason, "freeflight_combat_not_enabled");
    const spatialError = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({
      type: "freeflight_input",
      input: { ...input(2), position: { x: 1e9, y: 0, z: 0 } },
    }));
    assert.equal((await spatialError).reason, "freeflight_invalid_packet");
  } finally {
    await close(socket);
    await runtime.close();
  }
});

test("free-flight admission and reconnect sequence come from the authenticated server seat", async () => {
  const runtime = await makeRuntime();
  const url = `ws://127.0.0.1:${runtime.port}/ws?freeflight=1`;
  let first: WebSocket | null = null;
  let replacement: WebSocket | null = null;
  try {
    first = await connect(url, "reconnect");
    const firstJoin = nextPacket(first, (packet) => packet.type === "freeflight_joined");
    first.send(JSON.stringify({ type: "freeflight_join" }));
    const joined = await firstJoin;
    const firstSnapshot = joined.snapshot as { ownActorId: string; actors: Array<{ actorId: string; kind: string }> };
    assert.equal(joined.nextInputSeq, 1);

    const accepted = nextPacket(first, (packet) => packet.type === "freeflight_input_accepted");
    first.send(JSON.stringify({ type: "freeflight_input", input: input(1, { throttle: 0.5 }) }));
    assert.equal((await accepted).seq, 1);
    await close(first);

    replacement = await connect(url, "reconnect");
    const rejoin = nextPacket(replacement, (packet) => packet.type === "freeflight_joined");
    replacement.send(JSON.stringify({ type: "freeflight_join" }));
    const resumed = await rejoin;
    assert.equal(resumed.nextInputSeq, 2);
    const snapshot = resumed.snapshot as typeof firstSnapshot;
    assert.equal(snapshot.ownActorId, firstSnapshot.ownActorId);
    assert.equal(snapshot.actors.filter((actor) => actor.kind === "pilot").length, 1);
    const acceptedAgain = nextPacket(replacement, (packet) => packet.type === "freeflight_input_accepted");
    replacement.send(JSON.stringify({ type: "freeflight_input", input: input(2, { throttle: 0.5 }) }));
    assert.equal((await acceptedAgain).seq, 2);
  } finally {
    if (first) await close(first);
    if (replacement) await close(replacement);
    await runtime.close();
  }
});

test("a client cannot choose a free-flight location or join without admission", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => null,
  });
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "denied");
  try {
    const error = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({ type: "freeflight_join", sessionKey: "mars:forged" }));
    assert.equal((await error).reason, "invalid_freeflight_join");
  } finally {
    await close(socket);
    await runtime.close();
  }
});
