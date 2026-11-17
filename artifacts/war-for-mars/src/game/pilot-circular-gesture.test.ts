import assert from "node:assert/strict";
import test from "node:test";
import {
  CIRCULAR_ROLL_ARM_SWEEP_RADIANS,
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
  }
  return update;
}

test("a clockwise arc starts live roll before a full circle and tracks the thumb", () => {
  let tracker = createCircularGestureTracker(100, 100, 0, 11, 34);
  let update = updateCircularGesture(tracker, 124, 100, 0);
  tracker = update.tracker;
  for (let i = 1; i <= 4; i++) {
    const angle = Math.PI * 2 * i / 24;
    update = updateCircularGesture(tracker, 100 + Math.cos(angle) * 24, 100 + Math.sin(angle) * 24, i * 25);
    tracker = update.tracker;
  }
  assert.equal(update.rolling, true, "a deliberate 60-degree arc should engage before a complete loop");
  assert.equal(update.direction, "clockwise");
  assert.ok(update.rollInput < 0, "clockwise screen motion must drive a visible right roll immediately");

  for (let i = 5; i <= 24; i++) {
    const angle = Math.PI * 2 * i / 24;
    update = updateCircularGesture(tracker, 100 + Math.cos(angle) * 24, 100 + Math.sin(angle) * 24, i * 25);
    tracker = update.tracker;
  }
  assert.equal(update.rolling, true, "a completed circle does not queue a second roll or end live control");
  assert.ok(update.progress > 0.99);
});

test("a counterclockwise circle produces live left-roll input", () => {
  const update = drawCircle(-1);
  assert.equal(update.rolling, true);
  assert.equal(update.direction, "counterclockwise");
  assert.ok(update.rollInput > 0, "counterclockwise screen motion must drive a visible left roll");
});

test("a slow loop around the visible stick center stays live in either direction", () => {
  const clockwise = drawJoystickLoop(1);
  assert.equal(clockwise.rolling, true);
  assert.equal(clockwise.direction, "clockwise");
  const counterclockwise = drawJoystickLoop(-1);
  assert.equal(counterclockwise.rolling, true);
  assert.equal(counterclockwise.direction, "counterclockwise");
});

test("live loops work at the real mobile stick edge in compact and landscape sizes", () => {
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
    }
    assert.equal(update.rolling, true, `${size}px stick loop should engage and stay live`);
    assert.equal(update.rejected, false);
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
    if (update.rejected) break;
  }
  assert.equal(update.rejected, false);
  assert.equal(update.rolling, true);
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
    if (update.rejected) break;
  }
  assert.equal(update.rejected, false);
  assert.equal(update.rolling, true);
});

test("ordinary aim arcs do not arm roll before a deliberate circular sweep", () => {
  let tracker = createCircularGestureTracker(0, 0, 0, 11, 34);
  let update = updateCircularGesture(tracker, 24, 0, 0);
  tracker = update.tracker;
  for (let i = 1; i <= 1; i++) {
    const angle = Math.PI / 6 * i;
    update = updateCircularGesture(tracker, Math.cos(angle) * 24, Math.sin(angle) * 24, i * 30);
    tracker = update.tracker;
  }
  assert.ok(Math.abs(tracker.sweepRadians) < CIRCULAR_ROLL_ARM_SWEEP_RADIANS);
  assert.equal(update.rolling, false);
  assert.equal(update.rollInput, 0);
});

test("undersized circles are ignored and oversized circles are rejected", () => {
  let tooSmall = createCircularGestureTracker(0, 0, 0, 11, 34);
  for (let i = 0; i <= 16; i++) {
    const angle = Math.PI * 2 * i / 16;
    tooSmall = updateCircularGesture(tooSmall, Math.cos(angle) * 8, Math.sin(angle) * 8, i * 30).tracker;
  }
  assert.equal(tooSmall.rolling, false);
  assert.equal(tooSmall.rejected, false);

  const tooLarge = updateCircularGesture(
    createCircularGestureTracker(0, 0, 0, 11, 34),
    35,
    0,
    30,
  );
  assert.equal(tooLarge.rejected, true);
});

test("direction reversals before roll engagement, discontinuous jumps, and expired loops are rejected", () => {
  let tracker = createCircularGestureTracker(0, 0, 0, 11, 34);
  tracker = updateCircularGesture(tracker, 24, 0, 0).tracker;
  tracker = updateCircularGesture(tracker, 0, 24, 80).tracker;
  const reversal = updateCircularGesture(tracker, 24, 0, 120);
  assert.equal(reversal.rejected, true);

  let liveTracker = createCircularGestureTracker(0, 0, 0, 11, 34);
  const points = [0, 30, 60, 90].map((degrees) => degrees * Math.PI / 180);
  let liveUpdate = updateCircularGesture(liveTracker, 24, 0, 0);
  liveTracker = liveUpdate.tracker;
  for (let i = 1; i < points.length; i++) {
    liveUpdate = updateCircularGesture(liveTracker, Math.cos(points[i]!) * 24, Math.sin(points[i]!) * 24, i * 100);
    liveTracker = liveUpdate.tracker;
  }
  assert.equal(liveUpdate.rolling, true);
  liveUpdate = updateCircularGesture(liveTracker, Math.cos(Math.PI / 3) * 24, Math.sin(Math.PI / 3) * 24, 400);
  assert.equal(liveUpdate.rejected, false);
  assert.equal(liveUpdate.direction, "counterclockwise");
  assert.ok(liveUpdate.rollInput > 0, "the pilot can reverse into a visible left roll during the gesture");

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
