import assert from "node:assert/strict";
import test from "node:test";
import { newFlight, type FreeFlightSnapshotV1, type SpatialCraft } from "@workspace/orbital-sim";
import { reconcileFreeFlightKinematics } from "./free-flight-prediction";
const pilot = (): SpatialCraft => ({
  id: 1, x: 42, z: 80, yaw: 0, pitch: 0, speed: 0, steer: 0,
  hull: 50, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
  cloak: 0, untargetable: 0, radius: 1, lockTargetId: null, space: newFlight(),
});
const snapshot = (yaw: number): FreeFlightSnapshotV1 => ({
  protocol: "orbital-freeflight-v1", rulesVersion: 5, sessionInstanceId: "test",
  tick: 1, serverTime: 1, ownActorId: "pilot",
  actors: [{
    actorId: "pilot", own: true, kind: "pilot", faction: "ussf",
    shipId: "glide", callsign: "YOU",
    position: { x: -100, y: 0, z: -200 }, velocity: { x: -10, y: 0, z: 0 },
    orientation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
    yaw, pitch: 0, speed: 10, hull: 100, hullMax: 100, shield: 20, shieldMax: 20, alive: true,
  }],
});
test("join restores authoritative facing and velocity without teleporting or healing", () => {
  const craft = pilot();
  assert.equal(reconcileFreeFlightKinematics(craft, snapshot(Math.PI / 2), true), true);
  assert.ok(Math.abs(craft.yaw - Math.PI / 2) < 1e-6);
  assert.equal(craft.space!.vx, -10);
  assert.equal(craft.x, 42);
  assert.equal(craft.z, 80);
  assert.equal(craft.hull, 50);
});
test("snapshot corrections converge over the shortest quaternion arc and reject other seats", () => {
  const craft = pilot();
  craft.space = newFlight(Math.PI - 0.01);
  for (let i = 0; i < 8; i++) reconcileFreeFlightKinematics(craft, snapshot(-Math.PI + 0.01), false);
  assert.ok(Math.abs(craft.yaw - (-Math.PI + 0.01)) < 0.001);
  const invalid = snapshot(0);
  invalid.actors[0]!.own = false;
  assert.equal(reconcileFreeFlightKinematics(craft, invalid, true), false);
});
