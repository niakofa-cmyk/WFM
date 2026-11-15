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
