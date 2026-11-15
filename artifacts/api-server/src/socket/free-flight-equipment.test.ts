import assert from "node:assert/strict";
import test from "node:test";
import { isEquipmentTelemetry, type EquippedModule } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";
const equipped = (equipmentId: string, hardpointId: string): EquippedModule =>
  ({ instanceId: equipmentId, equipmentId, hardpointId, condition: 100 });
test("a newly issued modular flight fires authoritative rounds and rockets, then retains ammunition and fit through restart", async () => {
  let stored: FreeFlightSessionCheckpointV1 | undefined;
  let fit = [equipped("autocannon", "primary"), equipped("rocket", "secondary"), equipped("shield", "utility-1")];
  const packets: Record<string, unknown>[] = [];
  const socket = { readyState: 1, bufferedAmount: 0, send: (data: string) => packets.push(JSON.parse(data)), close: () => {} };
  const options = {
    resolveAdmission: async () => ({ sessionKey: "mars:equipment-test", faction: "ussf" as const, shipId: "bastion" as const, equipment: fit }),
    saveCheckpoint: async (_key: string, state: FreeFlightSessionCheckpointV1) => { stored = structuredClone(state); return true; },
  };
  let runtime = createFreeFlightRuntime(options);
  try {
    await runtime.handle(socket, "equipment-pilot", { type: "freeflight_join" });
    await runtime.handle(socket, "equipment-pilot", { type: "freeflight_input", input: {
      version: 5, seq: 1, targetId: null, throttle: 0, yaw: 0, pitch: 0,
      strafe: 0, vertical: 0, roll: 0, fire: true, missile: true,
      boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false,
    } });
    runtime.advance(Date.now() + 200);
    const shots = packets.filter(p => p.type === "freeflight_weapon_fired");
    assert.ok(shots.some(p => p.weaponId === "autocannon"));
    assert.ok(shots.some(p => p.weaponId === "rocket"), "unguided rockets fire without a target lock");
    const telemetry = packets.filter(p => p.type === "freeflight_equipment_state").at(-1);
    assert.ok(isEquipmentTelemetry(telemetry));
    assert.equal(telemetry.unguided, true);
    await runtime.close();
    const issued = stored!.actors.find(actor => actor.ownerUserId === "equipment-pilot")!;
    assert.ok(issued.equipmentWeapons!.primary!.rounds < 90);
    assert.equal(issued.equipmentWeapons!.secondary!.rounds, 5);
    const rounds = issued.equipmentWeapons!.primary!.rounds;
    const shieldMax = issued.shieldMax;
    fit = [equipped("railgun", "primary")]; // Account has changed since issue.
    runtime = createFreeFlightRuntime({ ...options, loadCheckpoint: async () => ({
      stateVersion: 1, fencingToken: 1, checkpointSequence: stored!.checkpointSequence,
      snapshot: structuredClone(stored!) as unknown as Record<string, unknown>,
    }) });
    await runtime.handle(socket, "equipment-pilot", { type: "freeflight_join" });
    await runtime.close();
    const resumed = stored!.actors.find(actor => actor.ownerUserId === "equipment-pilot")!;
    assert.equal(resumed.equipment![0]!.equipmentId, "autocannon", "reconnect cannot replace issued weapons");
    assert.equal(resumed.equipmentWeapons!.primary!.rounds, rounds, "reconnect cannot mint ammunition");
    assert.equal(resumed.equipmentWeapons!.secondary!.rounds, 5);
    assert.equal(resumed.shieldMax, shieldMax, "reconnect cannot repeatedly apply shield capacity upgrades");
  } finally { await runtime.close(); }
});

test("a mounted railgun consumes its issued round and delivers the same authoritative hull contact to both pilots", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let stored: FreeFlightSessionCheckpointV1 | undefined;
  const received: Record<string, unknown>[][] = [[], []];
  const sockets = received.map(packets => ({
    readyState: 1, bufferedAmount: 0, close() {},
    send(value: string) { packets.push(JSON.parse(value)); },
  }));
  const options = {
    resolveAdmission: async (userId: string) => ({
      sessionKey: "mars:modular-contact-test", faction: userId === "gunner" ? "ussf" as const : "accord" as const,
      shipId: userId === "gunner" ? "bastion" as const : "mandjet" as const,
      equipment: userId === "gunner" ? [equipped("railgun", "primary")] : [],
    }),
    resolveUniversePatrols: async () => [],
    saveCheckpoint: async (_key: string, state: FreeFlightSessionCheckpointV1) => {
      stored = structuredClone(state); return true;
    },
  };
  let runtime = createFreeFlightRuntime(options);
  try {
    await runtime.handle(sockets[0]!, "gunner", { type: "freeflight_join" });
    await runtime.handle(sockets[1]!, "target", { type: "freeflight_join" });
    await runtime.close();
    const gunner = stored!.actors.find(actor => actor.ownerUserId === "gunner")!;
    const target = stored!.actors.find(actor => actor.ownerUserId === "target")!;
    assert.ok(gunner && target, "both faction-compatible fixture pilots must be admitted");
    for (const actor of [gunner, target]) {
      actor.craft.x = 5000; actor.craft.z = actor === gunner ? 5000 : 4980;
      Object.assign(actor.craft.space!, { y: 5000, vx: 0, vy: 0, vz: 0, q: [0, 0, 0, 1] });
      actor.craft.yaw = 0; actor.craft.pitch = 0; actor.craft.speed = 0;
      actor.shield = 0; actor.shieldMax = 0;
    }
    const snapshot = structuredClone(stored!);
    runtime = createFreeFlightRuntime({ ...options, loadCheckpoint: async () => ({
      stateVersion: 1, fencingToken: 1, checkpointSequence: snapshot.checkpointSequence,
      snapshot: snapshot as unknown as Record<string, unknown>,
    }) });
    received.forEach(packets => { packets.length = 0; });
    await runtime.handle(sockets[0]!, "gunner", { type: "freeflight_join" });
    await runtime.handle(sockets[1]!, "target", { type: "freeflight_join" });
    await runtime.handle(sockets[0]!, "gunner", {
      type: "freeflight_target_nearest", protocol: "orbital-freeflight-targeting-v1", seq: 1,
    });
    assert.ok(received[0]!.some(p => p.type === "freeflight_target_state" &&
      (p.state as { targetActorId?: string }).targetActorId === target.actorId));
    await runtime.handle(sockets[0]!, "gunner", { type: "freeflight_input", input: {
      version: 5, seq: 1, targetId: null, throttle: 0, yaw: 0, pitch: 0, roll: 0,
      strafe: 0, vertical: 0, fire: true, missile: false, boost: false, brake: false,
      inertial: false, aimAssist: false, countermeasure: false,
    } });
    assert.ok(received[0]!.some(p => p.type === "freeflight_input_accepted" && p.seq === 1));
    for (let tick = 0; tick < 12; tick++) runtime.advance(now += 34);
    const contacts = received.map(packets => packets.filter(p =>
      p.type === "freeflight_weapon_event" && p.weaponId === "railgun" && p.targetActorId === target.actorId));
    assert.ok(contacts[0]!.some(p => Number(p.hullDamage) > 0),
      "accepted fire at the selected hostile must produce server-confirmed hull damage");
    assert.deepEqual(contacts[0], contacts[1], "both pilots see the server contact, not a client hit claim");
    const launch = received[0]!.find(p => p.type === "freeflight_weapon_fired" && p.weaponId === "railgun");
    assert.ok(launch);
    assert.equal(contacts[0]![0]!.eventId, launch.eventId);
    await runtime.close();
    const issued = stored!.actors.find(actor => actor.ownerUserId === "gunner")!;
    assert.equal(issued.equipmentWeapons!.primary!.rounds, 11);
    assert.equal(issued.equipmentWeapons!.primary!.reserve, 108);
  } finally { await runtime.close(); }
});
