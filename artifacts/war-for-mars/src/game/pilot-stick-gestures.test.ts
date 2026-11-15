import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_DOUBLE_TAP_STATE,
  isQuickStickTap,
  mapFlightStickAxes,
  registerStickTap,
  stickSectorAt,
} from "./pilot-stick-gestures";

test("outer stick zones classify four maneuver directions and ignore the neutral center", () => {
  assert.equal(stickSectorAt(50, 50, 100, 100), null);
  assert.equal(stickSectorAt(50, 5, 100, 100), "up");
  assert.equal(stickSectorAt(50, 95, 100, 100), "down");
  assert.equal(stickSectorAt(5, 50, 100, 100), "left");
  assert.equal(stickSectorAt(95, 50, 100, 100), "right");
  assert.equal(stickSectorAt(0, 0, 0, 100), null);
});

test("dragging, long presses and center taps cannot trigger double-tap maneuvers", () => {
  assert.equal(isQuickStickTap(120, 8, "up"), true);
  assert.equal(isQuickStickTap(120, 12, "up"), false);
  assert.equal(isQuickStickTap(186, 2, "up"), false);
  assert.equal(isQuickStickTap(80, 2, null), false);
});

test("only two quick taps in the same sector trigger its short vector maneuver", () => {
  const first = registerStickTap(EMPTY_DOUBLE_TAP_STATE, "up", 100);
  assert.equal(first.pulse, null);
  const second = registerStickTap(first.state, "up", 350);
  assert.deepEqual(second.pulse, { axis: "vertical", direction: 1 });

  const down = registerStickTap(second.state, "down", 800);
  assert.equal(registerStickTap(down.state, "up", 900).pulse, null);
  const late = registerStickTap(down.state, "down", 1200);
  assert.equal(late.pulse, null);
});

test("tap interval, retrigger cooldown and sector mismatch are enforced", () => {
  const first = registerStickTap(EMPTY_DOUBLE_TAP_STATE, "left", 0);
  assert.equal(registerStickTap(first.state, "left", 40).pulse, null);
  const second = registerStickTap(first.state, "left", 100);
  assert.deepEqual(second.pulse, { axis: "strafe", direction: -1 });
  assert.equal(registerStickTap(second.state, "left", 200).pulse, null);
  const tooLate = registerStickTap(first.state, "left", 400);
  assert.equal(tooLate.pulse, null);
});

test("left-stick analog axes map to pitch, yaw and coordinated bank", () => {
  assert.deepEqual(mapFlightStickAxes(-0.8, -0.5), { yaw: -0.8, pitch: 0.5, roll: -0.336 });
  assert.deepEqual(mapFlightStickAxes(2, Number.NaN), { yaw: 1, pitch: 0, roll: 0.42 });
});
