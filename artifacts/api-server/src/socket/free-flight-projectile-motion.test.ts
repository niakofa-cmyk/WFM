import assert from "node:assert/strict";
import test from "node:test";
import { isProjectileMotionSnapshot, MAX_PROJECTILE_MOTION_SAMPLES, UNIVERSE_MARS_REFERENCE,
  type ProjectileMotionSnapshot } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";

function capture() {
  const packets: Array<Record<string, unknown>> = [];
  return { packets, readyState: 1, bufferedAmount: 0, close() {},
    send(value: string) { packets.push(JSON.parse(value)); } };
}
const frames = (s: ReturnType<typeof capture>) => s.packets
  .filter(p => p.type === "freeflight_projectile_motion").map(p => p.snapshot as ProjectileMotionSnapshot);

test("two admitted runtime viewers receive one curved missile and the same surface contact across recovery", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let checkpoint: FreeFlightSessionCheckpointV1 | undefined;
  const resolveAdmission = async () => ({ sessionKey: "mars:phobos-yard",
    faction: "ussf" as const, shipId: "glide" as const });
  const seed = createFreeFlightRuntime({ resolveAdmission, resolveUniversePatrols: async () => [],
    saveCheckpoint: async (_key, state) => { checkpoint = structuredClone(state); return true; } });
  for (const name of ["a", "b", "legacy", "far"]) await seed.handle(capture(), name, { type: "freeflight_join" });
  await seed.close();
  for (const actor of checkpoint!.actors) {
    actor.craft.x = -100; actor.craft.z = -115;
    actor.craft.space!.y = 20.1;
    actor.craft.space!.vx = 0; actor.craft.space!.vy = 0; actor.craft.space!.vz = 0;
    actor.previousPosition = { x: -100, y: 20.1, z: -115 };
    if (actor.ownerUserId === "b") { actor.craft.x = -90; actor.craft.z = -320; }
    if (actor.ownerUserId === "far") actor.craft.x = 20_000;
  }
  const source = checkpoint!.actors.find(a => a.ownerUserId === "a")!;
  const target = checkpoint!.actors.find(a => a.ownerUserId === "b")!;
  checkpoint!.projectiles = [{
    id: 42, sourceActorId: source.actorId, faction: "ussf",
    x: -100, y: 20.1, z: -115, vx: 30, vy: 0, vz: -40,
    life: 5, dmg: 10, r: .25, homeId: target.numericId, missile: true,
    guidance: "active", turnRate: 1.2, visualEffect: "swarm",
  }];
  checkpoint!.nextProjectileId = 43;
  const options = { resolveAdmission, resolveUniversePatrols: async () => [],
    loadCheckpoint: async () => ({ stateVersion: 1, snapshot: checkpoint!, fencingToken: 1, checkpointSequence: 1 }),
    saveCheckpoint: async (_key: string, state: FreeFlightSessionCheckpointV1) => {
      checkpoint = structuredClone(state); return true;
    } };
  let runtime = createFreeFlightRuntime(options);
  const a = capture(), b = capture(), legacy = capture(), far = capture();
  try {
    for (const [name, socket] of [["a", a], ["b", b], ["legacy", legacy], ["far", far]] as const) {
      await runtime.handle(socket, name, { type: "freeflight_join" });
      if (name !== "legacy") await runtime.handle(socket, name, {
        type: "freeflight_projectile_motion_subscribe", protocol: 1 });
    }
    const eventId = `${checkpoint!.instanceId}:projectile:42`;
    assert.ok(frames(a).some(f => f.projectiles.some(p => p.eventId === eventId)));
    // The authority really applies homing, not a hand-written visual curve.
    for (let i = 0; i < 6; i++) runtime.advance(now += 34);
    const before = frames(a).flatMap(f => f.projectiles).filter(p => p.eventId === eventId);
    assert.ok(before.some(p => Math.abs(p.velocity.x - 30) > .1));
    await runtime.close();
    runtime = createFreeFlightRuntime(options);
    const afterA = capture(), afterB = capture();
    await runtime.handle(afterA, "a", { type: "freeflight_join" });
    await runtime.handle(afterB, "b", { type: "freeflight_join" });
    assert.equal(frames(afterA).length, 0, "restore does not persist presentation subscriptions");
    for (const [name, socket] of [["a", afterA], ["b", afterB]] as const)
      await runtime.handle(socket, name, { type: "freeflight_projectile_motion_subscribe", protocol: 1 });
    assert.ok(frames(afterA).some(f => f.projectiles.some(p => p.eventId === eventId)));
    for (let i = 0; i < 50; i++) runtime.advance(now += 34);
    const contacts = (s: ReturnType<typeof capture>) => s.packets.filter(p =>
      p.type === "freeflight_world_impact" && p.eventId === eventId);
    assert.equal(contacts(afterA).length, 1);
    assert.deepEqual(contacts(afterA), contacts(afterB));
    const point = contacts(afterA)[0]!.to as { x: number; y: number; z: number };
    const mars = UNIVERSE_MARS_REFERENCE;
    const distance = Math.hypot(point.x - mars.position.x, point.y - mars.position.y, point.z - mars.position.z);
    assert.ok(distance >= mars.radius && distance < mars.radius + 1);
    assert.equal(frames(legacy).length, 0);
    assert.ok(frames(far).every(f => f.projectiles.length === 0));
    for (const frame of [...frames(a), ...frames(b), ...frames(afterA), ...frames(afterB)]) {
      assert.equal(isProjectileMotionSnapshot(frame), true);
      assert.ok(frame.projectiles.length <= MAX_PROJECTILE_MOTION_SAMPLES);
    }
    assert.equal(afterA.packets.some(p => p.type === "freeflight_combat_result"), false);
  } finally { await runtime.close(); }
});

test("motion feed is opt-in, rate-bounded, source-authorized and missile-prioritized under saturation", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let checkpoint: FreeFlightSessionCheckpointV1 | undefined;
  const resolveAdmission = async (userId: string) => ({ sessionKey: userId === "other" ? "mars:rust-disc" : "mars:phobos-yard",
    faction: "ussf" as const, shipId: "glide" as const });
  const seed = createFreeFlightRuntime({ resolveAdmission, resolveUniversePatrols: async () => [],
    saveCheckpoint: async (_key, state) => { checkpoint = structuredClone(state); return true; } });
  await seed.handle(capture(), "pilot", { type: "freeflight_join" });
  await seed.close();
  const source = checkpoint!.actors.find(a => a.kind === "pilot")!;
  checkpoint!.projectiles = Array.from({ length: 200 }, (_, i) => ({
    id: i, sourceActorId: source.actorId, faction: "ussf",
    x: source.craft.x, y: source.craft.space!.y, z: source.craft.z - 5,
    vx: 0, vy: 0, vz: -1, life: 4, dmg: 1, r: .1, homeId: null,
    missile: i >= 190, visualEffect: "pulse",
  }));
  checkpoint!.nextProjectileId = 200;
  const hidden = structuredClone(source);
  hidden.actorId = "pilot:hidden-source";
  hidden.kind = "pilot";
  hidden.ownerUserId = "hidden";
  hidden.numericId = checkpoint!.nextNumericId++;
  hidden.craft.id = hidden.numericId;
  hidden.craft.x += 10_000;
  checkpoint!.actors.push(hidden);
  checkpoint!.projectiles.push({
    ...checkpoint!.projectiles[0]!, id: 200, sourceActorId: hidden.actorId,
  });
  checkpoint!.nextProjectileId = 201;
  const runtime = createFreeFlightRuntime({ resolveAdmission, resolveUniversePatrols: async () => [],
    loadCheckpoint: async key => key === "mars:phobos-yard" ? {
      stateVersion: 1, snapshot: checkpoint!, fencingToken: 1, checkpointSequence: 1 } : null });
  const pilot = capture(), other = capture(), unauthenticated = capture();
  try {
    await runtime.handle(unauthenticated, "unadmitted", { type: "freeflight_projectile_motion_subscribe", protocol: 1 });
    assert.equal(frames(unauthenticated).length, 0);
    assert.ok(unauthenticated.packets.some(p => p.reason === "freeflight_join_required"));
    await runtime.handle(pilot, "pilot", { type: "freeflight_join" });
    assert.equal(frames(pilot).length, 0);
    await runtime.handle(pilot, "pilot", { type: "freeflight_projectile_motion_subscribe", protocol: 1, target: "arbitrary" });
    assert.equal(frames(pilot).length, 0, "subscriptions cannot request arbitrary target locations");
    await runtime.handle(pilot, "pilot", { type: "freeflight_projectile_motion_subscribe", protocol: 1 });
    const initial = frames(pilot)[0]!;
    assert.equal(initial.projectiles.length, MAX_PROJECTILE_MOTION_SAMPLES);
    assert.equal(initial.projectiles.filter(p => p.missile).length, 10);
    assert.equal(initial.projectiles[0]!.missile, true);
    assert.equal(initial.projectiles.some(p => p.eventId.endsWith(":200")), false,
      "nearby projectiles from unseen remote actors cannot expose their source");
    assert.ok(JSON.stringify(initial).length < 64_000, "packet stays bounded even with 200 live rounds");
    for (let i = 0; i < 20; i++) await runtime.handle(pilot, "pilot", {
      type: "freeflight_projectile_motion_subscribe", protocol: 1 });
    assert.equal(frames(pilot).length, 1, "subscription replay does not amplify traffic");
    await runtime.handle(other, "other", { type: "freeflight_join" });
    await runtime.handle(other, "other", { type: "freeflight_projectile_motion_subscribe", protocol: 1 });
    for (let i = 0; i < 10; i++) runtime.advance(now += 34);
    assert.ok(frames(other).every(frame => frame.projectiles.length === 0));
    const updates = frames(pilot);
    for (let i = 1; i < updates.length; i++)
      assert.ok(updates[i]!.tick - updates[i - 1]!.tick >= 3);
  } finally { await runtime.close(); }
});
