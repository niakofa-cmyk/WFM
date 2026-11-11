import assert from "node:assert/strict";
import test from "node:test";
import { isFreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type StoredFreeFlightCheckpoint } from "./free-flight-runtime";
import type { UniversePatrolEncounter } from "../game/universe-patrols";

type Packet = Record<string, unknown>;
function socketFor(packets: Packet[]) {
  return { readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data) as Packet), close: () => {} };
}
function patrol(faction: "ussf" | "accord"): UniversePatrolEncounter {
  return {
    patrolId: `opening-patrol-${faction}`, locationId: "phobos-yard", faction,
    callsign: "ENTRY PATROL", route: ["phobos-yard"], revision: 0,
    ships: [{ id: `opening-ship-${faction}`, hullId: faction === "ussf" ? "glide" : "mandjet",
      name: "Opening contact", callsign: "ENTRY ONE" }],
  };
}

test("friendly defender automatically joins, flies and lands real weapon hits without becoming a human", async () => {
  const contact = patrol("accord");
  const packets: Packet[] = [];
  const socket = socketFor(packets);
  const runtime = createFreeFlightRuntime({
    enableFriendlyAiSupport: true,
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => contact,
    settleScoutEncounter: async () => { throw new Error("No live reward store in this unit test"); },
    releaseUniversePatrol: async () => {},
  });
  try {
    await runtime.handle(socket, "defender-pilot", { type: "freeflight_join", openingEncounter: true });
    let now = Date.now();
    for (let tick = 0; tick < 1200; tick++) runtime.advance(now += 34);
    const snapshotPacket = [...packets].reverse().find(packet => isFreeFlightSnapshotV1(packet.snapshot));
    assert.ok(isFreeFlightSnapshotV1(snapshotPacket?.snapshot));
    const escort = snapshotPacket.snapshot.actors.find(actor => actor.actorId === "patrol:escort:ussf:1");
    assert.ok(escort, "one visible server-owned friendly AI ship was deployed");
    assert.equal(escort.kind, "patrol");
    assert.equal(escort.faction, "ussf");
    assert.ok(packets.some(packet => packet.type === "freeflight_weapon_fired" &&
      packet.sourceActorId === escort.actorId), "AI uses the real weapon path");
    assert.ok(packets.some(packet => packet.type === "freeflight_weapon_event" &&
      packet.sourceActorId === escort.actorId && Number(packet.hullDamage) > 0),
    "AI bullets physically contact and damage the hostile ship");
    assert.ok(packets.some(packet => packet.type === "freeflight_weapon_event" &&
      packet.sourceActorId === escort.actorId && packet.destroyed === true),
    "AI can destroy a hostile through weapons, not by changing its hull directly");
    assert.equal(snapshotPacket.snapshot.actors.filter(actor => actor.kind === "pilot").length, 1);
  } finally { await runtime.close(); }
});

test("AI defender membership survives checkpoint restart without duplicate or repaired defenders", async () => {
  const contact = patrol("accord");
  let stored: StoredFreeFlightCheckpoint | null = null;
  const options: Parameters<typeof createFreeFlightRuntime>[0] = {
    enableFriendlyAiSupport: true,
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "sentinel" }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => contact,
    settleScoutEncounter: async () => { throw new Error("No live reward store in this unit test"); },
    releaseUniversePatrol: async () => {},
    loadCheckpoint: async () => stored,
    saveCheckpoint: async (_key, snapshot, fencingToken, checkpointSequence) => {
      stored = { stateVersion: 1, fencingToken, checkpointSequence,
        snapshot: JSON.parse(JSON.stringify(snapshot)) };
      return true;
    },
  };
  const packets: Packet[] = [];
  const first = createFreeFlightRuntime(options);
  await first.handle(socketFor(packets), "restored-defender-pilot", { type: "freeflight_join", openingEncounter: true });
  first.advance(Date.now() + 200);
  await first.close();
  assert.ok(stored);
  const second = createFreeFlightRuntime(options);
  const recovered: Packet[] = [];
  try {
    await second.handle(socketFor(recovered), "restored-defender-pilot", { type: "freeflight_join" });
    const joined = recovered.find(packet => packet.type === "freeflight_joined");
    assert.ok(isFreeFlightSnapshotV1(joined?.snapshot));
    const defenders = joined.snapshot.actors.filter(actor => actor.actorId.startsWith("patrol:escort:"));
    assert.equal(defenders.length, 1);
    const before = [...packets].reverse().find(packet => isFreeFlightSnapshotV1(packet.snapshot))?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(before));
    assert.equal(defenders[0]?.hull, before.actors.find(actor => actor.actorId === defenders[0]?.actorId)?.hull);
    second.advance(Date.now() + 200);
    const after = [...recovered].reverse().find(packet => isFreeFlightSnapshotV1(packet.snapshot))?.snapshot;
    assert.ok(isFreeFlightSnapshotV1(after));
    assert.equal(after.actors.filter(actor => actor.actorId.startsWith("patrol:escort:")).length, 1);
  } finally { await second.close(); }
});

test("the one global campaign ending stops live flight and refuses new joins instead of spawning a private game", async () => {
  const packets: Packet[] = [];
  const socket = socketFor(packets);
  let concluded = false;
  const runtime = createFreeFlightRuntime({
    campaignState: async () => ({concluded}),
    resolveAdmission: async () => ({sessionKey:"mars:phobos-yard",faction:"ussf",shipId:"sentinel"}),
  });
  try {
    await runtime.handle(socket,"campaign-live-pilot",{type:"freeflight_join"});
    assert.ok(packets.some(packet => packet.type === "freeflight_joined"));
    concluded = true;
    await runtime.handle(socket,"campaign-live-pilot",{type:"freeflight_input", input:{
      version:5,seq:1,targetId:null,throttle:1,yaw:0,pitch:0,strafe:0,vertical:0,roll:0,
      fire:true,missile:false,boost:false,brake:false,inertial:false,aimAssist:false,countermeasure:false,
    }});
    assert.ok(packets.some(packet => packet.type === "error" && packet.reason === "global_campaign_complete"));
    runtime.advance(Date.now()+100);
    assert.equal(packets.filter(packet => packet.type === "freeflight_weapon_fired").length,0);
    const newcomer: Packet[] = [];
    await runtime.handle(socketFor(newcomer),"campaign-new-pilot",{type:"freeflight_join"});
    assert.ok(newcomer.some(packet => packet.type === "error" && packet.reason === "global_campaign_complete"));
    assert.equal(newcomer.some(packet => packet.type === "freeflight_joined"),false);
  } finally { await runtime.close(); }
});

for (const faction of ["ussf", "accord"] as const) {
  test(`${faction} opening inserts a visible hostile ahead and reserves one real battle; reconnect preserves it`, async () => {
    const contact = patrol(faction === "ussf" ? "accord" : "ussf");
    const packets: Packet[] = [];
    const socket = socketFor(packets);
    let claims = 0;
    const runtime = createFreeFlightRuntime({
      enableFriendlyAiSupport: true,
      resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction,
        shipId: faction === "ussf" ? "glide" : "mandjet" }),
      resolveUniversePatrols: async () => [contact],
      reserveUniversePatrol: async () => { claims++; return contact; },
      settleScoutEncounter: async () => { throw new Error("No result expected in this test"); },
    });
    try {
      await runtime.handle(socket, "opening-pilot", { type: "freeflight_join", openingEncounter: true });
      const joined = packets.find((p) => p.type === "freeflight_joined");
      assert.equal(joined?.openingEncounter, "ready");
      const snapshot = joined?.snapshot;
      assert.ok(isFreeFlightSnapshotV1(snapshot));
      const own = snapshot.actors.find((a) => a.own)!;
      const enemy = snapshot.actors.find((a) => a.kind === "patrol" && a.faction !== faction)!;
      const dx = enemy.position.x - own.position.x;
      const dz = enemy.position.z - own.position.z;
      const distance = Math.hypot(dx, dz);
      assert.ok(distance >= 140 && distance <= 160, `opening distance ${distance}`);
      assert.ok((-Math.sin(own.yaw) * dx - Math.cos(own.yaw) * dz) / distance > 0.99);
      assert.equal(claims, 1);
      assert.ok(packets.some((p) => p.type === "freeflight_engagement_started"));
      await runtime.handle(socket, "opening-pilot", {
        type: "freeflight_input",
        input: { version: 5, seq: 1, targetId: null, throttle: 0, yaw: 0, pitch: 0,
          strafe: 0, vertical: 0, roll: 0, fire: true, missile: false,
          boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false },
      });
      runtime.advance(Date.now() + 100);
      assert.ok(packets.some((p) => p.type === "freeflight_weapon_fired" &&
        p.sourceActorId === snapshot.ownActorId), "opening pilot can emit real server-owned shots");
      const supportSnapshot = [...packets].reverse().find((packet) =>
        isFreeFlightSnapshotV1(packet.snapshot) &&
        packet.snapshot.actors.some((actor) => actor.actorId === `patrol:escort:${faction}:1`));
      assert.ok(isFreeFlightSnapshotV1(supportSnapshot?.snapshot));
      const support = supportSnapshot.snapshot.actors.find((actor) =>
        actor.actorId === `patrol:escort:${faction}:1`)!;
      assert.equal(support.faction, faction,
        "the local encounter's allied AI is always on the participating pilots' faction");
      const reconnectPackets: Packet[] = [];
      await runtime.handle(socketFor(reconnectPackets), "opening-pilot",
        { type: "freeflight_join", openingEncounter: true });
      const rejoined = reconnectPackets.find((p) => p.type === "freeflight_joined");
      assert.equal(rejoined?.openingEncounter, "resumed");
      assert.ok(isFreeFlightSnapshotV1(rejoined?.snapshot));
      assert.equal(rejoined.snapshot.ownActorId, snapshot.ownActorId);
      assert.deepEqual(rejoined.snapshot.actors.find((a) => a.own)?.position, own.position);
      assert.equal(claims, 1);
      assert.ok(reconnectPackets.some((p) => p.type === "freeflight_engagement_state"));
    } finally { await runtime.close(); }
  });
}

test("no persistent target keeps free flight honest; client pose and false opening flag are rejected", async () => {
  const packets: Packet[] = [];
  const socket = socketFor(packets);
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "glide" }),
  });
  try {
    await runtime.handle(socket, "opening-pilot", {
      type: "freeflight_join", openingEncounter: true, x: 999,
    });
    assert.equal(packets.at(-1)?.reason, "invalid_freeflight_join");
    await runtime.handle(socket, "opening-pilot", { type: "freeflight_join", openingEncounter: false });
    assert.equal(packets.at(-1)?.reason, "invalid_freeflight_join");
    await runtime.handle(socket, "opening-pilot", { type: "freeflight_join", openingEncounter: true });
    assert.equal(packets.find((p) => p.type === "freeflight_joined")?.openingEncounter, "unavailable");
    assert.equal(packets.some((p) => p.type === "freeflight_engagement_started"), false);
  } finally { await runtime.close(); }
});

test("reservation failure cannot create battle authority or reset the strategic roster", async () => {
  const packets: Packet[] = [];
  const contact = patrol("accord");
  const socket = socketFor(packets);
  const runtime = createFreeFlightRuntime({
    resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf", shipId: "glide" }),
    resolveUniversePatrols: async () => [contact],
    reserveUniversePatrol: async () => null,
    settleScoutEncounter: async () => { throw new Error("Must never settle an unreserved fleet"); },
  });
  try {
    await runtime.handle(socket, "opening-pilot", { type: "freeflight_join", openingEncounter: true });
    assert.ok(packets.some((p) => p.type === "freeflight_joined"));
    assert.equal(packets.some((p) => p.type === "freeflight_engagement_started"), false);
    assert.ok(packets.some((p) => p.type === "error"));
    assert.equal(socket.readyState, 1);
  } finally { await runtime.close(); }
});

for (const firstLookup of ["empty", "unavailable"] as const) {
  test(`a later admission loads durable patrols after an ${firstLookup} directory without sample enemies or pilot resets`, async () => {
    const firstPackets: Packet[] = [];
    const nextPackets: Packet[] = [];
    const contact = patrol("ussf");
    let available = false;
    let claims = 0;
    const runtime = createFreeFlightRuntime({
      resolveAdmission: async () => ({ sessionKey: "mars:phobos-yard", faction: "accord",
        shipId: "mandjet" }),
      resolveUniversePatrols: async (_userId, faction) => {
        if (!available && firstLookup === "unavailable") throw new Error("Directory unavailable");
        return available && faction === "accord" ? [contact] : [];
      },
      reserveUniversePatrol: async () => { claims++; return contact; },
      settleScoutEncounter: async () => { throw new Error("No result expected"); },
    });
    try {
      await runtime.handle(socketFor(firstPackets), "first-pilot",
        { type: "freeflight_join", openingEncounter: true });
      const first = firstPackets.find((p) => p.type === "freeflight_joined");
      assert.equal(first?.openingEncounter, "unavailable");
      assert.ok(isFreeFlightSnapshotV1(first?.snapshot));
      assert.equal(first.snapshot.actors.filter((actor) => actor.kind === "patrol").length, 0,
        "no non-actionable sample fleet may impersonate a persistent contact");
      const firstPilot = first.snapshot.actors.find((actor) => actor.own)!;
      available = true;
      await runtime.handle(socketFor(nextPackets), "next-pilot",
        { type: "freeflight_join", openingEncounter: true });
      const next = nextPackets.find((p) => p.type === "freeflight_joined");
      assert.equal(next?.openingEncounter, "ready");
      assert.ok(isFreeFlightSnapshotV1(next?.snapshot));
      assert.ok(next.snapshot.actors.some((actor) => actor.kind === "patrol" &&
        actor.actorId.startsWith("patrol-ship:")));
      const retained = next.snapshot.actors.find((actor) => actor.actorId === firstPilot.actorId)!;
      assert.deepEqual(retained.position, firstPilot.position);
      assert.equal(retained.hull, firstPilot.hull);
      assert.equal(claims, 1);
      assert.ok(nextPackets.some((p) => p.type === "freeflight_engagement_started"));
    } finally { await runtime.close(); }
  });
}
