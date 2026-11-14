import assert from "node:assert/strict";
import test from "node:test";
import { UNIVERSE_MARS_REFERENCE } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";

test("real free-flight rounds stop at Mars and emit authoritative surface contacts without ship damage", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let checkpoint: FreeFlightSessionCheckpointV1 | undefined;
  const admission = async () => ({ sessionKey: "mars:phobos-yard", faction: "ussf" as const, shipId: "glide" as const });
  const seed = createFreeFlightRuntime({
    resolveAdmission: admission, resolveUniversePatrols: async () => [],
    saveCheckpoint: async (_key, state) => { checkpoint = structuredClone(state); return true; },
  });
  const packets: Array<Record<string, unknown>> = [];
  const socket = { readyState: 1, bufferedAmount: 0, close() {},
    send(value: string) { packets.push(JSON.parse(value)); } };
  await seed.handle(socket, "surface-impact-pilot", { type: "freeflight_join" });
  await seed.close();
  const actor = checkpoint!.actors.find(a => a.kind === "pilot")!;
  // Isolated server fixture: start a stationary pilot facing Mars, outside it.
  actor.craft.x = -100; actor.craft.z = -100;
  actor.craft.space!.y = 20.1;
  actor.craft.space!.q = [0, 0, 0, 1];
  actor.craft.space!.vx = 0; actor.craft.space!.vy = 0; actor.craft.space!.vz = 0;
  actor.previousPosition = { x: -100, y: 20.1, z: -100 };
  const runtime = createFreeFlightRuntime({
    resolveAdmission: admission, resolveUniversePatrols: async () => [],
    loadCheckpoint: async () => ({ stateVersion: 1, snapshot: checkpoint!,
      fencingToken: 1, checkpointSequence: 1 }),
  });
  packets.length = 0;
  try {
    await runtime.handle(socket, "surface-impact-pilot", { type: "freeflight_join" });
    await runtime.handle(socket, "surface-impact-pilot", { type: "freeflight_input", input: {
      version: 5, seq: 1, targetId: null, throttle: 0, fire: true,
      yaw: 0, pitch: 0, roll: 0, strafe: 0, vertical: 0, countermeasure: false,
      boost: false, brake: false, inertial: false, missile: false, aimAssist: false,
    } });
    assert.ok(packets.some(p => p.type === "freeflight_input_accepted" && p.seq === 1));
    for (let i = 0; i < 60; i++) runtime.advance(now += 34);
    assert.ok(packets.some(p => p.type === "freeflight_weapon_fired"));
    const impacts = packets.filter(p => p.type === "freeflight_world_impact");
    assert.ok(impacts.length > 0, "weapon contact must be broadcast, not just hidden collision math");
    for (const impact of impacts) {
      const p = impact.to as { x: number; y: number; z: number };
      const c = UNIVERSE_MARS_REFERENCE.position;
      const radius = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
      assert.ok(radius >= UNIVERSE_MARS_REFERENCE.radius - .01 && radius < UNIVERSE_MARS_REFERENCE.radius + 5);
      assert.equal(typeof impact.eventId, "string");
    }
    assert.equal(packets.some(p => p.type === "freeflight_weapon_event"), false);
    assert.equal(packets.some(p => p.type === "freeflight_combat_result"), false);
  } finally { await runtime.close(); }
});
