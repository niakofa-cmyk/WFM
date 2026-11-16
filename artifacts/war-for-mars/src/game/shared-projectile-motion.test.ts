import assert from "node:assert/strict";
import test from "node:test";
import { isProjectileMotionSnapshot, MAX_PROJECTILE_MOTION_SAMPLES, type ProjectileMotionSnapshot } from "@workspace/orbital-sim";
import { createSharedProjectileMotion, clipProjectileTrail, MAX_PROJECTILE_TRAIL_POINTS } from "./shared-projectile-motion";
import { sharedPointInLocalFrame } from "./free-flight-reference-frame";
import { ORIGIN_SECTOR } from "./universe-sectors";

const id = "shared:projectile:42";
function report(tick: number, x: number, y = 0): ProjectileMotionSnapshot {
  return { protocol: 1, sessionInstanceId: "shared", tick, projectiles: [{
    eventId: id, sourceFaction: "accord", visualEffect: "swarm", missile: true,
    position: { x, y, z: -tick }, previousPosition: { x: x - 1, y, z: -tick + 1 },
    velocity: { x: 90, y: 0, z: -90 }, remainingSeconds: 5,
  }] };
}

test("motion protocol rejects hidden payloads, duplicate IDs, foreign IDs and over-budget frames", () => {
  const value = report(3, 10);
  assert.equal(isProjectileMotionSnapshot(value), true);
  for (const bad of [
    { ...value, tick: NaN }, { ...value, protocol: 2 }, { ...value, rewards: 30 },
    { ...value, projectiles: [value.projectiles[0], value.projectiles[0]] },
    { ...value, projectiles: [{ ...value.projectiles[0], eventId: "other:projectile:42" }] },
    { ...value, projectiles: [{ ...value.projectiles[0], position: { x: Infinity, y: 0, z: 0 } }] },
    { ...value, projectiles: [{ ...value.projectiles[0], velocity: { x: 1e9, y: 0, z: 0 } }] },
    { ...value, projectiles: Array.from({ length: MAX_PROJECTILE_MOTION_SAMPLES + 1 },
      (_, i) => ({ ...value.projectiles[0], eventId: `shared:projectile:${i}` })) },
  ]) assert.equal(isProjectileMotionSnapshot(bad), false);
});

test("two viewers follow the confirmed curve and end exactly at the same server contact", () => {
  const a = createSharedProjectileMotion(), b = createSharedProjectileMotion();
  for (const [tick, x, y, now] of [[3, 10, 0, 100], [6, 16, 3, 200], [9, 18, 10, 300]]) {
    assert.ok(a.accept(report(tick!, x!, y), "shared", now!));
    assert.ok(b.accept(report(tick!, x!, y), "shared", now! + 17));
  }
  const path = a.path(id, 400)!;
  assert.ok(path.length > 2);
  assert.ok(new Set(path.map(p => p.y)).size > 1, "curve is not launch-velocity extrapolation");
  assert.deepEqual(path.at(-1), report(9, 18, 10).projectiles[0]!.position);
  // Even a later frame cannot fly beyond the last authoritative sample.
  assert.deepEqual(a.path(id, 600)?.at(-1), path.at(-1));
  assert.equal(a.path(id, 651), null, "stale stream hides instead of simulating another missile");
  const contact = { x: 20, y: 12, z: -11 };
  assert.equal(a.contact(id, contact, 410), true);
  assert.equal(b.contact(id, contact, 427), true);
  assert.deepEqual(a.path(id, 420)?.at(-1), contact);
  assert.deepEqual(b.path(id, 437)?.at(-1), contact);
  assert.equal(a.contact(id, contact, 430), false);
  assert.equal(a.path(id, 691), null);
  // Both presentations project the same absolute contact, not the target mesh.
  assert.deepEqual(sharedPointInLocalFrame(contact, ORIGIN_SECTOR),
    sharedPointInLocalFrame(b.path(id, 437)!.at(-1)!, ORIGIN_SECTOR));
  const farSector = { x: "1", y: ORIGIN_SECTOR.y, z: ORIGIN_SECTOR.z };
  const local = sharedPointInLocalFrame(contact, ORIGIN_SECTOR)!;
  const rebased = sharedPointInLocalFrame(contact, farSector)!;
  assert.notDeepEqual(local, rebased);
  assert.deepEqual(sharedPointInLocalFrame(b.path(id, 437)!.at(-1)!, farSector), rebased);
});

test("late launches/motion cannot resurrect a confirmed contact; other sessions and old ticks are rejected", () => {
  const buffer = createSharedProjectileMotion();
  buffer.contact(id, { x: 1, y: 2, z: 3 }, 0);
  buffer.accept(report(3, 10), "shared", 10);
  assert.equal(buffer.size, 0);
  assert.equal(buffer.hasEnded(id), true);
  assert.equal(buffer.accept(report(3, 10), "shared", 20), null);
  assert.equal(buffer.accept({ ...report(6, 14), sessionInstanceId: "foreign" }, "shared", 20), null);
  buffer.clear();
  assert.ok(buffer.accept(report(3, 10), "shared", 30));
  assert.equal(buffer.size, 1);
  assert.ok(buffer.accept({ ...report(6, 14), projectiles: [] }, "shared", 40));
  assert.equal(buffer.path(id, 40), null, "outside-interest projectiles disappear");
  buffer.clear();
  assert.equal(buffer.hasEnded(id), false);
});

test("projectile history and visible trail length remain bounded", () => {
  const buffer = createSharedProjectileMotion();
  for (let i = 1; i <= 200; i++) buffer.accept(report(i * 3, i), "shared", i * 100);
  const points = buffer.path(id, 20100)!;
  assert.ok(points.length <= MAX_PROJECTILE_TRAIL_POINTS);
  const clipped = clipProjectileTrail(points, 5);
  const length = clipped.slice(1).reduce((n, p, i) => n + Math.hypot(
    p.x - clipped[i]!.x, p.y - clipped[i]!.y, p.z - clipped[i]!.z), 0);
  assert.ok(length <= 5.000001);
  assert.deepEqual(clipped.at(-1), points.at(-1));
});
