import assert from "node:assert/strict";
import test from "node:test";
import { createMountedFireQueue, MAX_PENDING_MOUNT_FIRES, MAX_SEEN_MOUNT_FIRES, MOUNT_FIRE_MAX_AGE_MS } from "./mounted-armament-fire-events";
import { createMountedArmamentVisuals } from "./mounted-armament-visuals";
import { buildOrbitalShip } from "./orbital-visuals";

const shot = (id = 1, actorId = "pilot:one", weaponId = "railgun") =>
  ({ type: "freeflight_weapon_fired", eventId: `session:${id}`, sourceActorId: actorId, weaponId });

test("only live launch packets queue mounts; snapshot recovery, wrong sessions and duplicate launches do not", () => {
  const queue = createMountedFireQueue();
  assert.equal(queue.accept(shot(), "session", 1000), true);
  assert.equal(queue.accept(shot(), "session", 1001), false);
  for (const invalid of [
    { ...shot(2), type: "freeflight_projectile_motion" }, { ...shot(3), type: "freeflight_armament_snapshot" },
    { ...shot(4), eventId: "other:4" }, { ...shot(5), weaponId: "unknown" },
    { ...shot(6), weaponId: "sensors" }, { ...shot(7), sourceActorId: "" },
  ]) assert.equal(queue.accept(invalid, "session", 1000), false);
  assert.equal(queue.accept(shot(8), "session", NaN), false);
  const fired: string[] = [];
  queue.process(1010, "session", event => { fired.push(event.eventId); return true; });
  queue.process(1020, "session", () => { throw Error("duplicate launch"); });
  assert.deepEqual(fired, ["session:1"]);
  assert.equal(queue.accept(shot(), "session", 1030), false);
  queue.accept(shot(9), "session", 1040);
  queue.process(1050, "new-session", () => { throw Error("old universe launch"); });
  assert.equal(queue.pendingCount, 0);
  queue.clear();
  assert.equal(queue.seenCount, 0);
});

test("mount events wait briefly for appearance, expire without flashes and stay bounded under volleys", () => {
  const queue = createMountedFireQueue();
  queue.accept(shot(), "session", 1000);
  queue.process(1050, "session", () => false);
  assert.equal(queue.pendingCount, 1);
  queue.process(1001 + MOUNT_FIRE_MAX_AGE_MS, "session", () => { throw Error("stale flash"); });
  assert.equal(queue.pendingCount, 0);
  for (let i = 2; i < 1000; i++) queue.accept(shot(i), "session", 2000);
  assert.equal(queue.pendingCount, MAX_PENDING_MOUNT_FIRES);
  assert.equal(queue.seenCount, MAX_SEEN_MOUNT_FIRES);
  queue.clear();
  queue.accept(shot(), "session", 1000);
  queue.process(999, "session", () => { throw Error("clock reversal"); });
  assert.equal(queue.pendingCount, 0);
});

test("the own ship and a nearby AI/human ship only animate their own issued weapon from the confirmed source", () => {
  const ownModel = buildOrbitalShip("bastion"), nearbyModel = buildOrbitalShip("mandjet");
  const own = createMountedArmamentVisuals(ownModel, "bastion"), nearby = createMountedArmamentVisuals(nearbyModel, "mandjet");
  own.update({ actorId: "pilot:one", shipId: "bastion", mounts: [{ hardpointId: "primary", equipmentId: "railgun" }] });
  nearby.update({ actorId: "patrol-ship:enemy", shipId: "mandjet", mounts: [{ hardpointId: "primary", equipmentId: "autocannon" }] });
  const queue = createMountedFireQueue();
  queue.accept(shot(), "session", 1000);
  const apply = (now: number) => {
    queue.process(now, "session", event => (event.actorId === "pilot:one" ? own :
      event.actorId === "patrol-ship:enemy" ? nearby : null)?.fire(event.weaponId, event.receivedAt) ?? false);
    own.animate(now); nearby.animate(now);
  };
  const ownFlash = () => own.root!.getObjectByName("mounted-muzzle-flash")!.visible;
  const nearbyFlash = () => nearby.root!.getObjectByName("mounted-muzzle-flash")!.visible;
  apply(1010);
  assert.equal(ownFlash(), true); assert.equal(nearbyFlash(), false);
  queue.accept(shot(2, "patrol-ship:enemy", "autocannon"), "session", 1200);
  queue.accept(shot(3, "unknown-source", "railgun"), "session", 1200);
  queue.accept(shot(4, "pilot:one", "autocannon"), "session", 1200);
  apply(1210);
  assert.equal(ownFlash(), false); assert.equal(nearbyFlash(), true);
  apply(1500);
  assert.equal(ownFlash(), false); assert.equal(nearbyFlash(), false);
  assert.equal(queue.pendingCount, 0);
  own.dispose(); nearby.dispose();
});
