import assert from "node:assert/strict";
import test from "node:test";
import {
  CIRCULAR_ROLL_MIN_SWEEP_RADIANS,
  createCircularGestureTracker,
  updateCircularGesture,
} from "./pilot-circular-gesture";

function drawCircle(direction: 1 | -1, radius = 24, points = 24) {
  let tracker = createCircularGestureTracker(100, 100, 0, 11, 34);
  let update = updateCircularGesture(tracker, 100 + radius, 100, 0);
  tracker = update.tracker;
  for (let i = 1; i <= points; i++) {
    const angle = direction * (Math.PI * 2 * i / points);
    update = updateCircularGesture(
      tracker,
      100 + Math.cos(angle) * radius,
      100 + Math.sin(angle) * radius,
      i * 25,
    );
    tracker = update.tracker;
    if (update.completed) return update;
  }
  return update;
}

function drawJoystickLoop(direction: 1 | -1, durationMs = 1_800, points = 24) {
  const centerX = 100;
  const centerY = 100;
  const radius = 30;
  let tracker = createCircularGestureTracker(centerX, centerY, 0, 11, 34);
  let update = updateCircularGesture(
    tracker,
    centerX + radius,
    centerY,
    0,
  );
  tracker = update.tracker;
  for (let i = 1; i <= points; i++) {
    const angle = direction * (Math.PI * 2 * i / points);
    update = updateCircularGesture(
      tracker,
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
      Math.round(durationMs * i / points),
    );
    tracker = update.tracker;
    if (update.completed) return update;
  }
  return update;
}

test("a full clockwise circle emits one right-roll command", () => {
  const completed = drawCircle(1);
  assert.equal(completed.completed, "clockwise");
  assert.equal(completed.direction, "clockwise");
  assert.ok(completed.progress >= 1);
  assert.equal(updateCircularGesture(completed.tracker, 124, 100, 700).completed, null);
});

test("a full counterclockwise circle emits one left-roll command", () => {
  assert.equal(drawCircle(-1).completed, "counterclockwise");
});

test("a slow loop around the visible stick center completes from its edge", () => {
  const clockwise = drawJoystickLoop(1);
  assert.equal(clockwise.completed, "clockwise");
  assert.equal(drawJoystickLoop(-1).completed, "counterclockwise");
});

test("incomplete, undersized, and oversized circles are rejected", () => {
  let incomplete = createCircularGestureTracker(0, 0, 0, 11, 34);
  for (let i = 0; i <= 5; i++) {
    const angle = Math.PI * 2 * i / 16;
    incomplete = updateCircularGesture(incomplete, Math.cos(angle) * 24, Math.sin(angle) * 24, i * 40).tracker;
  }
  assert.ok(Math.abs(incomplete.sweepRadians) < CIRCULAR_ROLL_MIN_SWEEP_RADIANS);
  assert.equal(incomplete.completed, false);

  let tooSmall = createCircularGestureTracker(0, 0, 0, 11, 34);
  for (let i = 0; i <= 16; i++) {
    const angle = Math.PI * 2 * i / 16;
    tooSmall = updateCircularGesture(tooSmall, Math.cos(angle) * 8, Math.sin(angle) * 8, i * 30).tracker;
  }
  assert.equal(tooSmall.completed, false);
  assert.equal(tooSmall.rejected, false);

  const tooLarge = updateCircularGesture(
    createCircularGestureTracker(0, 0, 0, 11, 34),
    35,
    0,
    30,
  );
  assert.equal(tooLarge.rejected, true);
});

test("direction reversals, discontinuous jumps, and gestures over three seconds cannot complete", () => {
  let tracker = createCircularGestureTracker(0, 0, 0, 11, 34);
  tracker = updateCircularGesture(tracker, 24, 0, 0).tracker;
  tracker = updateCircularGesture(tracker, 0, 24, 80).tracker;
  const reversal = updateCircularGesture(tracker, 24, 0, 120);
  assert.equal(reversal.rejected, true);

  let jumpTracker = createCircularGestureTracker(0, 0, 0, 11, 34);
  jumpTracker = updateCircularGesture(jumpTracker, 24, 0, 0).tracker;
  const jump = updateCircularGesture(
    jumpTracker,
    -24,
    0,
    30,
  );
  assert.equal(jump.rejected, true);

  const expired = updateCircularGesture(
    createCircularGestureTracker(0, 0, 0, 11, 34),
    24,
    0,
    3_001,
  );
  assert.equal(expired.rejected, true);
});

test("non-finite pointer samples reject safely", () => {
  const initial = createCircularGestureTracker(0, 0, 0, 11, 34);
  assert.equal(updateCircularGesture(initial, Number.NaN, 0, 10).rejected, true);
});
