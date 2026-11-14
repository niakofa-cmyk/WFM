import assert from "node:assert/strict";
import test from "node:test";
import { isArmamentSnapshot, type ArmamentSnapshot } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";
function socket() {
  const packets: Record<string, unknown>[] = [];
  return { packets, readyState: 1, bufferedAmount: 0, close() {},
    send(data: string) { packets.push(JSON.parse(data)); } };
}
const frames = (s: ReturnType<typeof socket>) => s.packets
  .filter(p => p.type === "freeflight_armament_snapshot").map(p => p.snapshot as ArmamentSnapshot);
test("two viewers see only visible issued fits; drafts, inventory IDs, other sessions and legacy clients are excluded", async t => {
  let now = Date.now(), draft = "railgun";
  t.mock.method(Date, "now", () => now);
  let saved: FreeFlightSessionCheckpointV1 | undefined;
  const resolveAdmission = async (userId: string) => ({
    sessionKey: userId === "other" ? "mars:rust-disc" : "mars:phobos-yard",
    faction: "ussf" as const, shipId: "bastion" as const,
    equipment: userId === "a" ? [{
      instanceId: "private-inventory-a", equipmentId: draft, hardpointId: "primary", condition: 75,
    }] : [],
  });
  const seed = createFreeFlightRuntime({ resolveAdmission, resolveUniversePatrols: async () => [],
    saveCheckpoint: async (_key, snapshot) => { saved = structuredClone(snapshot); return true; } });
  for (const user of ["a", "b", "far", "legacy"]) await seed.handle(socket(), user, { type: "freeflight_join" });
  await seed.close();
  const sourceId = saved!.actors.find(a => a.ownerUserId === "a")!.actorId;
  saved!.actors.find(a => a.ownerUserId === "far")!.craft.x = 20_000;
  draft = "rotary-gun"; // The account/draft changes; the issued craft must not.
  const checkpoints = new Map<string, FreeFlightSessionCheckpointV1>();
  const runtime = createFreeFlightRuntime({ resolveAdmission, resolveUniversePatrols: async () => [],
    saveCheckpoint: async (key, snapshot) => { checkpoints.set(key, snapshot); return true; },
    loadCheckpoint: async key => key === "mars:phobos-yard"
      ? { stateVersion: 1, fencingToken: 1, checkpointSequence: saved!.checkpointSequence, snapshot: saved! } : null });
  const a = socket(), b = socket(), far = socket(), legacy = socket(), other = socket(), unadmitted = socket();
  try {
    await runtime.handle(unadmitted, "stranger", { type: "freeflight_armament_subscribe", protocol: 1 });
    assert.equal(frames(unadmitted).length, 0);
    for (const [user, s] of [["a", a], ["b", b], ["far", far], ["legacy", legacy], ["other", other]] as const) {
      await runtime.handle(s, user, { type: "freeflight_join" });
      assert.equal(frames(s).length, 0);
      if (user !== "legacy") await runtime.handle(s, user, { type: "freeflight_armament_subscribe", protocol: 1 });
    }
    const visible = frames(b)[0]!;
    assert.ok(isArmamentSnapshot(visible));
    assert.deepEqual(visible.actors.find(actor => actor.actorId === sourceId)!.mounts,
      [{ hardpointId: "primary", equipmentId: "railgun" }]);
    assert.deepEqual(frames(a)[0]!.actors.find(actor => actor.actorId === sourceId)!.mounts,
      visible.actors.find(actor => actor.actorId === sourceId)!.mounts);
    assert.equal(JSON.stringify(visible).includes("private-inventory-a"), false);
    assert.equal(JSON.stringify(visible).includes("condition"), false);
    assert.ok(frames(far).every(frame => !frame.actors.some(actor => actor.actorId === sourceId)));
    assert.ok(frames(other).every(frame => !frame.actors.some(actor => actor.actorId === sourceId)));
    const count = frames(b).length;
    for (let i = 0; i < 15; i++) await runtime.handle(b, "b", { type: "freeflight_armament_subscribe", protocol: 1 });
    assert.equal(frames(b).length, count, "duplicate subscriptions cannot amplify static-fit traffic");
    await runtime.handle(b, "b", { type: "freeflight_armament_subscribe", protocol: 1, userId: "a" });
    assert.equal(frames(b).length, count);
    for (let i = 0; i < 32; i++) runtime.advance(now += 34);
    const updates = frames(b);
    for (let i = 1; i < updates.length; i++) assert.ok(updates[i]!.tick - updates[i - 1]!.tick >= 15);
    assert.equal(frames(legacy).length, 0);
    assert.ok(updates.every(isArmamentSnapshot));
    assert.ok(updates.every(frame => JSON.stringify(frame).length < 32_000));
  } finally { await runtime.close(); }
  assert.ok(checkpoints.get("mars:phobos-yard")!.actors.every(actor =>
    !Object.hasOwn(actor, "armamentPresentationV1") && !Object.hasOwn(actor, "lastArmamentPresentationTick")));
});
