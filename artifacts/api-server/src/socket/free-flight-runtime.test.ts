import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { WebSocket } from "ws";
import {
  anomalyGravityWellForSector,
  isFreeFlightEnvironmentV1,
  isFreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import { readExplorationReceipt } from "../game/exploration-encounter";
import type { PersistentPatrolShip } from "@workspace/db";
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
      yaw: number;
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
    assert.equal((await combatError).reason, "freeflight_engagement_required");
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

test("persistent patrol combat resolves server-side damage, kill attribution, and reward settlement in shared flight", async () => {
  const ship: PersistentPatrolShip = {
    id: "persistent-test-ship-0001",
    hullId: "shakuna",
    name: "Accord hunter",
    callsign: "Vesper",
  };
  const contact = {
    patrolId: "persistent-test-patrol-0001",
    locationId: "phobos-yard",
    faction: "accord" as const,
    callsign: "Vesper Flight",
    route: ["phobos-yard", "cinder-asteroid"],
    ships: [ship],
    revision: 0,
  };
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => ({
      sessionKey: "mars:phobos-yard",
      faction: "ussf",
      shipId: "duskbreaker",
    }),
    resolveUniversePatrol: async (_userId, pilotFaction) =>
      pilotFaction === "ussf" ? contact : null,
    reserveUniversePatrol: async (userIds, pilotFaction, reservation, encounterId) => {
      assert.deepEqual(userIds, ["combat-pilot"]);
      assert.equal(pilotFaction, "ussf");
      assert.equal(reservation.patrolId, contact.patrolId);
      assert.match(encounterId, /^[0-9a-f-]{36}$/i);
      return contact;
    },
    settleScoutEncounter: async (receipt) => {
      const result = readExplorationReceipt(receipt);
      return {
        status: "settled",
        awards: result.pilots.map((pilot) => ({
          ...pilot,
          balanceAfter: pilot.credits,
          revision: 1,
        })),
      };
    },
    freeFlightPatrolSpawnDistanceMeters: 30,
    snapshotIntervalMs: 50,
  });
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "combat-pilot");
  try {
    const initial = await join(socket);
    const target = initial.actors.find((actor) =>
      actor.actorId === `patrol-ship:${ship.id}`,
    );
    assert.ok(target, "the persistent fleet must be present in the shared-flight snapshot");
    const started = nextPacket(socket, (packet) =>
      packet.type === "freeflight_engagement_started");
    socket.send(JSON.stringify({ type: "freeflight_engage", targetActorId: target.actorId }));
    const engagement = await started;
    assert.equal(engagement.patrolId, contact.patrolId);

    let finished = false;
    const resultPromise = nextPacket(socket, (packet) =>
      packet.type === "freeflight_combat_result", 25_000).then((packet) => {
        finished = true;
        return packet;
      });
    let latestSnapshot = initial;
    let playerShotsFired = 0;
    let playerMissilesFired = 0;
    let playerWeaponHits = 0;
    const onDiagnostic = (data: Buffer) => {
      try {
        const packet = JSON.parse(data.toString()) as Packet;
        if (packet.type === "freeflight_weapon_fired" &&
            packet.sourceActorId === initial.ownActorId) {
          playerShotsFired += 1;
          if (packet.weaponId === "precision-seeker") playerMissilesFired += 1;
        } else if (packet.type === "freeflight_weapon_event") {
          if (packet.sourceActorId === initial.ownActorId &&
              packet.targetActorId === target.actorId) playerWeaponHits += 1;
        } else if (packet.type === "freeflight_snapshot") {
          latestSnapshot = packet.snapshot as typeof initial;
        }
      } catch { /* Ignore malformed test data. */ }
    };
    socket.on("message", onDiagnostic);
    let seq = 1;
    for (let index = 0; index < 400 && !finished; index += 1) {
      const player = latestSnapshot.actors.find((entry) =>
        entry.actorId === latestSnapshot.ownActorId,
      )!;
      const enemy = latestSnapshot.actors.find((entry) => entry.actorId === target.actorId)!;
      const dx = enemy.position.x - player.position.x;
      const dz = enemy.position.z - player.position.z;
      const desiredYaw = Math.atan2(-dx, -dz);
      const yawError = Math.atan2(
        Math.sin(desiredYaw - player.yaw),
        Math.cos(desiredYaw - player.yaw),
      );
      const accepted = nextPacket(socket, (packet) =>
        packet.type === "freeflight_input_accepted" && packet.seq === seq, 2_000);
      socket.send(JSON.stringify({
        type: "freeflight_input",
        input: input(seq, {
          yaw: Math.abs(yawError) > 0.04 ? Math.sign(yawError) : 0,
          fire: true,
          missile: true,
        }),
      }));
      await accepted;
      seq += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const result = await resultPromise;
    assert.equal(result.status, "settled");
    assert.ok(playerShotsFired > 0, "the server must create and broadcast real weapon projectiles");
    assert.ok(playerMissilesFired > 0, "the server must launch an acquired, server-owned missile");
    assert.ok(playerWeaponHits > 0, "the player's server-fired weapon must hit the patrol ship");
    assert.ok(Number(result.kills) >= 1);
    assert.ok(Number(result.creditsAwarded) > 0);
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

test("server anomaly gravity is enabled only after every connected client negotiates support", async () => {
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async (userId) => ({
      sessionKey: "mars:mars-orbit",
      faction: "ussf",
      shipId: "duskbreaker",
    }),
  });
  const url = `ws://127.0.0.1:${runtime.port}/ws?freeflight=1`;
  let modern: WebSocket | null = null;
  let legacy: WebSocket | null = null;
  try {
    modern = await connect(url, "gravity-modern");
    const firstJoin = nextPacket(modern, (packet) => packet.type === "freeflight_joined");
    modern.send(JSON.stringify({ type: "freeflight_join" }));
    const joined = await firstJoin;
    assert.ok(isFreeFlightEnvironmentV1(joined.environment));
    assert.equal((joined.environment as { enabled: boolean }).enabled, false);

    const enabledForModern = nextPacket(modern, (packet) =>
      packet.type === "freeflight_environment" &&
      isFreeFlightEnvironmentV1(packet.environment) &&
      packet.environment.enabled,
    );
    modern.send(JSON.stringify({ type: "freeflight_environment_request" }));
    const enabled = await enabledForModern;
    const expectedWell = anomalyGravityWellForSector("mars:mars-orbit");
    assert.ok(expectedWell);
    assert.deepEqual((enabled.environment as { gravityWells: unknown[] }).gravityWells, [expectedWell]);

    legacy = await connect(url, "gravity-legacy");
    const disabledForModern = nextPacket(modern, (packet) =>
      packet.type === "freeflight_environment" &&
      isFreeFlightEnvironmentV1(packet.environment) &&
      !packet.environment.enabled,
    );
    const secondJoin = nextPacket(legacy, (packet) => packet.type === "freeflight_joined");
    legacy.send(JSON.stringify({ type: "freeflight_join" }));
    const legacyJoined = await secondJoin;
    assert.ok(isFreeFlightEnvironmentV1(legacyJoined.environment));
    assert.equal((legacyJoined.environment as { enabled: boolean }).enabled, false);
    await disabledForModern;

    const restoredForModern = nextPacket(modern, (packet) =>
      packet.type === "freeflight_environment" &&
      isFreeFlightEnvironmentV1(packet.environment) &&
      packet.environment.enabled,
    );
    await close(legacy);
    legacy = null;
    await restoredForModern;
  } finally {
    if (legacy) await close(legacy);
    if (modern) await close(modern);
    await runtime.close();
  }
});
