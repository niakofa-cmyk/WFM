import assert from "node:assert/strict";
import test from "node:test";
import {
  SHIP_SUBSYSTEMS, SUBSYSTEM_OFFSETS, newShipSubsystems, validShipSubsystems,
  damageShipSubsystem, subsystemEfficiency, subsystemAtContact, isShipSubsystemTelemetry,
  FREE_FLIGHT_ASSIST_V1,
  subsystemFlightControls,
} from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";

test("all eight physical component regions can be hit independently without killing the hull", () => {
  const state = newShipSubsystems(200);
  assert.ok(validShipSubsystems(state));
  for (const id of SHIP_SUBSYSTEMS) {
    assert.equal(subsystemAtContact(SUBSYSTEM_OFFSETS[id]), id);
    const fresh = newShipSubsystems(200);
    assert.equal(damageShipSubsystem(fresh, id, fresh.maximum + 100), true);
    assert.equal(subsystemEfficiency(fresh, id), 0);
    assert.equal(damageShipSubsystem(fresh, id, 100), false, "disable transition happens only once");
    for (const other of SHIP_SUBSYSTEMS.filter(x => x !== id)) assert.equal(subsystemEfficiency(fresh, other), 1);
  }
  assert.equal(subsystemEfficiency(undefined, "engines"), 1, "legacy checkpoints remain operable");
  damageShipSubsystem(state, "reactor", NaN);
  assert.ok(validShipSubsystems(state));
  assert.equal(validShipSubsystems({ ...state, health: { ...state.health, engines: -1 } }), false);
  assert.equal(validShipSubsystems({ ...state, health: { ...state.health, bridge: Infinity } }), false);
  const input = { throttle: 1, strafe: 1, vertical: 1, pitch: 1, yaw: 1, boost: true };
  state.health.engines = 0;
  const mapped = subsystemFlightControls(input, state);
  assert.equal(mapped.throttle, 0);
  assert.equal(mapped.strafe, 0);
  assert.equal(mapped.vertical, 0);
  assert.equal(mapped.boost, false);
  assert.equal(mapped.yaw, .3);
  assert.equal(input.throttle, 1, "never double-scale the raw transmitted input");
});

test("disabled components survive restart and suppress weapons, shields, power and assistance without granting kills", async () => {
  let saved: FreeFlightSessionCheckpointV1 | undefined;
  const packets: Record<string, unknown>[] = [];
  const socket = { readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data)), close() {} };
  const options = {
    resolveAdmission: async () => ({ sessionKey: "mars:subsystems", faction: "ussf" as const, shipId: "bastion" as const }),
    saveCheckpoint: async (_key: string, snapshot: FreeFlightSessionCheckpointV1) => {
      saved = structuredClone(snapshot); return true;
    },
  };
  let runtime = createFreeFlightRuntime(options);
  try {
    await runtime.handle(socket, "component-pilot", { type: "freeflight_join" });
    await runtime.close();
    const damaged = saved!.actors.find(a => a.ownerUserId === "component-pilot")!;
    damaged.subsystems = newShipSubsystems(damaged.craft.hullMax);
    for (const id of SHIP_SUBSYSTEMS) damageShipSubsystem(damaged.subsystems, id, 1000);
    damaged.selectedSubsystem = "engines";
    damaged.subsystemCycleSeq = 7;
    const previousHull = damaged.craft.hull;
    const snapshot = structuredClone(saved!);
    runtime = createFreeFlightRuntime({ ...options, loadCheckpoint: async () => ({
      stateVersion: 1, fencingToken: 1, checkpointSequence: snapshot.checkpointSequence,
      snapshot: snapshot as unknown as Record<string, unknown>,
    }) });
    packets.length = 0;
    await runtime.handle(socket, "component-pilot", { type: "freeflight_join" });
    const joined = packets.find(p => p.type === "freeflight_joined")!;
    assert.equal((joined.subsystems as { nextSeq: number }).nextSeq, 8);
    await runtime.handle(socket, "component-pilot", { type: "freeflight_subsystem_cycle", protocol: 1, seq: 8 });
    const telemetry = packets.filter(isShipSubsystemTelemetry).at(-1)!;
    assert.equal(telemetry.selected, "weapons");
    assert.equal(telemetry.own.health.engines, 0);
    await runtime.handle(socket, "component-pilot", { type: "freeflight_subsystem_cycle", protocol: 1, seq: 8 });
    assert.ok(packets.some(p => p.type === "error"), "replayed selection sequence is rejected");
    await runtime.handle(socket, "component-pilot", { type: "freeflight_input", input: {
      version: 5, seq: 1, targetId: null, throttle: 1, yaw: 0, pitch: 0,
      strafe: 1, vertical: 1, roll: 0, fire: true, missile: true, boost: true,
      brake: false, inertial: false, aimAssist: false, countermeasure: false,
    } });
    await runtime.handle(socket, "component-pilot", { type: "freeflight_assist_call", protocol: FREE_FLIGHT_ASSIST_V1 });
    assert.ok(packets.some(p => p.type === "freeflight_assist_call_result" &&
      p.reason === "communications_disabled"));
    runtime.advance(Date.now() + 200);
    assert.equal(packets.filter(p => p.type === "freeflight_weapon_fired").length, 0);
    await runtime.close();
    const restored = saved!.actors.find(a => a.ownerUserId === "component-pilot")!;
    assert.equal(restored.craft.hull, previousHull);
    assert.equal(restored.craft.alive, true);
    assert.equal(restored.shield, 0);
    assert.equal(restored.craft.space!.energy, 0);
    assert.equal(restored.kills, 0);
    assert.equal(restored.creditsAwarded, 0);
    assert.deepEqual(restored.subsystems, damaged.subsystems);
  } finally { await runtime.close(); }
});

test("real shared-flight projectiles disable a rear engine and both pilots see the same surviving target", async () => {
  let saved: FreeFlightSessionCheckpointV1 | undefined;
  const a: Record<string, unknown>[] = [], b: Record<string, unknown>[] = [];
  const socket = (packets: Record<string, unknown>[]) => ({ readyState: 1, bufferedAmount: 0,
    send: (data: string) => packets.push(JSON.parse(data)), close() {} });
  const first = socket(a), second = socket(b);
  const options = {
    resolveAdmission: async (user: string) => ({ sessionKey: "mars:physical-subsystems",
      faction: user === "component-attacker" ? "ussf" as const : "accord" as const,
      shipId: user === "component-attacker" ? "bastion" as const : "mandjet" as const }),
    saveCheckpoint: async (_key: string, snapshot: FreeFlightSessionCheckpointV1) => {
      saved = structuredClone(snapshot); return true;
    },
  };
  let runtime = createFreeFlightRuntime(options);
  try {
    await runtime.handle(first, "component-attacker", { type: "freeflight_join" });
    await runtime.handle(second, "component-defender", { type: "freeflight_join" });
    await runtime.close();
    const attacker = saved!.actors.find(p => p.ownerUserId === "component-attacker")!;
    const defender = saved!.actors.find(p => p.ownerUserId === "component-defender")!;
    for (const actor of [attacker, defender]) {
      actor.craft.x = 5000; actor.craft.z = actor === attacker ? 5000 : 4980;
      Object.assign(actor.craft.space!, { y: 5000, vx: 0, vy: 0, vz: 0, q: [0, 0, 0, 1] });
      actor.craft.yaw = 0; actor.craft.pitch = 0; actor.craft.speed = 0;
      actor.shield = 0; actor.shieldMax = 0;
    }
    const snapshot = structuredClone(saved!);
    runtime = createFreeFlightRuntime({ ...options, loadCheckpoint: async () => ({
      stateVersion: 1, fencingToken: 1, checkpointSequence: snapshot.checkpointSequence,
      snapshot: snapshot as unknown as Record<string, unknown>,
    }) });
    a.length = 0; b.length = 0;
    await runtime.handle(first, "component-attacker", { type: "freeflight_join" });
    await runtime.handle(second, "component-defender", { type: "freeflight_join" });
    await runtime.handle(first, "component-attacker", { type: "freeflight_engage", targetActorId: defender.actorId });
    // Select the actual enemy, then the engine aim point. This alone cannot inflict damage.
    await runtime.handle(first, "component-attacker", { type: "freeflight_target_nearest",
      protocol: "orbital-freeflight-targeting-v1", seq: 1 });
    await runtime.handle(first, "component-attacker", { type: "freeflight_subsystem_cycle", protocol: 1, seq: 1 });
    let clock = Date.now();
    for (let seq = 1; seq <= 240; seq++) {
      if (seq % 10 === 1) await runtime.handle(first, "component-attacker", { type: "freeflight_input", input: {
        version: 5, seq, targetId: null, throttle: 0, yaw: 0, pitch: 0,
        strafe: 0, vertical: 0, roll: 0, fire: true, missile: false,
        boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false,
      } });
      runtime.advance(clock += 34);
      if (a.some(p => p.type === "freeflight_weapon_event" && p.subsystemDisabled === true)) break;
    }
    const impact = a.find(p => p.type === "freeflight_weapon_event" && p.subsystemDisabled === true);
    assert.ok(impact, "ordinary server-spawned rounds must disable a component");
    assert.equal(impact.hitSubsystem, "engines");
    assert.equal(impact.destroyed, false, "component loss is not a hull kill");
    assert.ok(b.some(p => p.type === "freeflight_weapon_event" && p.eventId === impact.eventId));
    await runtime.close();
    const result = saved!.actors.find(p => p.ownerUserId === "component-defender")!;
    assert.equal(result.subsystems!.health.engines, 0);
    assert.equal(result.craft.alive, true);
    assert.ok(result.craft.hull > 0);
  } finally { await runtime.close(); }
});
