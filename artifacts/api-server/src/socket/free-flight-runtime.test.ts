import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { WebSocket } from "ws";
import {
  anomalyGravityWellForSector,
  isFreeFlightEnvironmentV1,
  isFreeFlightSnapshotV1,
  rotate,
  type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import { readExplorationReceipt } from "../game/exploration-encounter";
import type { PersistentPatrolShip } from "@workspace/db";
import { startWingSocketServer } from "./server";
import { canDamageFreeFlightActor, createFreeFlightRuntime } from "./free-flight-runtime";
import type { UniversePatrolEncounter } from "../game/universe-patrols";
import { authenticateTestSocket, createSocketTestAuth } from "./test-session-auth";

type Packet = { type?: string; reason?: string; [key: string]: unknown };

test("shared countermeasures deflect only incoming seekers, enforce intent bounds and preserve cooldown on restart", async () => {
  let stored: import("./free-flight-runtime").FreeFlightSessionCheckpointV1 | undefined;
  const resolveAdmission = async (userId: string) => ({
    sessionKey: "mars:defense-test", faction: userId === "foe" ? "accord" as const : "ussf" as const,
    shipId: userId === "foe" ? "mandjet" as const : "glide" as const,
  });
  const saveCheckpoint = async (_key: string, state: import("./free-flight-runtime").FreeFlightSessionCheckpointV1) => {
    stored = structuredClone(state); return true;
  };
  const packets: Packet[] = [];
  const socket = { readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data)), close: () => {} };
  const other = { ...socket, send: () => {} };
  const original = createFreeFlightRuntime({ resolveAdmission, saveCheckpoint });
  await original.handle(socket, "pilot", { type: "freeflight_join" });
  await original.handle(other, "foe", { type: "freeflight_join" });
  await original.close();
  const pilot = stored!.actors.find(a => a.ownerUserId === "pilot")!;
  const foe = stored!.actors.find(a => a.ownerUserId === "foe")!;
  const base = { x: 100, y: 0, z: 0, vx: -20, vy: 0, vz: 0,
    life: 10, dmg: 8, r: .3, homeId: pilot.numericId, missile: true,
    sourceActorId: foe.actorId, faction: "accord" as const };
  stored!.projectiles = [
    { ...base, id: 1, countermeasureClass: "standard" },
    { ...base, id: 2, countermeasureClass: "hardened" },
    { ...base, id: 3, faction: "ussf", countermeasureClass: "standard" },
    { ...base, id: 4, homeId: foe.numericId, countermeasureClass: "standard" },
  ];
  stored!.nextProjectileId = 5;
  const makeRuntime = () => createFreeFlightRuntime({ resolveAdmission, saveCheckpoint,
    loadCheckpoint: async () => ({ stateVersion: 1, fencingToken: 1,
      checkpointSequence: stored!.checkpointSequence,
      snapshot: structuredClone(stored!) as unknown as Record<string, unknown> }) });
  let runtime = makeRuntime();
  try {
    await runtime.handle(socket, "pilot", { type: "freeflight_join" });
    const admission = [...packets].reverse().find(p => p.type === "freeflight_joined")!;
    assert.equal((admission.countermeasures as { protocol: number }).protocol, 1);
    await runtime.handle(socket, "pilot", { type: "freeflight_countermeasure", protocol: 1, seq: 1, hull: 999 });
    assert.equal(packets.at(-1)?.reason, "invalid_freeflight_countermeasure");
    await runtime.handle(socket, "pilot", { type: "freeflight_countermeasure", protocol: 1, seq: 1 });
    const defense = packets.at(-1)!;
    assert.equal(defense.activated, true);
    assert.equal(defense.decoyed, 1);
    assert.equal(defense.disrupted, 1);
    assert.equal(defense.cooldownMs, 3500);
    await runtime.handle(socket, "pilot", { type: "freeflight_countermeasure", protocol: 1, seq: 1 });
    assert.equal(packets.at(-1)?.reason, "invalid_freeflight_countermeasure");
    await runtime.close();
    assert.equal(stored!.projectiles[0]!.homeId, null);
    assert.equal(stored!.projectiles[1]!.homeId, pilot.numericId);
    assert.ok(stored!.projectiles[1]!.guidanceSuppressed! > 0);
    assert.equal(stored!.projectiles[2]!.homeId, pilot.numericId);
    assert.equal(stored!.projectiles[3]!.homeId, foe.numericId);
    runtime = makeRuntime();
    await runtime.handle(socket, "pilot", { type: "freeflight_join" });
    const joined = [...packets].reverse().find(p => p.type === "freeflight_joined")!;
    assert.equal((joined.countermeasures as { cooldownMs: number }).cooldownMs, 3500);
    await runtime.handle(socket, "pilot", { type: "freeflight_countermeasure", protocol: 1, seq: 2 });
    assert.equal(packets.at(-1)?.reason, "freeflight_rate_limited");
  } finally { await runtime.close(); }
});

const auth = createSocketTestAuth();

test("damaged refits expose the retained hull and location without repairing or replacing the pilot", async () => {
  let checkpoint: import("./free-flight-runtime").FreeFlightSessionCheckpointV1 | null = null;
  let admission = { sessionKey: "mars:phobos-yard", faction: "ussf" as const,
    shipId: "duskbreaker" as "duskbreaker" | "bastion" };
  const packets: Packet[] = [];
  const socket = { readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data)), close: () => {} };
  const makeRuntime = () => createFreeFlightRuntime({
    resolveAdmission: async () => admission,
    saveCheckpoint: async (_key, state) => { checkpoint = structuredClone(state); return true; },
    loadCheckpoint: async () => checkpoint ? { stateVersion: 1, fencingToken: 1,
      checkpointSequence: checkpoint.checkpointSequence,
      snapshot: structuredClone(checkpoint) as unknown as Record<string, unknown> } : null,
  });
  const initial = makeRuntime();
  await initial.handle(socket, "refit-pilot", { type: "freeflight_join" });
  await initial.close();
  // Unit fixture: an already damaged durable deployment, not a live health edit.
  const saved = checkpoint! as import("./free-flight-runtime").FreeFlightSessionCheckpointV1;
  const pilot = saved.actors.find(a => a.ownerUserId === "refit-pilot")!;
  pilot.craft.hull -= 5;
  const retainedHull = pilot.craft.hull, retainedId = pilot.actorId;
  admission = { ...admission, shipId: "bastion" };
  packets.length = 0;
  const runtime = makeRuntime();
  try {
    await runtime.handle(socket, "refit-pilot", { type: "freeflight_join" });
    assert.equal(packets.at(-1)?.reason, "freeflight_recovery_required");
    assert.deepEqual(packets.at(-1)?.recovery, { protocol: 1, mode: "loadout",
      shipId: "duskbreaker", faction: "ussf", alive: true, locationKey: "mars:phobos-yard" });
    assert.equal(packets.some(p => p.type === "freeflight_joined"), false);
    admission = { ...admission, shipId: "duskbreaker" };
    await runtime.handle(socket, "refit-pilot", { type: "freeflight_join" });
    const joined = packets.find(p => p.type === "freeflight_joined")!;
    const frame = joined.snapshot as FreeFlightSnapshotV1;
    const own = frame.actors.find(a => a.own)!;
    assert.equal(own.actorId, retainedId);
    assert.equal(own.hull, retainedHull);
    assert.equal(own.alive, true);
    runtime.detach(socket);
    admission = { ...admission, sessionKey: "mars:rust-disc" };
    await runtime.handle({ ...socket }, "refit-pilot", { type: "freeflight_join" });
    assert.deepEqual(packets.at(-1)?.recovery, { protocol: 1, mode: "location",
      shipId: "duskbreaker", faction: "ussf", alive: true, locationKey: "mars:phobos-yard" });
  } finally { await runtime.close(); }
});

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

test("server-advertised directional bursts enforce sequence, cooldown and fixed intent while firing", async () => {
  const packets: Packet[] = [];
  const socket = { readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data) as Packet), close: () => {} };
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:vector-test", faction: "ussf", shipId: "glide" }),
    resolveUniversePatrols: async () => [],
  });
  try {
    await runtime.handle(socket, "vector-pilot", { type: "freeflight_join" });
    const joined = packets.find(packet => packet.type === "freeflight_joined")!;
    const offer = joined.vectorBoost as { protocol: string; nextSeq: number };
    assert.equal(offer.protocol, "orbital-vector-boost-v1");
    assert.equal(offer.nextSeq, 1);
    await runtime.handle(socket, "vector-pilot", { type: "freeflight_input", input: input(1, { fire: true }) });
    const request = { type: "freeflight_vector_boost", protocol: offer.protocol, seq: 1, direction: "up-right" };
    await runtime.handle(socket, "vector-pilot", request);
    let states = packets.filter(packet => packet.type === "freeflight_vector_boost_state");
    assert.equal(states.at(-1)!.accepted, true);
    assert.equal(states.at(-1)!.remainingMs, 240);
    await runtime.handle(socket, "vector-pilot", request);
    assert.equal(packets.at(-1)!.reason, "invalid_freeflight_vector_boost");
    await runtime.handle(socket, "vector-pilot", { ...request, seq: 2 });
    states = packets.filter(packet => packet.type === "freeflight_vector_boost_state");
    assert.equal(states.at(-1)!.accepted, false, "a new sequence does not bypass cooldown");
    await runtime.handle(socket, "vector-pilot", { ...request, seq: 3, durationMs: 99999 });
    assert.equal(packets.at(-1)!.reason, "invalid_freeflight_vector_boost");
    await runtime.handle(socket, "vector-pilot", { ...request, seq: 3, direction: "teleport" });
    assert.equal(packets.at(-1)!.reason, "invalid_freeflight_vector_boost");
    const now = Date.now();
    for (let i = 1; i <= 12; i++) runtime.advance(now + i * 34);
    assert.ok(packets.some(packet => packet.type === "freeflight_weapon_fired"), "firing remains usable during the burst");
    const snap = packets.filter(packet => packet.type === "freeflight_snapshot").at(-1)?.snapshot as {
      actors: Array<{ own: boolean; position: { x: number; y: number; z: number } }>;
    };
    const original = (joined.snapshot as typeof snap).actors.find(actor => actor.own)!;
    const moved = snap.actors.find(actor => actor.own)!;
    assert.ok(Math.hypot(moved.position.x - original.position.x,
      moved.position.y - original.position.y, moved.position.z - original.position.z) > .1);
  } finally { await runtime.close(); }
});

test("two nearby pilots damage one target and settle one kill plus an assist", async (t) => {
  const { createFreeFlightRuntime } = await import("./free-flight-runtime");
  let clock = Date.now(), reservations = 0, settlements = 0;
  let stored: import("./free-flight-runtime").StoredFreeFlightCheckpoint | null = null;
  // Input windows and AI reaction timers must observe the same clock as flight.
  // Otherwise this accelerated duel rate-limits both pilots after 35 packets.
  t.mock.method(Date, "now", () => clock);
  const contact: UniversePatrolEncounter = {
    patrolId: "assist-settle-patrol001", locationId: "phobos-yard", faction: "ussf",
    callsign: "Shared target", route: ["phobos-yard"], revision: 0,
    ships: [{ id: "assist-settle-ship001", hullId: "duskbreaker", name: "Duskbreaker", callsign: "TARGET" }],
  };
  const packets: Packet[][] = [[], []];
  const frames: Array<FreeFlightSnapshotV1 | undefined> = [];
  const sockets = packets.map((received, index) => ({
    readyState: 1, bufferedAmount: 0,
    send: (data: string) => {
      const packet = JSON.parse(data) as Packet;
      received.push(packet);
      if (isFreeFlightSnapshotV1(packet.snapshot)) frames[index] = packet.snapshot;
    },
    close: () => {},
  }));
  const runtime = createFreeFlightRuntime({
    saveCheckpoint: async (_key, snapshot, fencingToken, checkpointSequence) => {
      stored = { stateVersion: 1, snapshot, fencingToken, checkpointSequence };
      return true;
    },
    resolveAdmission: async () => ({
      sessionKey: "mars:phobos-yard", faction: "accord", shipId: "mandjet",
    }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => { reservations++; return contact; },
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async receipt => {
      settlements++;
      const result = readExplorationReceipt(receipt);
      return { status: "settled", awards: result.pilots.map(pilot => ({
        ...pilot, balanceAfter: pilot.credits, revision: 1,
      })) };
    },
  });
  runtime.setFencingToken("mars:phobos-yard", 1);
  try {
    await runtime.handle(sockets[0]!, "shared-lead", { type: "freeflight_join", openingEncounter: true });
    await new Promise<void>(resolve => setImmediate(resolve));
    await runtime.handle(sockets[1]!, "shared-ally", { type: "freeflight_join", openingEncounter: true });
    await runtime.handle(sockets[1]!, "shared-ally", {
      type: "freeflight_engage", targetActorId: "patrol-ship:assist-settle-ship001",
    });
    assert.ok(packets[1]!.some(p => p.type === "freeflight_engagement_started" && p.assistance === true));
    assert.equal(reservations, 1, "assistance reuses the existing fleet reservation");
    const bounded = (value: number) => Math.max(-1, Math.min(1, value));
    for (let seq = 1; seq <= 1800 && settlements === 0; seq++) {
      clock += 34;
      for (let index = 0; index < 2; index++) {
        const frame = frames[index]!;
        const own = frame.actors.find(actor => actor.actorId === frame.ownActorId)!;
        const target = frame.actors.find(actor => actor.kind === "patrol" && actor.alive && actor.faction !== own.faction);
        if (!target || !own.alive) continue;
        const dx = target.position.x - own.position.x, dy = target.position.y - own.position.y;
        const dz = target.position.z - own.position.z;
        const q = own.orientation;
        const local = rotate([-q.x, -q.y, -q.z, q.w], dx, dy, dz);
        await runtime.handle(sockets[index]!, index === 0 ? "shared-lead" : "shared-ally", {
          type: "freeflight_input",
          input: input(seq, {
            fire: true, missile: true, yaw: bounded(Math.atan2(-local.x, -local.z) * 4),
            pitch: bounded(Math.atan2(local.y, Math.hypot(local.x, local.z)) * 4),
          }),
        });
      }
      runtime.advance(clock);
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    assert.equal(settlements, 1, "one encounter produces one settlement");
    const recoveryEvents = packets.flatMap(received => received.filter(p =>
      p.type === "freeflight_combat_progress" && p.reason === "kill"));
    assert.equal(recoveryEvents.length, 1, "one actual destruction grants one energy recovery, not an assist or per-observer bonus");
    assert.equal(recoveryEvents[0]!.kills, 1);
    assert.equal(recoveryEvents[0]!.streak, 1);
    assert.ok(Number(recoveryEvents[0]!.energy) <= 100);
    const results = packets.map(received => received.find(p => p.type === "freeflight_combat_result"));
    assert.ok(results.every(Boolean));
    assert.equal(results.reduce((sum,p) => sum+Number(p!.kills),0),1);
    assert.equal(results.reduce((sum,p) => sum+Number(p!.assists),0),1);
    assert.ok(results.every(p => p!.status === "settled"));
    assert.ok(Number(results.find(p => Number(p!.kills) === 1)?.creditsAwarded) > 0);
    for (const result of results) assert.deepEqual(result!.totals, {
      kills: result!.kills, assists: result!.assists, creditsAwarded: result!.creditsAwarded,
    }, "each pilot receives its authoritative cumulative tally, not another pilot's reward");
    // Preserve the current kill-only credit policy: an assist is a real tally,
    // not permission to mint an additional kill or unconfigured reward.
    assert.equal(Number(results.find(p => Number(p!.assists) === 1)?.creditsAwarded), 0);
    for (let index = 0; index < 2; index++) {
      assert.ok(packets[index]!.some(p => p.type === "freeflight_weapon_event" &&
        p.sourceActorId === frames[index]!.ownActorId &&
        Number(p.shieldDamage)+Number(p.hullDamage)>0), "each pilot causes real server damage");
      assert.ok(frames[index]!.actors.find(a => a.own)?.alive, "each pilot survives settlement");
    }
    const lethal = packets[0]!.filter(p => p.type === "freeflight_weapon_event" && p.destroyed === true);
    assert.equal(lethal.length, 1, "one destroyed ship emits exactly one explosion-driving contact");
    assert.deepEqual(packets[1]!.filter(p => p.type === "freeflight_weapon_event" && p.destroyed === true),
      lethal, "both pilots receive the identical destruction identity and contact coordinates");
    for (const packet of packets[0]!.filter(p => p.type === "freeflight_weapon_event")) {
      const point = packet.to as { x: number; y: number; z: number };
      assert.ok([point.x, point.y, point.z].every(Number.isFinite));
      assert.ok(Number(packet.shieldDamage) + Number(packet.hullDamage) > 0);
    }
    const beforeFlight = frames.map(frame => frame!.actors.find(a => a.own)!);
    // Open the next real input window on the same mocked authority clock.
    clock += 1100;
    const sequences = packets.map(received => Number(
      received.filter(p => p.type === "freeflight_input_accepted").at(-1)!.seq,
    ) + 1);
    for (let index = 0; index < 2; index++) {
      await runtime.handle(sockets[index]!,
        index === 0 ? "shared-lead" : "shared-ally", {
          type: "freeflight_input", input: input(sequences[index]!, { throttle: 1 }),
        });
      assert.ok(packets[index]!.some(p => p.type === "freeflight_input_accepted" &&
        p.seq === sequences[index]));
    }
    for (let step = 0; step < 45; step++) {
      runtime.advance(clock += 34);
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    for (let index = 0; index < 2; index++) {
      const after = frames[index]!.actors.find(a => a.own)!;
      const before = beforeFlight[index]!;
      assert.equal(after.actorId, before.actorId, "victory keeps the same universe pilot");
      assert.equal(after.alive, true);
      assert.ok(Math.hypot(after.position.x - before.position.x,
        after.position.y - before.position.y, after.position.z - before.position.z) > .5,
      "both pilots actually fly after settlement, rather than only receiving an input acknowledgment");
    }
    assert.equal(settlements,1, "later ticks cannot duplicate settlement");
    const recoveryCount = packets.flatMap(received => received.filter(p =>
      p.type === "freeflight_combat_progress" && p.reason === "kill")).length;
    assert.equal(recoveryCount, 1, "continued flight cannot repeat a destruction reward");
    await runtime.close();
    assert.ok(stored, "combat progress is part of the durable session checkpoint");
    const killerIndex = packets.findIndex(received => received.some(p =>
      p.type === "freeflight_combat_progress" && p.reason === "kill"));
    const resumedPackets: Packet[] = [];
    const diagnostics: unknown[] = [];
    const resumed = createFreeFlightRuntime({
      onAdmissionFailure: diagnostic => diagnostics.push(diagnostic),
      resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "accord", shipId: "mandjet" }),
      loadCheckpoint: async () => stored,
      saveCheckpoint: async () => true,
    });
    resumed.setFencingToken("mars:phobos-yard", 2);
    try {
      await resumed.handle({
        readyState: 1, bufferedAmount: 0, close: () => {},
        send: value => resumedPackets.push(JSON.parse(value)),
      }, killerIndex === 0 ? "shared-lead" : "shared-ally", { type: "freeflight_join" });
      const state = resumedPackets.filter(p => p.type === "freeflight_combat_progress").at(-1)!;
      assert.ok(state, `checkpoint rejoin must publish progress: ${JSON.stringify(diagnostics)}`);
      assert.equal(state.kills, 1);
      assert.equal(state.streak, 1);
      assert.equal(state.reason, "sync");
      assert.equal(state.restored, 0, "restore returns the saved resource, not another kill reward");
      assert.equal(resumedPackets.some(p => p.reason === "kill"), false);
    } finally { await resumed.close(); }
  } finally { await runtime.close(); }
});

test("a nearby late ally automatically joins the existing battle without another reservation", async () => {
  const contact: UniversePatrolEncounter = {
    patrolId: "assist-patrol-0001", locationId: "phobos-yard", faction: "accord",
    callsign: "Shared intercept", route: ["phobos-yard"], revision: 0,
    ships: [{ id: "assist-ship-0001", hullId: "mandjet", name: "Mandjet", callsign: "INTERCEPT ONE" }],
  };
  const leadPackets: Packet[] = [];
  const allyPackets: Packet[] = [];
  const socketFor = (packets: Packet[]) => ({
    readyState: 1, bufferedAmount: 0,
    send: (data: string) => { packets.push(JSON.parse(data) as Packet); },
    close: () => {},
  });
  const lead = socketFor(leadPackets);
  const ally = socketFor(allyPackets);
  let reservations = 0;
  let travelledUser: string | null = null;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async (userId) => ({
      sessionKey: userId === travelledUser ? "mars:other-location" : "mars:phobos-yard",
      faction: "ussf", shipId: "glide",
    }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => { reservations++; return contact; },
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async () => { throw new Error("test does not complete the fleet"); },
    patrolSpawnDistanceMeters: 30,
  });
  try {
    await runtime.handle(lead, "assist-lead", { type: "freeflight_join" });
    await runtime.handle(lead, "assist-lead", {
      type: "freeflight_engage", targetActorId: "patrol-ship:assist-ship-0001",
    });
    await runtime.handle(ally, "assist-ally", { type: "freeflight_join" });
    const snapshot = allyPackets.find((p) => p.type === "freeflight_joined")?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(snapshot));
    let clock = Date.now();
    runtime.advance(clock += 100);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(allyPackets.some((p) => p.type === "freeflight_engagement_started" &&
      p.assistance === true));
    assert.ok(leadPackets.some((p) => p.type === "freeflight_ally_joined" && p.participantCount === 2));
    assert.equal(reservations, 1);
    await runtime.handle(ally, "assist-ally", {
      type: "freeflight_engage", targetActorId: "patrol-ship:assist-ship-0001",
    });
    assert.equal(leadPackets.filter((p) => p.type === "freeflight_ally_joined").length, 1);
    await runtime.handle(ally, "assist-ally", { type: "freeflight_input", input: input(1, { fire: true }) });
    runtime.advance(clock += 100);
    assert.ok(allyPackets.some((p) => p.type === "freeflight_weapon_fired" &&
      p.sourceActorId === snapshot.ownActorId), "late ally can emit real server weapons");
    const travellerPackets: Packet[] = [];
    const traveller = socketFor(travellerPackets);
    await runtime.handle(traveller, "assist-traveller", { type: "freeflight_join" });
    travelledUser = "assist-traveller";
    await runtime.handle(traveller, "assist-traveller", {
      type: "freeflight_engage", targetActorId: "patrol-ship:assist-ship-0001",
    });
    assert.ok(travellerPackets.some((p) => p.reason === "freeflight_location_changed"));
    await runtime.handle(traveller, "assist-traveller", {
      type: "freeflight_input", input: input(1, { fire: true }),
    });
    assert.ok(travellerPackets.some((p) => p.reason === "freeflight_location_changed"));
    assert.equal(reservations, 1, "a stale location cannot reserve or join the previous fleet");
    assert.equal(travellerPackets.some((p) => p.type === "freeflight_engagement_started"), false);
    assert.equal(leadPackets.filter((p) => p.type === "freeflight_ally_joined").length, 1);
  } finally {
    await runtime.close();
  }
});

test("primary fire can initiate a server-owned patrol encounter across the streamed flight range", async () => {
  const packets: Packet[] = [];
  const socketFor = (target: Packet[] = packets) => ({
    readyState: 1, bufferedAmount: 0,
    send: (data: string) => { target.push(JSON.parse(data) as Packet); },
    close: () => {},
  });
  const contact: UniversePatrolEncounter = {
    patrolId: "long-range-patrol-0001", locationId: "phobos-yard", faction: "accord",
    callsign: "Long-range patrol", route: ["phobos-yard"], revision: 0,
    ships: [{ id: "long-range-ship-0001", hullId: "mandjet", name: "Mandjet", callsign: "SCOUT ONE" }],
  };
  let reserved = 0;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "duskbreaker",
    }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => { reserved++; return contact; },
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async () => { throw new Error("test does not complete the fleet"); },
    patrolSpawnDistanceMeters: 2_000,
  });
  const observers = [socketFor([]), socketFor([])];
  const pilot = socketFor();
  try {
    await runtime.handle(observers[0]!, "range-observer-1", { type: "freeflight_join" });
    await runtime.handle(observers[1]!, "range-observer-2", { type: "freeflight_join" });
    await runtime.handle(pilot, "range-pilot", { type: "freeflight_join" });
    const snapshot = packets.find((packet) => packet.type === "freeflight_joined")?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(snapshot));
    const own = snapshot.actors.find((actor) => actor.own)!;
    const target = snapshot.actors.find((actor) => actor.kind === "patrol")!;
    const distance = Math.hypot(
      target.position.x - own.position.x,
      target.position.y - own.position.y,
      target.position.z - own.position.z,
    );
    assert.ok(distance > 1_900, `expected a distant patrol, got ${distance.toFixed(1)}m`);

    await runtime.handle(pilot, "range-pilot", {
      type: "freeflight_input", input: input(1, { fire: true }),
    });
    assert.ok(packets.some((packet) => packet.type === "freeflight_engagement_started" &&
      packet.patrolId === contact.patrolId), "aimed primary fire must request the server encounter");
    assert.equal(reserved, 1, "only the server reservation grants combat authority");

    runtime.advance(Date.now() + 100);
    const shot = packets.find((packet) => packet.type === "freeflight_weapon_fired" &&
      packet.sourceActorId === own.actorId);
    assert.ok(shot, "the server must emit a real projectile");
    const velocity = shot.velocity as { x: number; y: number; z: number };
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    assert.ok(Number(shot.lifetimeSeconds) * speed >= distance,
      "the projectile must remain alive long enough to traverse the streamed range");
  } finally {
    await runtime.close();
  }
});

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

test("server patrol scouts pursue sensed pilots without granting unreserved combat authority", async () => {
  const packets: Packet[] = [];
  const socket = {
    readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data) as Packet),
    close: () => {},
  };
  const contact: UniversePatrolEncounter = {
    patrolId: "search-patrol-0001", locationId: "phobos-yard", faction: "accord",
    callsign: "Scout patrol", route: ["phobos-yard"], revision: 0,
    ships: [{ id: "search-ship-0001", hullId: "mandjet", name: "Mandjet", callsign: "SCOUT ONE" }],
  };
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "glide" }),
    resolveUniversePatrols: async () => [contact],
    patrolSpawnDistanceMeters: 320,
  });
  try {
    await runtime.handle(socket, "scout-target", { type: "freeflight_join" });
    const initial = packets.find((packet) => packet.type === "freeflight_joined")?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(initial));
    const distance = (snapshot: typeof initial) => {
      const own = snapshot.actors.find((actor) => actor.own)!;
      const enemy = snapshot.actors.find((actor) => actor.kind === "patrol")!;
      return Math.hypot(enemy.position.x - own.position.x,
        enemy.position.y - own.position.y, enemy.position.z - own.position.z);
    };
    let clock = Date.now();
    for (let i = 0; i < 200; i++) runtime.advance(clock += 100);
    const last = packets.filter((packet) => packet.type === "freeflight_snapshot").at(-1)?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(last));
    assert.ok(last.actors.some((actor) => actor.callsign.endsWith(" - PURSUIT")));
    assert.ok(distance(last) < distance(initial) - 30, "scout must physically close, not just change its label");
    assert.equal(packets.some((packet) => packet.type === "freeflight_weapon_fired"), false);
    assert.equal(packets.some((packet) => packet.type === "freeflight_combat_result"), false);
  } finally {
    await runtime.close();
  }
});

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
    assert.equal(remote.callsign, "ACCORD HUMAN PILOT");
    for (const actor of shared.actors) {
      assert.equal(Object.hasOwn(actor, "userId"), false);
      assert.equal(Object.hasOwn(actor, "playerId"), false);
    }
  } finally {
    await Promise.all(sockets.map(close));
    await runtime.close();
  }
});

test("the first free-flight snapshot contains persistent local patrols from both factions", async () => {
  const patrol = (
    faction: "ussf" | "accord",
    patrolId: string,
    shipId: string,
    hullId: "duskbreaker" | "mandjet",
  ): UniversePatrolEncounter => ({
    patrolId,
    locationId: "phobos-yard",
    faction,
    callsign: `${faction.toUpperCase()} LOCAL GUARD`,
    route: ["phobos-yard", "phobos-yard"],
    revision: 0,
    ships: [{
      id: shipId,
      hullId,
      name: hullId,
      callsign: `${faction.toUpperCase()} GUARD ONE`,
    }],
  });
  const persistentPatrols = [
    patrol("ussf", "ussf-local-garrison", "ussf-garrison-ship", "duskbreaker"),
    patrol("accord", "accord-local-garrison", "accord-garrison-ship", "mandjet"),
  ];
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => ({
      sessionKey: "mars:phobos-yard",
      faction: "ussf",
      shipId: "duskbreaker",
    }),
    freeFlightCombat: {
      resolveFreeFlightPatrols: async () => persistentPatrols,
      reserveUniversePatrol: async () => null,
      releaseUniversePatrol: async () => {},
      settleScoutEncounter: async () => ({ status: "disabled", awards: [] }),
    },
    snapshotIntervalMs: 50,
  });
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "garrison-pilot");
  try {
    const snapshot = await join(socket);
    const localGuards = snapshot.actors.filter((actor) =>
      actor.kind === "patrol" &&
      ["ussf-garrison-ship", "accord-garrison-ship"].some((id) =>
        actor.actorId === `patrol-ship:${id}`));
    assert.deepEqual(localGuards.map((actor) => actor.faction).sort(), ["accord", "ussf"]);
    assert.deepEqual(localGuards.map((actor) => actor.callsign).sort(),
      ["ACCORD GUARD ONE - PATROL", "USSF GUARD ONE - PATROL"]);
  } finally {
    await close(socket);
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

    const firingAccepted = nextPacket(socket, (packet) =>
      packet.type === "freeflight_input_accepted" && packet.seq === 2);
    socket.send(JSON.stringify({ type: "freeflight_input", input: input(2, { fire: true }) }));
    assert.equal((await firingAccepted).fire, true, "primary fire is allowed in open free flight");
    const spatialError = nextPacket(socket, (packet) => packet.type === "error");
    socket.send(JSON.stringify({
      type: "freeflight_input",
      input: { ...input(3), position: { x: 1e9, y: 0, z: 0 } },
    }));
    assert.equal((await spatialError).reason, "freeflight_invalid_packet");
  } finally {
    await close(socket);
    await runtime.close();
  }
});

test("damage requires opposing actors in the same active reserved encounter", () => {
  const pilot = { kind: "pilot" as const, actorId: "pilot-a", faction: "ussf" as const };
  const patrol = { kind: "patrol" as const, actorId: "patrol-a", faction: "accord" as const };
  const opposingPilot = { kind: "pilot" as const, actorId: "pilot-b", faction: "accord" as const };
  const combat = { phase: "active" as const, participantActorIds: new Set(["pilot-a"]) };
  assert.equal(canDamageFreeFlightActor(pilot, patrol, combat), true);
  assert.equal(canDamageFreeFlightActor(patrol, pilot, combat), true);
  assert.equal(canDamageFreeFlightActor({ ...pilot, actorId: "bystander" }, patrol, combat), false);
  assert.equal(canDamageFreeFlightActor(patrol, { ...pilot, actorId: "bystander" }, combat), false);
  assert.equal(canDamageFreeFlightActor(pilot, { ...patrol, faction: "ussf" }, combat), false);
  assert.equal(canDamageFreeFlightActor(pilot, patrol, { ...combat, phase: "complete" }), false);
  assert.equal(canDamageFreeFlightActor(pilot, patrol, undefined), false);
  assert.equal(canDamageFreeFlightActor(pilot, opposingPilot, undefined,
    { actorIds: new Set(["pilot-a", "pilot-b"]) }), true);
  assert.equal(canDamageFreeFlightActor(pilot, opposingPilot, undefined,
    { actorIds: new Set(["pilot-a", "other-pilot"]) }), false);
  assert.equal(canDamageFreeFlightActor(pilot, { ...pilot, faction: "accord" }, combat), false);
});

test("population telemetry counts only connected pilots and emits no account or location identifiers", async () => {
  const packets: Packet[][] = [[], []];
  const sockets = packets.map(received => ({
    readyState: 1, bufferedAmount: 0,
    send: (data: string) => received.push(JSON.parse(data)),
    close: () => {},
  }));
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async userId => ({
      sessionKey: "mars:telemetry-private-location",
      faction: userId === "telemetry-accord-user" ? "accord" : "ussf",
      shipId: userId === "telemetry-accord-user" ? "mandjet" : "glide",
    }),
    resolveUniversePatrols: async () => [],
  });
  try {
    await runtime.handle(sockets[0]!, "telemetry-ussf-user", { type: "freeflight_join" });
    await runtime.handle(sockets[1]!, "telemetry-accord-user", { type: "freeflight_join" });
    const metrics = runtime.populationTelemetry;
    assert.equal(metrics.scope, "single-owner-process");
    assert.equal(metrics.sessionCount, 1);
    assert.equal(metrics.activePilotCount, 2);
    assert.deepEqual(metrics.activePilotsByFaction, { ussf: 1, accord: 1 });
    assert.deepEqual(runtime.activePopulationSeats
      .map(({ userId, faction }) => ({ userId, faction }))
      .sort((left, right) => left.userId.localeCompare(right.userId)), [
      { userId: "telemetry-accord-user", faction: "accord" },
      { userId: "telemetry-ussf-user", faction: "ussf" },
    ]);
    const serialized = JSON.stringify(metrics);
    assert.equal(serialized.includes("telemetry-ussf-user"), false);
    assert.equal(serialized.includes("telemetry-accord-user"), false);
    assert.equal(serialized.includes("telemetry-private-location"), false);
    runtime.detach(sockets[1]!);
    assert.equal(runtime.populationTelemetry.activePilotCount, 1);
    assert.deepEqual(runtime.activePopulationSeats.map((seat) => seat.userId), [
      "telemetry-ussf-user",
    ]);
  } finally {
    await runtime.close();
  }
});

test("a disconnected pilot cannot start combat after a delayed patrol reservation", async () => {
  const contact: UniversePatrolEncounter = {
    patrolId: "delayed-patrol-0001", locationId: "phobos-yard", faction: "accord",
    callsign: "Delayed Flight", route: ["phobos-yard", "cinder-asteroid"],
    ships: [{ id: "delayed-ship-0001", hullId: "shakuna", name: "Hunter", callsign: "Hunter" }],
    revision: 0,
  };
  let finishReservation!: (value: UniversePatrolEncounter) => void;
  const reservation = new Promise<UniversePatrolEncounter>((resolve) => { finishReservation = resolve; });
  const released: string[] = [];
  const packets: Packet[] = [];
  const socket = {
    readyState: WebSocket.OPEN, bufferedAmount: 0,
    send: (data: string) => { packets.push(JSON.parse(data) as Packet); },
    close: () => {},
  };
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "duskbreaker",
    }),
    resolveUniversePatrols: async (_id, faction) => faction === "ussf" ? [contact] : [],
    reserveUniversePatrol: async () => reservation,
    releaseUniversePatrol: async (patrolId) => { released.push(patrolId); },
    settleScoutEncounter: async () => { throw new Error("must not settle disconnected engagement"); },
    patrolSpawnDistanceMeters: 30,
  });
  try {
    await runtime.handle(socket, "delayed-pilot", { type: "freeflight_join" });
    const engagement = runtime.handle(socket, "delayed-pilot", {
      type: "freeflight_engage", targetActorId: "patrol-ship:delayed-ship-0001",
    });
    runtime.detach(socket);
    finishReservation(contact);
    await engagement;
    assert.deepEqual(released, [contact.patrolId]);
    assert.equal(packets.some((packet) => packet.type === "freeflight_engagement_started"), false);
  } finally {
    await runtime.close();
  }
});

test("a changed reserved fleet roster fails closed instead of creating ghost targets", async () => {
  const contact: UniversePatrolEncounter = {
    patrolId: "changed-patrol-0001", locationId: "phobos-yard", faction: "accord",
    callsign: "Changed Flight", route: ["phobos-yard", "cinder-asteroid"],
    ships: [{ id: "changed-ship-0001", hullId: "shakuna", name: "Hunter", callsign: "Hunter" }],
    revision: 0,
  };
  const packets: Packet[] = [];
  const released: string[] = [];
  const socket = {
    readyState: WebSocket.OPEN, bufferedAmount: 0,
    send: (data: string) => { packets.push(JSON.parse(data) as Packet); },
    close: () => {},
  };
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "duskbreaker",
    }),
    resolveUniversePatrols: async (_id, faction) => faction === "ussf" ? [contact] : [],
    reserveUniversePatrol: async () => ({
      ...contact, revision: 1, ships: [{ ...contact.ships[0], id: "changed-ship-0002" }],
    }),
    releaseUniversePatrol: async (patrolId) => { released.push(patrolId); },
    settleScoutEncounter: async () => { throw new Error("must not settle a mismatched roster"); },
    patrolSpawnDistanceMeters: 30,
  });
  try {
    await runtime.handle(socket, "roster-pilot", { type: "freeflight_join" });
    await runtime.handle(socket, "roster-pilot", {
      type: "freeflight_engage", targetActorId: "patrol-ship:changed-ship-0001",
    });
    assert.deepEqual(released, [contact.patrolId]);
    assert.ok(packets.some((packet) => packet.reason === "freeflight_patrol_roster_changed"));
    assert.equal(packets.some((packet) => packet.type === "freeflight_engagement_started"), false);
  } finally {
    await runtime.close();
  }
});

test("rejected secondary claims refresh departed ships and reconnect restores existing combat authority", async () => {
  const contact = {
    patrolId: "refresh-test-patrol-0001", locationId: "phobos-yard",
    faction: "accord" as const, callsign: "First Fleet",
    route: ["phobos-yard", "cinder-asteroid"], revision: 0,
    ships: [{
      id: "refresh-test-ship-0001", hullId: "shakuna" as const,
      name: "Hunter", callsign: "First",
    }],
  };
  const second = {
    ...contact, patrolId: "refresh-test-patrol-0002", callsign: "Departing Fleet",
    ships: [{ ...contact.ships[0], id: "refresh-test-ship-0002" }],
  };
  let departed = false;
  const packets: Packet[] = [];
  const makeSocket = () => ({
    readyState: WebSocket.OPEN, bufferedAmount: 0,
    send: (data: string) => { packets.push(JSON.parse(data) as Packet); },
    close: () => {},
  });
  const socket = makeSocket();
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({
      sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "duskbreaker",
    }),
    resolveUniversePatrols: async (_id, faction) =>
      faction === "ussf" ? departed ? [contact] : [contact, second] : [],
    reserveUniversePatrol: async (_ids, _faction, requested) =>
      requested.patrolId === contact.patrolId ? contact : null,
    settleScoutEncounter: async () => { throw new Error("must not settle an unfinished fleet"); },
    patrolSpawnDistanceMeters: 30,
  });
  try {
    await runtime.handle(socket, "refresh-pilot", { type: "freeflight_join" });
    await runtime.handle(socket, "refresh-pilot", {
      type: "freeflight_engage", targetActorId: "patrol-ship:refresh-test-ship-0001",
    });
    assert.ok(packets.some((packet) => packet.type === "freeflight_engagement_started"));
    departed = true;
    await runtime.handle(socket, "refresh-pilot", {
      type: "freeflight_input", input: input(1, { fire: true }),
    });
    await runtime.handle(socket, "refresh-pilot", {
      type: "freeflight_engage", targetActorId: "patrol-ship:refresh-test-ship-0002",
    });
    assert.ok(packets.some((packet) => packet.reason === "freeflight_patrol_departed"));
    const state = packets.filter((packet) => packet.type === "freeflight_engagement_state").at(-1)!;
    assert.equal(state.phase, "active");
    assert.equal(state.activeEncounterCount, 1);
    const snapshot = packets.filter((packet) => packet.type === "freeflight_snapshot").at(-1)!.snapshot as {
      actors: { actorId: string }[];
    };
    assert.ok(snapshot.actors.some((actor: { actorId: string }) =>
      actor.actorId === "patrol-ship:refresh-test-ship-0001"));
    assert.equal(snapshot.actors.some((actor: { actorId: string }) =>
      actor.actorId === "patrol-ship:refresh-test-ship-0002"), false);
    runtime.detach(socket);
    const reconnected = makeSocket();
    packets.length = 0;
    await runtime.handle(reconnected, "refresh-pilot", { type: "freeflight_join" });
    const restored = packets.find((packet) => packet.type === "freeflight_engagement_state")!;
    assert.equal(restored.phase, "active");
    assert.equal(restored.activeEncounterCount, 1);
    assert.equal(restored.kills, 0);
    assert.equal(restored.creditsAwarded, 0);
    assert.equal(packets.some((packet) => packet.type === "freeflight_engagement_started"), false);
  } finally {
    await runtime.close();
  }
});

test("disabled recovery preserves attribution, survives reconnect/expiry, and requires settled results", async () => {
  const contact: UniversePatrolEncounter = {
    patrolId: "disabled-patrol-0001", locationId: "phobos-yard", faction: "accord",
    callsign: "Interceptors", route: ["phobos-yard", "cinder-asteroid"], revision: 0,
    ships: Array.from({ length: 4 }, (_, i) => ({
      id: `disabled-ship-000${i}`, hullId: "shakuna" as const,
      name: "Interceptor", callsign: `Interceptor ${i}`,
    })),
  };
  const packets: Packet[] = [];
  const socket = {
    readyState: WebSocket.OPEN, bufferedAmount: 0,
    send: (data: string) => { packets.push(JSON.parse(data) as Packet); },
    close: () => {},
  };
  let admission = {
    sessionKey: "mars:phobos-yard", faction: "ussf" as const, shipId: "glide" as "glide" | "duskbreaker",
  };
  let finishSettlement: (() => void) | undefined;
  let settlements = 0;
  let recoveryCheckpoint: import("./free-flight-runtime").FreeFlightSessionCheckpointV1 | undefined;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => admission,
    saveCheckpoint: async (_key, state) => {
      recoveryCheckpoint = structuredClone(state);
      return true;
    },
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => contact,
    releaseUniversePatrol: async () => {},
    settleScoutEncounter: async (receipt) => {
      settlements++;
      const result = readExplorationReceipt(receipt);
      assert.equal(result.outcome, "aborted");
      assert.equal(result.objectiveCompleted, false);
      assert.ok(result.pilots.every((pilot) => pilot.credits === 0));
      await new Promise<void>((resolve) => { finishSettlement = resolve; });
      return { status: "settled", awards: [] };
    },
    patrolSpawnDistanceMeters: 30,
  });
  const latestOwn = () => {
    const snapshot = [...packets].reverse().find((p) => p.type === "freeflight_snapshot" ||
      p.type === "freeflight_joined")?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(snapshot));
    const actor = snapshot.actors.find((a) => a.actorId === snapshot.ownActorId);
    assert.ok(actor);
    return actor;
  };
  try {
    await runtime.handle(socket, "disabled-pilot", { type: "freeflight_join" });
    const ownId = latestOwn().actorId;
    await runtime.handle(socket, "disabled-pilot", { type: "freeflight_recover" });
    assert.equal(packets.at(-1)?.reason, "freeflight_recovery_not_disabled");
    await runtime.handle(socket, "disabled-pilot", { type: "freeflight_recover", hull: 100 });
    assert.equal(packets.at(-1)?.reason, "invalid_freeflight_recovery");
    await runtime.handle(socket, "disabled-pilot", {
      type: "freeflight_engage", targetActorId: `patrol-ship:${contact.ships[0].id}`,
    });
    await runtime.handle(socket, "disabled-pilot", {
      type: "freeflight_input", input: input(1, { fire: true }),
    });
    let clock = Date.now();
    runtime.advance(clock += 100);
    assert.ok(packets.some((p) => p.type === "freeflight_weapon_fired" &&
      p.sourceActorId === ownId), "a living participant emits primary shots");
    await runtime.handle(socket, "disabled-pilot", {
      type: "freeflight_input", input: input(2),
    });
    for (let i = 0; i < 3_000 && latestOwn().alive; i++) runtime.advance(clock += 40);
    assert.equal(latestOwn().alive, false, "ordinary hostile fire disables the idle pilot");
    const before = packets.length;
    for (const values of [{ fire: true }, { missile: true }]) {
      await runtime.handle(socket, "disabled-pilot", {
        type: "freeflight_input", input: input(3, values),
      });
    }
    assert.equal(packets.slice(before).filter((p) =>
      p.reason === "freeflight_pilot_destroyed").length, 2);
    assert.equal(packets.slice(before).some((p) => p.type === "freeflight_input_accepted"), false);
    await runtime.handle(socket, "disabled-pilot", { type: "freeflight_recover" });
    assert.equal(packets.at(-1)?.reason, "freeflight_recovery_pending_settlement");
    assert.equal(packets.some((p) => p.type === "freeflight_recovered"), false);
    runtime.detach(socket);
    runtime.advance(clock += 90_000); // Neither grace expiry nor empty-session TTL repairs death.
    const replacement = { ...socket };
    admission = { ...admission, shipId: "duskbreaker" };
    await runtime.handle(replacement, "disabled-pilot", { type: "freeflight_join" });
    assert.equal(latestOwn().actorId, ownId);
    assert.equal(latestOwn().alive, false);
    assert.equal(latestOwn().shipId, "glide", "new loadout must not reconstruct a destroyed craft");
    assert.equal([...packets].reverse().find((p) => p.type === "freeflight_engagement_state")?.pilotAlive, false);
    assert.ok(finishSettlement, "ordinary defeat reaches authoritative settlement");
    finishSettlement();
    await new Promise<void>((resolve) => setImmediate(resolve));
    admission = { ...admission, sessionKey: "mars:rust-disc" };
    await runtime.handle(replacement, "disabled-pilot", { type: "freeflight_recover" });
    assert.equal(packets.at(-1)?.reason, "freeflight_recovery_location_changed");
    admission = { ...admission, sessionKey: "mars:phobos-yard" };
    await runtime.handle(replacement, "disabled-pilot", { type: "freeflight_recover" });
    assert.ok(packets.some((p) => p.type === "freeflight_recovered"));
    assert.equal(settlements, 1, "recovery never settles or rewards the encounter again");
    const redeployed = { ...socket };
    await runtime.handle(redeployed, "disabled-pilot", { type: "freeflight_join" });
    assert.notEqual(latestOwn().actorId, ownId);
    assert.equal(latestOwn().alive, true);
    assert.equal(latestOwn().shipId, "duskbreaker");
    assert.ok(Math.abs(latestOwn().position.x) <= 28, "normal server anchor, not the old battle pose");
    await runtime.handle(redeployed, "disabled-pilot", { type: "freeflight_recover" });
    assert.equal(packets.at(-1)?.reason, "freeflight_recovery_not_disabled");
    await runtime.close();
    assert.ok(recoveryCheckpoint, "ordinary recovery writes a restart checkpoint");
    const historical = recoveryCheckpoint.combats.find((combat) =>
      combat.phase === "complete" && combat.participantActorIds.includes(ownId));
    assert.ok(historical, "keep the completed encounter and its original participant identity");
    assert.equal(historical.resultsApplied, true);
    assert.equal(recoveryCheckpoint.actors.some((actor) => actor.actorId === ownId), false,
      "normal recovery retires the old destroyed actor");
    const beforeRestart = packets.length;
    let roundTrip: import("./free-flight-runtime").FreeFlightSessionCheckpointV1 | undefined;
    const restored = createFreeFlightRuntime({
      resolveAdmission: async () => admission,
      resolveUniversePatrols: async () => [],
      loadCheckpoint: async () => ({
        stateVersion: 1, fencingToken: 1,
        checkpointSequence: recoveryCheckpoint!.checkpointSequence,
        snapshot: JSON.parse(JSON.stringify(recoveryCheckpoint!)) as Record<string, unknown>,
      }),
      saveCheckpoint: async (_key, state) => { roundTrip = structuredClone(state); return true; },
      settleScoutEncounter: async () => {
        assert.fail("completed encounter must never settle again during restore");
      },
    });
    try {
      await restored.handle({ ...socket }, "disabled-pilot", { type: "freeflight_join" });
      assert.ok(packets.slice(beforeRestart).some((packet) => packet.type === "freeflight_joined"),
        "restart must accept a checkpoint produced by normal settled recovery");
      assert.equal(latestOwn().alive, true);
      assert.notEqual(latestOwn().actorId, ownId);
      assert.equal(settlements, 1);
    } finally {
      await restored.close();
    }
    const roundTripHistory = roundTrip?.combats.find((combat) => combat.id === historical.id);
    assert.ok(roundTripHistory);
    assert.deepEqual(roundTripHistory.contract, historical.contract,
      "receipt fingerprint, damage, kills and assists survive restart unchanged");
    assert.deepEqual(roundTripHistory.participantActorIds, historical.participantActorIds);
    assert.equal(roundTripHistory.resultsApplied, true);
    assert.equal(roundTrip?.actors.some((actor) => actor.actorId === ownId), false);
    assert.ok(roundTrip);
    const restoredOwn = latestOwn();
    const repeatedStart = packets.length;
    const restoredAgain = createFreeFlightRuntime({
      resolveAdmission: async () => admission,
      resolveUniversePatrols: async () => [],
      loadCheckpoint: async () => ({
        stateVersion: 1, fencingToken: 2,
        checkpointSequence: roundTrip!.checkpointSequence,
        snapshot: JSON.parse(JSON.stringify(roundTrip!)) as Record<string, unknown>,
      }),
      settleScoutEncounter: async () => {
        assert.fail("a second serialized restore must not replay a completed settlement");
      },
    });
    try {
      await restoredAgain.handle({ ...socket }, "disabled-pilot", { type: "freeflight_join" });
      assert.ok(packets.slice(repeatedStart).some(packet => packet.type === "freeflight_joined"));
      const repeatedOwn = latestOwn();
      assert.equal(repeatedOwn.actorId, restoredOwn.actorId,
        "repeated restore preserves the recovered actor rather than respawning it");
      assert.equal(repeatedOwn.hull, restoredOwn.hull);
      assert.equal(repeatedOwn.shield, restoredOwn.shield);
      assert.equal(repeatedOwn.alive, true);
      assert.equal(settlements, 1);
    } finally {
      await restoredAgain.close();
    }

    // Deliberately malformed fixture variants may not turn history into active
    // authority, bypass pending settlement or award an already completed result.
    for (const mutation of ["active", "settlement-unavailable", "unapplied",
      "missing-receipt", "duplicate-participant", "bad-fingerprint"] as const) {
      const invalid = structuredClone(recoveryCheckpoint);
      const combat = invalid.combats.find((value) => value.id === historical.id)!;
      if (mutation === "active" || mutation === "settlement-unavailable") {
        combat.phase = mutation;
        combat.resultsApplied = false;
      } else if (mutation === "unapplied") combat.resultsApplied = false;
      else if (mutation === "missing-receipt") {
        delete combat.contract.finalization;
        delete combat.contract.resultFingerprint;
      } else if (mutation === "duplicate-participant") {
        combat.participantActorIds.push(combat.participantActorIds[0]);
      } else combat.contract.resultFingerprint = "0".repeat(64);
      const rejectedPackets: Packet[] = [];
      const rejectRuntime = createFreeFlightRuntime({
        resolveAdmission: async () => admission,
        resolveUniversePatrols: async () => [],
        loadCheckpoint: async () => ({
          stateVersion: 1, fencingToken: 1,
          checkpointSequence: invalid.checkpointSequence,
          snapshot: invalid as unknown as Record<string, unknown>,
        }),
        onAdmissionFailure: () => {},
        settleScoutEncounter: async () => {
          assert.fail("invalid historical state must never reach settlement");
        },
      });
      try {
        await rejectRuntime.handle({ ...socket,
          send: (data) => rejectedPackets.push(JSON.parse(data)),
        }, "disabled-pilot", { type: "freeflight_join" });
        assert.deepEqual(rejectedPackets,
          [{ type: "error", reason: "freeflight_admission_unavailable" }], mutation);
      } finally {
        await rejectRuntime.close();
      }
    }
  } finally {
    await runtime.close();
  }
});

test("shared-flight patrol combat settles independently of the co-op V1 rollback protocol", async () => {
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
  const secondContact = {
    ...contact,
    patrolId: "persistent-test-patrol-0002",
    callsign: "Vesper Reinforcements",
    ships: [{ ...ship, id: "persistent-test-ship-0002", callsign: "Vesper Two" }],
  };
  const reservedPatrolIds: string[] = [];
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => ({
      sessionKey: "mars:phobos-yard",
      faction: "ussf",
      shipId: "duskbreaker",
    }),
    sectorProtocolVersion: 1,
    freeFlightCombat: {
      resolveFreeFlightPatrols: async () => [contact, secondContact],
      reserveUniversePatrol: async (userIds, pilotFaction, reservation, encounterId) => {
        assert.deepEqual(userIds, ["combat-pilot"]);
        assert.equal(pilotFaction, "ussf");
        assert.match(encounterId, /^[0-9a-f-]{36}$/i);
        const reserved = [contact, secondContact].find(
          (candidate) => candidate.patrolId === reservation.patrolId,
        );
        assert.ok(reserved, "each persistent fleet must be reserved by its own identity");
        reservedPatrolIds.push(reserved.patrolId);
        return reserved;
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
      releaseUniversePatrol: async () => {},
    },
    freeFlightPatrolSpawnDistanceMeters: 30,
    snapshotIntervalMs: 50,
  });
  const socket = await connect(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`, "combat-pilot");
  try {
    const started = nextPacket(socket, (packet) =>
      packet.type === "freeflight_engagement_started");
    const initial = await join(socket);
    const target = initial.actors.find((actor) =>
      actor.actorId === `patrol-ship:${ship.id}`,
    );
    assert.ok(target, "the persistent fleet must be present in the shared-flight snapshot");
    const engagement = await started;
    assert.equal(engagement.patrolId, contact.patrolId);
    await new Promise((resolve) => setTimeout(resolve, 900));
    assert.deepEqual(reservedPatrolIds, [contact.patrolId],
      "an untouched patrol must not treat its uninitialized damage timestamp as a hostile signal");
    const reinforcementStarted = nextPacket(socket, (packet) =>
      packet.type === "freeflight_engagement_started" &&
      packet.patrolId === secondContact.patrolId, 10_000);

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
      const dy = enemy.position.y - player.position.y;
      const dz = enemy.position.z - player.position.z;
      const q = player.orientation as FreeFlightSnapshotV1["actors"][number]["orientation"];
      const local = rotate([-q.x, -q.y, -q.z, q.w], dx, dy, dz);
      const yawError = Math.atan2(-local.x, -local.z);
      const pitchError = Math.atan2(local.y, Math.hypot(local.x, local.z));
      const accepted = nextPacket(socket, (packet) =>
        packet.type === "freeflight_input_accepted" && packet.seq === seq, 2_000);
      socket.send(JSON.stringify({
        type: "freeflight_input",
        input: input(seq, {
          yaw: Math.max(-1, Math.min(1, yawError * 4)),
          pitch: Math.max(-1, Math.min(1, pitchError * 4)),
          fire: true,
          missile: true,
        }),
      }));
      await accepted;
      seq += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const result = await resultPromise;
    const reinforcement = await reinforcementStarted;
    assert.equal(reinforcement.reinforcement, true);
    assert.equal(reinforcement.patrolId, secondContact.patrolId);
    assert.equal(result.status, "settled");
    assert.equal(result.phase, "active", "the remaining fleet must keep the pilot in combat");
    assert.ok(playerShotsFired > 0, "the server must create and broadcast real weapon projectiles");
    assert.ok(playerMissilesFired > 0, "the server must launch an acquired, server-owned missile");
    assert.ok(playerWeaponHits > 0, "the player's server-fired weapon must hit the patrol ship");
    assert.ok(Number(result.kills) >= 1);
    assert.ok(Number(result.creditsAwarded) > 0);
    const acceptedAfterResult = nextPacket(socket, (packet) =>
      packet.type === "freeflight_input_accepted" && packet.seq === seq);
    socket.send(JSON.stringify({ type: "freeflight_input", input: input(seq, { fire: true }) }));
    await acceptedAfterResult;
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
