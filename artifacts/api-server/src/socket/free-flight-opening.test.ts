import assert from "node:assert/strict";
import test from "node:test";
import { isFreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import { createFreeFlightRuntime } from "./free-flight-runtime";
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

for (const faction of ["ussf", "accord"] as const) {
  test(`${faction} opening inserts a visible hostile ahead and reserves one real battle; reconnect preserves it`, async () => {
    const contact = patrol(faction === "ussf" ? "accord" : "ussf");
    const packets: Packet[] = [];
    const socket = socketFor(packets);
    let claims = 0;
    const runtime = createFreeFlightRuntime({
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
