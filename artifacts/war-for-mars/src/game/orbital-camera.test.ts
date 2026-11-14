import assert from "node:assert/strict";
import test from "node:test";
import { orbitalCameraFov, orbitalCameraPose } from "./orbital-camera";
import { rotate } from "./orbital-flight";

test("positive local Z roll moves the hull top toward screen-left from the chase view", () => {
  const angle = Math.PI / 12;
  const up = rotate([0, 0, Math.sin(angle), Math.cos(angle)], 0, 1, 0);
  assert.ok(up.x < 0);
  assert.ok(up.y > 0);
});

test("orbital camera stays horizon-stable through the middle of a barrel roll", () => {
  const upright = orbitalCameraPose([0, 0, 0, 1], false, 0);
  const inverted = orbitalCameraPose([0, 0, 1, 0], false, 0);
  const stabilized = orbitalCameraPose([0, 0, 1, 0], false, 1);

  assert.notDeepEqual(inverted.offset, upright.offset, "the ship-follow camera normally banks with the craft");
  assert.deepEqual(stabilized.offset, upright.offset);
  assert.deepEqual(stabilized.ahead, upright.ahead);
  assert.deepEqual(stabilized.up, { x: 0, y: 1, z: 0 });
});

test("orbital camera keeps a valid up vector when the ship points vertically", () => {
  const pose = orbitalCameraPose([Math.SQRT1_2, 0, 0, Math.SQRT1_2], false, 1);
  const length = Math.hypot(pose.up.x, pose.up.y, pose.up.z);
  assert.ok(Math.abs(length - 1) < 1e-12);
  assert.ok(Number.isFinite(pose.offset.x + pose.offset.y + pose.offset.z));
  assert.ok(Number.isFinite(pose.ahead.x + pose.ahead.y + pose.ahead.z));
});

test("compact-layout chase framing matches the selected baseline without changing cockpit framing", () => {
  const chase = orbitalCameraPose([0, 0, 0, 1], false, 1);
  const cockpit = orbitalCameraPose([0, 0, 0, 1], true, 1);
  assert.deepEqual(chase.offset, { x: 0, y: 5, z: 21 });
  assert.deepEqual(chase.ahead, { x: 0, y: 1.1, z: -31 });
  assert.equal(Math.hypot(cockpit.offset.x, cockpit.offset.y, cockpit.offset.z), Math.hypot(1.2, 0.65));
  assert.equal(Math.hypot(cockpit.ahead.x, cockpit.ahead.y, cockpit.ahead.z), Math.hypot(1.2, 40));
});

test("Orbital keeps the selected compact-layout horizontal field across phone aspect ratios", () => {
  const referenceAspect = 16 / 9;
  const referenceFov = 58;
  const horizontalFov = (verticalFov: number, aspect: number) =>
    2 * Math.atan(Math.tan((verticalFov * Math.PI) / 360) * aspect);
  const referenceHorizontal = horizontalFov(referenceFov, referenceAspect);

  assert.equal(orbitalCameraFov(referenceAspect), referenceFov);
  for (const aspect of [1.6, 16 / 9, 2.22, 2.4]) {
    const result = horizontalFov(orbitalCameraFov(aspect), aspect);
    assert.ok(Math.abs(result - referenceHorizontal) < 1e-12, `horizontal FOV should match at aspect ${aspect}`);
  }
});

test("Orbital camera FOV is finite and bounded for unusual viewport sizes", () => {
  for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(orbitalCameraFov(aspect), 58);
  }
  assert.equal(orbitalCameraFov(0.5), 74);
  assert.equal(orbitalCameraFov(12), 38);
});
