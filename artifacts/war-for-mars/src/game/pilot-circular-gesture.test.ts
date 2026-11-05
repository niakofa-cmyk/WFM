import assert from "node:assert/strict";
import test from "node:test";
import {
  CIRCULAR_ROLL_MIN_SWEEP_RADIANS,
  circularGestureRadiusBounds,
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

test("full loops complete at the real mobile stick edge in both compact and landscape sizes", () => {
  for (const size of [74, 82, 128]) {
    const { minRadiusPx, maxRadiusPx } = circularGestureRadiusBounds(size, size);
    const center = 100;
    const radius = size * 0.54;
    assert.ok(radius > size / 2, "the gesture may trace just outside the visible stick rim");
    assert.ok(radius <= maxRadiusPx);

    let tracker = createCircularGestureTracker(center, center, 0, minRadiusPx, maxRadiusPx);
    let update = updateCircularGesture(tracker, center + radius, center, 0);
    tracker = update.tracker;
    for (let i = 1; i <= 24; i++) {
      const angle = Math.PI * 2 * i / 24;
      update = updateCircularGesture(
        tracker,
        center + Math.cos(angle) * radius,
        center + Math.sin(angle) * radius,
        i * 25,
      );
      tracker = update.tracker;
      if (update.completed) break;
    }
    assert.equal(update.completed, "clockwise", `${size}px stick loop should not stop at a quarter-turn`);
  }
});

test("starting near the center and expanding the thumb loop does not cancel it", () => {
  const { minRadiusPx, maxRadiusPx } = circularGestureRadiusBounds(84, 84);
  const center = 100;
  let tracker = createCircularGestureTracker(center, center, 0, minRadiusPx, maxRadiusPx);
  const points = [
    [10, 0], [18, 2], [28, 6], [38, 13],
    [42, 24], [36, 37], [24, 42], [10, 39],
    [-5, 41], [-22, 37], [-36, 23], [-42, 7],
    [-39, -12], [-28, -32], [-10, -41], [12, -40],
    [30, -31], [41, -14], [42, 6],
  ] as const;
  let update = updateCircularGesture(tracker, center + points[0]![0], center + points[0]![1], 0);
  tracker = update.tracker;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]!;
    update = updateCircularGesture(tracker, center + x, center + y, i * 35);
    tracker = update.tracker;
    if (update.completed || update.rejected) break;
  }
  assert.equal(update.rejected, false);
  assert.equal(update.completed, "clockwise");
});

test("holding before drawing does not consume the full-loop time window", () => {
  const { minRadiusPx, maxRadiusPx } = circularGestureRadiusBounds(128, 128);
  const center = 100;
  const radius = 54;
  let tracker = createCircularGestureTracker(center, center, 0, minRadiusPx, maxRadiusPx);
  let update = updateCircularGesture(tracker, center + radius, center, 7_000);
  tracker = update.tracker;
  for (let i = 1; i <= 12; i++) {
    const angle = Math.PI * 2 * i / 12;
    update = updateCircularGesture(
      tracker,
      center + Math.cos(angle) * radius,
      center + Math.sin(angle) * radius,
      7_000 + i * 500,
    );
    tracker = update.tracker;
    if (update.completed || update.rejected) break;
  }
  assert.equal(update.rejected, false);
  assert.equal(update.completed, "clockwise");
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

test("direction reversals, discontinuous jumps, and loops over ten seconds are rejected", () => {
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

  let expiredTracker = createCircularGestureTracker(0, 0, 0, 11, 34);
  expiredTracker = updateCircularGesture(expiredTracker, 24, 0, 0).tracker;
  const expired = updateCircularGesture(expiredTracker, 0, 24, 10_001);
  assert.equal(expired.rejected, true);
});

test("non-finite pointer samples reject safely", () => {
  const initial = createCircularGestureTracker(0, 0, 0, 11, 34);
  assert.equal(updateCircularGesture(initial, Number.NaN, 0, 10).rejected, true);
});
