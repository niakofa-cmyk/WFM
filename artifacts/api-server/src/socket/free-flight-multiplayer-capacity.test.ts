import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { FREE_FLIGHT_ASSIST_V1, FREE_FLIGHT_TARGETING_V1, FREE_FLIGHT_MAX_ENCOUNTER_PILOTS, isFreeFlightSnapshotV1, type FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import { ExplorationEncounter, readExplorationReceipt } from "../game/exploration-encounter";
import type { UniversePatrolEncounter } from "../game/universe-patrols";
import { createFreeFlightRuntime } from "./free-flight-runtime";
import { startWingSocketServer } from "./server";
import { authenticateTestSocket, createSocketTestAuth } from "./test-session-auth";

type Packet = Record<string, unknown>;
const fleet = (index: number): UniversePatrolEncounter => ({
  patrolId: `capacity-patrol-${index}`, locationId: "phobos-yard", faction: "ussf",
  callsign: `Capacity patrol ${index}`, route: ["phobos-yard"], revision: 0,
  ships: [{ id: `capacity-ship-${index}`, hullId: "duskbreaker", name: "Duskbreaker", callsign: `HOSTILE ${index}` }],
});
const controls = (seq: number, fire = false) => ({
  version: 5, seq, targetId: null, throttle: 0, yaw: 0, pitch: 0,
  strafe: 0, vertical: 0, roll: 0, fire, missile: false,
  boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false,
});
async function until(predicate: () => boolean, description: string) {
  const deadline = Date.now() + 8_000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
  assert.ok(predicate(), description);
}
function latest(packets: Packet[]): FreeFlightSnapshotV1 {
  const snapshot = packets.filter(p => isFreeFlightSnapshotV1(p.snapshot)).at(-1)?.snapshot;
  assert.ok(isFreeFlightSnapshotV1(snapshot), "expected a validated server snapshot");
  return snapshot;
}

test("ten authenticated WebSocket clients share the same ships, patrols and projectile event despite a dense fleet directory", async () => {
  const auth = createSocketTestAuth();
  const directory = Array.from({ length: 40 }, (_, i) => fleet(i));
  const runtime = await startWingSocketServer(0, "127.0.0.1", {
    verifySessionToken: auth.verifySessionToken,
    enableFreeFlight: true,
    resolveFreeFlightAdmission: async () => ({
      sessionKey: "mars:phobos-yard", faction: "accord", shipId: "mandjet",
    }),
    resolveUniversePatrols: async () => directory,
    tickIntervalMs: 10, snapshotIntervalMs: 20,
  });
  const clients: Array<{ socket: WebSocket; packets: Packet[] }> = [];
  try {
    for (let index = 0; index < 10; index++) {
      const socket = new WebSocket(`ws://127.0.0.1:${runtime.port}/ws?freeflight=1`);
      const packets: Packet[] = [];
      clients.push({ socket, packets });
      socket.on("message", data => packets.push(JSON.parse(String(data))));
      await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
      await authenticateTestSocket(socket, auth, `ten-device-pilot-${index}`);
      socket.send(JSON.stringify({ type: "freeflight_join" }));
      await until(() => packets.some(p => p.type === "freeflight_joined"), `pilot ${index} admitted`);
    }
    await until(() => clients.every(c =>
      latest(c.packets).actors.filter(a => a.kind === "pilot").length === 10),
    "every client sees all ten distinct human ships");
    const frames = clients.map(c => latest(c.packets));
    assert.equal(new Set(frames.map(f => f.sessionInstanceId)).size, 1);
    assert.equal(new Set(frames.map(f => f.ownActorId)).size, 10);
    const roster = (f: FreeFlightSnapshotV1) => f.actors.map(a => a.actorId).sort();
    for (const frame of frames) assert.deepEqual(roster(frame), roster(frames[0]!));
    let commonFrames: FreeFlightSnapshotV1[] = [];
    await until(() => {
      const snapshots = clients.map(c => c.packets.flatMap(p =>
        isFreeFlightSnapshotV1(p.snapshot) &&
        p.snapshot.actors.filter(a => a.kind === "pilot").length === 10 ? [p.snapshot] : []));
      const sharedTick = snapshots[0]!.find(f => snapshots.every(list => list.some(other => other.tick === f.tick)))?.tick;
      if (sharedTick === undefined) return false;
      commonFrames = snapshots.map(list => list.find(f => f.tick === sharedTick)!);
      return true;
    }, "all ten clients receive a snapshot of the same simulation tick");
    const physicalState = (f: FreeFlightSnapshotV1) => f.actors.map(a => ({
      id: a.actorId, position: a.position, orientation: a.orientation, hull: a.hull, shield: a.shield,
    })).sort((a, b) => a.id.localeCompare(b.id));
    for (const frame of commonFrames)
      assert.deepEqual(physicalState(frame), physicalState(commonFrames[0]!),
        "ships, fleet positions and damage are identical at the same authoritative tick");
    assert.ok(frames[0]!.actors.filter(a => a.kind === "patrol").length <= 20,
      "NPC traffic reserves room for ten humans and two allied defenders");
    const sourceActorId = frames[0]!.ownActorId;
    clients[0]!.socket.send(JSON.stringify({ type: "freeflight_input", input: controls(1, true) }));
    await until(() => clients.every(c => c.packets.some(p =>
      p.type === "freeflight_weapon_fired" && p.sourceActorId === sourceActorId)),
    "one authoritative shot is broadcast to all ten clients");
    const shotIds = clients.map(c => c.packets.find(p =>
      p.type === "freeflight_weapon_fired" && p.sourceActorId === sourceActorId)!.eventId);
    assert.equal(new Set(shotIds).size, 1, "not ten independent projectile simulations");
    const movingIds = frames.slice(0, 2).map(f => f.ownActorId);
    const before = movingIds.map(id => frames[0]!.actors.find(a => a.actorId === id)!);
    for (let seq = 2; seq <= 18; seq++) {
      for (const index of [0, 1]) clients[index]!.socket.send(JSON.stringify({
        type: "freeflight_input",
        input: { ...controls(seq), yaw: index === 0 ? .35 : -.35, strafe: .6, vertical: index === 0 ? .5 : -.5 },
      }));
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    await until(() => clients.every(c => movingIds.every((id, index) => {
      const actor = latest(c.packets).actors.find(a => a.actorId === id)!;
      return Math.abs(actor.position.y - before[index]!.position.y) > .1 &&
        Math.hypot(actor.position.x - before[index]!.position.x, actor.position.z - before[index]!.position.z) > .1;
    })), "all ten observers see both pilots' vertical/lateral translation");
    const movementSnapshots = clients.map(c => c.packets.flatMap(p =>
      isFreeFlightSnapshotV1(p.snapshot) && p.snapshot.tick > commonFrames[0]!.tick ? [p.snapshot] : []));
    const movementTick = movementSnapshots[0]!.slice().reverse().find(f =>
      movementSnapshots.every(list => list.some(other => other.tick === f.tick)))?.tick;
    assert.notEqual(movementTick, undefined);
    const sharedMovement = movementSnapshots.map(list => list.find(f => f.tick === movementTick)!);
    for (const frame of sharedMovement) assert.deepEqual(physicalState(frame), physicalState(sharedMovement[0]!),
      "maneuvering changes one authoritative pose, not a separate observer-relative flight");
    for (let index = 0; index < 2; index++) {
      const moved = sharedMovement[0]!.actors.find(a => a.actorId === movingIds[index])!;
      assert.notDeepEqual(moved.orientation, before[index]!.orientation, "yaw input changes actual attitude");
    }
  } finally {
    await Promise.all(clients.map(({ socket }) => new Promise<void>(resolve => {
      if (socket.readyState === WebSocket.CLOSED) return resolve();
      socket.once("close", () => resolve()); socket.close();
    })));
    await runtime.close();
  }
});

test("ten pilots including late arrivals join one reserved fleet encounter, never a private copy", async () => {
  const contact = fleet(1);
  let reservations = 0;
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "accord", shipId: "mandjet" }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => { reservations++; return contact; },
    settleScoutEncounter: async () => ({ status: "disabled" as const, awards: [] }),
    patrolSpawnDistanceMeters: 100,
  });
  const clients = Array.from({ length: 10 }, () => {
    const packets: Packet[] = [];
    return { packets, socket: {
      readyState: 1, bufferedAmount: 0,
      send: (value: string) => packets.push(JSON.parse(value)), close: () => {},
    } };
  });
  try {
    for (let index = 0; index < 10; index++) {
      const client = clients[index]!;
      await runtime.handle(client.socket, `battle-pilot-${index}`, { type: "freeflight_join" });
      await runtime.handle(client.socket, `battle-pilot-${index}`, {
        type: "freeflight_engage", targetActorId: "patrol-ship:capacity-ship-1",
      });
      assert.ok(client.packets.some(p => p.type === "freeflight_engagement_started"),
        `pilot ${index + 1} can join the same battle`);
    }
    assert.equal(reservations, 1);
    const encounters = clients.map(c => c.packets.find(p => p.type === "freeflight_engagement_started")!.encounterId);
    assert.equal(new Set(encounters).size, 1);
    for (let index = 0; index < 10; index++) {
      await runtime.handle(clients[index]!.socket, `battle-pilot-${index}`, {
        type: "freeflight_input", input: controls(1, true),
      });
    }
    runtime.advance(Date.now() + 34);
    for (const client of clients) {
      assert.equal(latest(client.packets).actors.filter(a => a.kind === "pilot").length, 10);
      assert.ok(!client.packets.some(p => p.reason === "freeflight_encounter_capacity"));
    }
  } finally { await runtime.close(); }
});

test("encounter attribution accepts the expanded late-join roster without inventing kills or rewards", () => {
  const battle = new ExplorationEncounter({
    encounterId: "ten-pilot-attribution", missionId: "universe-patrol", sectorId: "phobos-yard",
    runtime: "orbital-v5", authority: "server", mode: "universe-exploration",
    patrol: { patrolId: "capacity-patrol", locationId: "phobos-yard", faction: "ussf" },
    actors: [
      { id: "pilot-0", playerId: "user-0", faction: "accord", hull: 100 },
      { id: "hostile", faction: "ussf", hull: 100, rewardEligible: true },
    ],
    rewardPolicy: { id: "universe-patrol-bounty-v1", creditsPerNpcKill: 12, completionCredits: 0, maxCreditsPerEncounter: 48 },
  });
  for (let i = 1; i < FREE_FLIGHT_MAX_ENCOUNTER_PILOTS; i++)
    assert.ok(battle.addPilot({ id: `pilot-${i}`, playerId: `user-${i}`, faction: "accord", hull: 100 }, 1));
  assert.throws(() => battle.addPilot({ id: "overflow", playerId: "overflow", faction: "accord", hull: 100 }, 1), /roster/);
  battle.recordDamage({ eventId: "ninth-pilot-hit", tick: 2, attackerActorId: "pilot-9", targetActorId: "hostile", hullDamage: 100 });
  const receipt = readExplorationReceipt(battle.finalize(3, "completed", true));
  assert.equal(receipt.pilots.length, FREE_FLIGHT_MAX_ENCOUNTER_PILOTS);
  assert.equal(receipt.pilots.reduce((sum, p) => sum + p.kills, 0), 1);
  assert.equal(receipt.pilots.find(p => p.playerId === "user-9")?.credits, 12);
  assert.ok(receipt.pilots.filter(p => p.playerId !== "user-9").every(p => p.credits === 0));
});

test("two human pilots see identical friendly-AI hits while sharing two live fleet battles", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const contacts = [fleet(1), fleet(2)];
  let reservations = 0;
  const packets: Packet[] = [];
  let saved: import("./free-flight-runtime").FreeFlightSessionCheckpointV1 | undefined;
  const socket = {
    readyState: 1, bufferedAmount: 0,
    send: (value: string) => packets.push(JSON.parse(value)), close: () => {},
  };
  const wingPackets: Packet[] = [];
  const wingSocket = {
    readyState: 1, bufferedAmount: 0,
    send: (value: string) => wingPackets.push(JSON.parse(value)), close: () => {},
  };
  const runtime = createFreeFlightRuntime({
    enableFriendlyAiSupport: true,
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "accord", shipId: "mandjet" }),
    resolveUniversePatrols: async () => contacts,
    reserveUniversePatrol: async (_users, _faction, contact) => {
      reservations++;
      return contacts.find(p => p.patrolId === contact.patrolId) ?? null;
    },
    settleScoutEncounter: async () => ({ status: "disabled", awards: [] }),
    patrolSpawnDistanceMeters: 100,
    saveCheckpoint: async (_key, checkpoint) => { saved = checkpoint; return true; },
  });
  try {
    await runtime.handle(socket, "ai-assistance-pilot", { type: "freeflight_join" });
    await runtime.handle(socket, "ai-assistance-pilot", { type: "freeflight_engage", targetActorId: "patrol-ship:capacity-ship-1" });
    await runtime.handle(socket, "ai-assistance-pilot", { type: "freeflight_input", input: controls(1, true) });
    await runtime.handle(socket, "ai-assistance-pilot", { type: "freeflight_engage", targetActorId: "patrol-ship:capacity-ship-2" });
    assert.equal(new Set(packets.filter(p => p.type === "freeflight_engagement_started").map(p => p.encounterId)).size, 2);
    await runtime.handle(wingSocket, "ai-assistance-wing", { type: "freeflight_join" });
    await runtime.handle(wingSocket, "ai-assistance-wing", {
      type: "freeflight_engage", targetActorId: "patrol-ship:capacity-ship-1",
    });
    await runtime.handle(socket, "ai-assistance-pilot", {
      type: "freeflight_target_nearest", protocol: FREE_FLIGHT_TARGETING_V1, seq: 1,
    });
    now += 150;
    await runtime.handle(socket, "ai-assistance-pilot", {
      type: "freeflight_target_cycle", protocol: FREE_FLIGHT_TARGETING_V1, seq: 2,
    });
    const selected = packets.filter(p => p.type === "freeflight_target_state").at(-1)?.state as { targetActorId: string };
    assert.equal(selected.targetActorId, "patrol-ship:capacity-ship-2");
    await runtime.handle(socket, "ai-assistance-pilot", {
      type: "freeflight_assist_call", protocol: FREE_FLIGHT_ASSIST_V1,
    });
    const invite = wingPackets.find(p => p.type === "freeflight_assist_request");
    assert.ok(invite, "a pilot already helping one battle can receive a call for a second nearby battle");
    await runtime.handle(wingSocket, "ai-assistance-wing", {
      type: "freeflight_assist_response", protocol: FREE_FLIGHT_ASSIST_V1,
      callId: invite.callId, accept: true,
    });
    const battles = (received: Packet[]) => received.filter(p => p.type === "freeflight_engagement_started")
      .map(p => p.encounterId).sort();
    assert.deepEqual(battles(wingPackets), battles(packets), "late human ally joins both existing encounters");
    assert.equal(reservations, 2, "human assistance never reserves private copies of either fleet");
    for (let tick = 0; tick < 2400; tick++) {
      runtime.advance(now += 34);
      await new Promise<void>(resolve => setImmediate(resolve));
      if (packets.some(p => p.type === "freeflight_weapon_event" &&
          p.sourceActorId === "patrol:escort:accord:1" &&
          Number(p.shieldDamage) + Number(p.hullDamage) > 0)) break;
    }
    assert.ok(packets.some(p => p.type === "freeflight_weapon_fired" &&
      p.sourceActorId === "patrol:escort:accord:1"), "defender actually fires server-owned weapons");
    assert.ok(packets.some(p => p.type === "freeflight_weapon_event" &&
      p.sourceActorId === "patrol:escort:accord:1" &&
      Number(p.shieldDamage) + Number(p.hullDamage) > 0), "defender actually hits hostile ships");
    const leadHits = packets.filter(p => p.type === "freeflight_weapon_event" &&
      p.sourceActorId === "patrol:escort:accord:1");
    const wingHits = wingPackets.filter(p => p.type === "freeflight_weapon_event" &&
      p.sourceActorId === "patrol:escort:accord:1");
    assert.deepEqual(wingHits, leadHits, "both humans receive the same impact identity, coordinates and damage");
    assert.ok(leadHits.every(hit => String(hit.targetActorId).startsWith("patrol-ship:")),
      "friendly defender attacks enemy patrol ships, never its human allies");
    const leadFrame = latest(packets);
    const wingFrame = latest(wingPackets);
    assert.equal(leadFrame.sessionInstanceId, wingFrame.sessionInstanceId);
    assert.equal(leadFrame.tick, wingFrame.tick);
    for (const actor of leadFrame.actors) {
      const viewedByWing = wingFrame.actors.find(a => a.actorId === actor.actorId)!;
      assert.ok(viewedByWing);
      assert.deepEqual(viewedByWing.position, actor.position);
      assert.equal(viewedByWing.hull, actor.hull);
      assert.equal(viewedByWing.shield, actor.shield);
    }
    await runtime.close();
    assert.equal(saved?.combats.length, 2);
    assert.ok(saved?.combats.every(c => c.alliedNpcActorIds?.includes("patrol:escort:accord:1")),
      "the same bounded defender supports both encounter contracts");
    assert.ok(saved?.combats.every(c => c.participantActorIds.length === 2),
      "AI is never represented as another human or rewarded account");
  } finally { await runtime.close(); }
});
