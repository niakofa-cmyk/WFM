import assert from "node:assert/strict";
import test from "node:test";
import { validWreckPackages, readSalvageContacts, type WreckPackage } from "@workspace/orbital-sim";
import { createFreeFlightRuntime, type FreeFlightSessionCheckpointV1 } from "./free-flight-runtime";

const wreck: WreckPackage = {
  id: "encounter:patrol-ship:one", encounterId: "encounter", actorId: "patrol-ship:one",
  ownerUserId: "pilot", position: { x: 0, y: 0, z: 0 }, status: "available",
};
function peer() {
  const packets: Record<string, any>[] = [];
  return { packets, readyState: 1, bufferedAmount: 0,
    send(data: string) { packets.push(JSON.parse(data)); }, close() {} };
}
test("wreck wire/checkpoint contracts reject malformed, duplicate and unbounded packages", () => {
  assert.equal(validWreckPackages([wreck]), true);
  assert.equal(validWreckPackages([wreck, wreck]), false);
  assert.equal(validWreckPackages([{ ...wreck, position: { x: NaN, y: 0, z: 0 } }]), false);
  assert.equal(validWreckPackages([{ ...wreck, ownerUserId: null }]), false);
  assert.equal(readSalvageContacts([{ id: wreck.id, position: wreck.position, distanceMeters: 10, recoverable: true }])?.length, 1);
  assert.equal(readSalvageContacts([{ id: wreck.id, position: wreck.position, distanceMeters: -1, recoverable: true }]), null);
});
test("shared wrecks survive owner restart; only a nearby living owner can claim and simultaneous requests are bounded", async () => {
  let saved: FreeFlightSessionCheckpointV1 | undefined;
  let claims = 0;
  let finish: (() => void) | undefined;
  const resolveAdmission = async () => ({ sessionKey: "mars:salvage-test", faction: "ussf" as const, shipId: "glide" as const });
  const saveCheckpoint = async (_key: string, state: FreeFlightSessionCheckpointV1) => {
    saved = structuredClone(state); return true;
  };
  const seed = createFreeFlightRuntime({ resolveAdmission, saveCheckpoint });
  const first = peer(), other = peer();
  await seed.handle(first, "pilot", { type: "freeflight_join" });
  await seed.handle(other, "other", { type: "freeflight_join" });
  await seed.close();
  const pilot = saved!.actors.find(a => a.ownerUserId === "pilot")!;
  wreck.position = { x: pilot.craft.x + 10, y: pilot.craft.space!.y, z: pilot.craft.z };
  saved!.wreckPackages = [structuredClone(wreck)];
  const makeRuntime = () => createFreeFlightRuntime({ resolveAdmission, saveCheckpoint,
    loadCheckpoint: async () => ({ stateVersion: 1, fencingToken: 1,
      checkpointSequence: saved!.checkpointSequence, snapshot: structuredClone(saved!) as unknown as Record<string, unknown> }),
    recoverSalvage: async (_user, input) => {
      assert.equal(input.packageId, wreck.id);
      claims++;
      await new Promise<void>(resolve => { finish = resolve; });
      return { equipmentId: "autocannon", revision: 1 };
    },
  });
  let runtime = makeRuntime();
  const request = { type: "freeflight_salvage_recover", protocol: 1, packageId: wreck.id };
  try {
    await runtime.handle(first, "pilot", { type: "freeflight_join" });
    await runtime.handle(other, "other", { type: "freeflight_join" });
    runtime.advance(Date.now() + 100);
    assert.ok(first.packets.some(p => p.type === "freeflight_salvage" && p.packages[0]?.recoverable === true));
    assert.ok(other.packets.some(p => p.type === "freeflight_salvage" && p.packages[0]?.recoverable === false));
    await runtime.handle(other, "other", request);
    assert.equal(other.packets.at(-1)?.reason, "freeflight_salvage_out_of_reach");
    await runtime.handle(first, "pilot", { ...request, ownerUserId: "pilot" });
    assert.equal(first.packets.at(-1)?.reason, "invalid_freeflight_salvage");
    const pending = runtime.handle(first, "pilot", request);
    await new Promise<void>(resolve => setImmediate(resolve));
    await runtime.handle(first, "pilot", request);
    assert.equal(first.packets.at(-1)?.reason, "freeflight_rate_limited");
    finish!();
    await pending;
    assert.equal(claims, 1);
    assert.ok(first.packets.some(p => p.type === "freeflight_salvage_recovered"));
    assert.equal(saved!.wreckPackages![0]!.status, "recovered");
    await runtime.close();
    runtime = makeRuntime();
    await runtime.handle(first, "pilot", { type: "freeflight_join" });
    runtime.advance(Date.now() + 100);
    const latest = first.packets.filter(p => p.type === "freeflight_salvage").at(-1);
    assert.deepEqual(latest?.packages, [], "a recovered crate stays gone after owner restart");
  } finally { finish?.(); await runtime.close(); }
});
