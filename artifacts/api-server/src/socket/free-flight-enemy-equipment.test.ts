import assert from "node:assert/strict";
import test from "node:test";
import { newShipSubsystems, survivingEquipment, type ArmamentSnapshot } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";
import { readExplorationReceipt, type ExplorationResult } from "../game/exploration-encounter";
import type { UniversePatrolEncounter } from "../game/universe-patrols";
const socket = () => {
  const packets: Record<string, any>[] = [];
  return { packets, readyState: 1, bufferedAmount: 0, close() {}, send(data: string) { packets.push(JSON.parse(data)); } };
};
test("live AI uses its issued gun, two pilots see the fit, destruction freezes exact survivors and exploration continues across recovery", async t => {
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  let saved: FreeFlightSessionCheckpointV1 | undefined, result: Readonly<ExplorationResult> | undefined;
  const patrol: UniversePatrolEncounter = {
    patrolId: "equipment-fleet", locationId: "phobos-yard", faction: "accord", callsign: "A-REAL",
    route: ["phobos-yard", "phobos-yard"], revision: 0,
    ships: [{ id: "equipment-enemy", hullId: "mandjet", name: "Mandjet", callsign: "A-ONE" }],
  };
  const options = {
    enableEnemyEquipment: true,
    resolveAdmission: async (_user: string) => ({
      sessionKey: "mars:phobos-yard", faction: "ussf" as const, shipId: "bastion" as const,
      equipment: [{ instanceId: "issued-rail", hardpointId: "primary", equipmentId: "railgun", condition: 100 }],
    }),
    resolveFreeFlightPatrols: async () => [patrol],
    reserveUniversePatrol: async () => patrol,
    saveCheckpoint: async (_key: string, snapshot: FreeFlightSessionCheckpointV1) => { saved = structuredClone(snapshot); return true; },
    settleScoutEncounter: async (receipt: Parameters<typeof readExplorationReceipt>[0]) => {
      result = readExplorationReceipt(receipt);
      return { status: "settled" as const, awards: result.pilots.map(p => ({ ...p, balanceAfter: p.credits, revision: 1 })) };
    },
    recoverSalvage: async () => ({ equipmentId: "autocannon", revision: 1 }),
  };
  let runtime = createFreeFlightRuntime(options);
  const a = socket(), b = socket();
  try {
    await runtime.handle(a, "gunner", { type: "freeflight_join" });
    await runtime.handle(b, "wingmate", { type: "freeflight_join" });
    await runtime.close();
    const npc = saved!.actors.find(a => a.kind === "patrol")!;
    const manifest = structuredClone(npc.enemyEquipmentManifest!);
    assert.deepEqual(manifest.modules, npc.equipment);
    for (const actor of saved!.actors) {
      actor.craft.x = 5000; actor.craft.z = actor === npc ? 4980 : actor.ownerUserId === "gunner" ? 5000 : 5060;
      actor.craft.speed = 0; actor.craft.yaw = actor === npc ? Math.PI : 0; actor.craft.pitch = 0;
      Object.assign(actor.craft.space!, { y: 5000, vx: 0, vy: 0, vz: 0, q: actor === npc ? [0, 1, 0, 0] : [0, 0, 0, 1] });
      if (actor === npc) {
        actor.craft.hull *= .8; // A previously wounded ship must not require its full original hull to be credited.
        actor.shield = 0; actor.shieldMax = 0;
        actor.subsystems = newShipSubsystems(actor.craft.hullMax);
        // Leave a small amount of real mobility. A wholly immobilized fleet
        // correctly enters its existing strategic withdrawal/no-fire state.
        actor.subsystems.health.engines = actor.subsystems.maximum * .01;
      }
    }
    const checkpoint = structuredClone(saved!);
    runtime = createFreeFlightRuntime({ ...options, loadCheckpoint: async () => ({
      stateVersion: 1, fencingToken: 1, checkpointSequence: checkpoint.checkpointSequence,
      snapshot: checkpoint as unknown as Record<string, unknown>,
    }) });
    a.packets.length = 0; b.packets.length = 0;
    for (const [s, user] of [[a, "gunner"], [b, "wingmate"]] as const) {
      await runtime.handle(s, user, { type: "freeflight_join" });
      await runtime.handle(s, user, { type: "freeflight_armament_subscribe", protocol: 1 });
    }
    const appearance = (s: typeof a) => (s.packets.find(p => p.type === "freeflight_armament_snapshot")!.snapshot as ArmamentSnapshot)
      .actors.find(actor => actor.actorId === npc.actorId)!;
    assert.deepEqual(appearance(a), appearance(b));
    assert.deepEqual(appearance(a).mounts, manifest.modules.map(m => ({ hardpointId: m.hardpointId, equipmentId: m.equipmentId })));
    assert.equal(JSON.stringify(appearance(a)).includes(manifest.modules[0]!.instanceId), false);
    await runtime.handle(a, "gunner", { type: "freeflight_engage", targetActorId: npc.actorId });
    await runtime.handle(a, "gunner", { type: "freeflight_target_nearest", protocol: "orbital-freeflight-targeting-v1", seq: 1 });
    for (let tick = 0; tick < 360 && !result; tick++) {
      await runtime.handle(a, "gunner", { type: "freeflight_input", input: {
        version: 5, seq: tick + 1, targetId: null, throttle: 0, yaw: 0, pitch: 0, roll: 0,
        strafe: 0, vertical: 0, fire: true, missile: false, boost: false, brake: false,
        inertial: false, aimAssist: true, countermeasure: false,
      } });
      runtime.advance(now += 34);
      await Promise.resolve();
    }
    assert.ok(a.packets.some(p => p.type === "freeflight_weapon_fired" && p.sourceActorId === npc.actorId && p.weaponId === "autocannon"),
      JSON.stringify({ errors: a.packets.filter(p => p.type === "freeflight_error"),
        engagements: a.packets.filter(p => p.type === "freeflight_engagement_started"),
        actors: saved!.actors.map(a => ({ kind: a.kind, hull: a.craft.hull, root: a.craft.root,
          x: a.craft.x, y: a.craft.space!.y, z: a.craft.z, rounds: a.equipmentWeapons?.primary?.rounds })),
        shots: a.packets.filter(p => p.type === "freeflight_weapon_fired").map(p => [p.sourceActorId, p.weaponId]) }));
    assert.ok(result, "real projectile contacts must resolve the enemy destruction");
    const evidence = result.equipmentSalvage!.actors[0]!;
    assert.deepEqual(evidence.manifest, manifest);
    assert.ok(survivingEquipment(evidence));
    assert.equal(result.pilots.find(p => p.playerId === "gunner")!.rewardableNpcKills, 1);
    const destroyed = a.packets.filter(p => p.type === "freeflight_weapon_event" && p.destroyed);
    assert.ok(destroyed.length > 0);
    assert.deepEqual(destroyed, b.packets.filter(p => p.type === "freeflight_weapon_event" && p.destroyed));
    await runtime.close();
    const remains = saved!.actors.find(a => a.actorId === npc.actorId)!;
    assert.equal(remains.craft.alive, false);
    assert.ok(remains.equipmentWeapons!.primary!.rounds < 90);
    assert.equal(saved!.wreckPackages!.length, 1);
    const restore = structuredClone(saved!);
    runtime = createFreeFlightRuntime({ ...options, loadCheckpoint: async () => ({
      stateVersion: 1, fencingToken: 1, checkpointSequence: restore.checkpointSequence, snapshot: restore as unknown as Record<string, unknown>,
    }) });
    await runtime.handle(a, "gunner", { type: "freeflight_join" });
    await runtime.handle(a, "gunner", { type: "freeflight_input", input: {
      version: 5, seq: restore.actors.find(a => a.ownerUserId === "gunner")!.lastSeq + 1,
      targetId: null, throttle: .8, yaw: 0, pitch: 0, roll: 0,
      strafe: 0, vertical: 0, fire: false, missile: false, boost: false, brake: false,
      inertial: false, aimAssist: false, countermeasure: false,
    } });
    for (let i = 0; i < 12; i++) runtime.advance(now += 34);
    await runtime.close();
    assert.deepEqual(saved!.actors.find(a => a.actorId === npc.actorId)!.equipmentWeapons, remains.equipmentWeapons);
    assert.deepEqual(saved!.actors.find(a => a.actorId === npc.actorId)!.enemyEquipmentManifest, manifest);
    const pilot = saved!.actors.find(a => a.ownerUserId === "gunner")!;
    assert.equal(pilot.craft.alive, true);
    assert.ok(Math.abs(pilot.craft.z - 5000) > .1, "the same surviving pilot can continue free flight after battle and owner recovery");
  } finally { await runtime.close(); }
});
