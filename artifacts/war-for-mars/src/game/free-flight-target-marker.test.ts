import assert from "node:assert/strict";
import test from "node:test";
import { targetMarkerPlacement } from "./free-flight-target-marker";

test("selected target marker follows its projected screen position", () => {
  assert.deepEqual(targetMarkerPlacement({ x: 0.5, y: 0.25, z: 0 }, 1000, 600), {
    visible: true, edge: false, left: 750, top: 225, angleDegrees: 0,
  });
});

test("off-screen and behind-camera target markers clamp to the edge and keep a bearing", () => {
  const right = targetMarkerPlacement({ x: 2, y: 0, z: 0 }, 1000, 600);
  assert.equal(right.visible, true);
  assert.equal(right.edge, true);
  assert.equal(right.left, 958);
  assert.ok(Math.abs(right.top - 300) < 1);
  assert.ok(Math.abs(right.angleDegrees) < 1e-6);
  const behind = targetMarkerPlacement({ x: 0.2, y: 0.1, z: 1.1 }, 1000, 600);
  assert.equal(behind.edge, true);
  assert.ok(behind.left >= 42 && behind.left <= 958);
  assert.ok(behind.top >= 42 && behind.top <= 558);
});

test("invalid projection values hide the target indicator safely", () => {
  assert.equal(targetMarkerPlacement({ x: Number.NaN, y: 0, z: 0 }, 1000, 600).visible, false);
  assert.equal(targetMarkerPlacement({ x: 0, y: 0, z: 0 }, 50, 60).visible, false);
});
