import assert from "node:assert/strict";
import test from "node:test";
import { clearInput, createBus, MAX_CIRCULAR_ROLL_HOLD_MS, pulseVectorManeuver, readInput, readThrottle, setCircularRollControl } from "./input";
import { pulseForSector } from "./pilot-stick-gestures";

test("offline Orbital left stick drives signed forward/reverse throttle and coordinated steering", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftX = 0.6;
  bus.leftY = -0.4;

  const input = readInput(bus);
  assert.equal(input.yaw, -0.6);
  assert.equal(input.throttle, 0.4);
  assert.equal(input.pitch, 0);
  assert.equal(input.roll, -0.6 * 0.42);
  assert.ok(Math.abs(input.strafe) < Number.EPSILON);
  assert.ok(Math.abs(input.vertical) < Number.EPSILON);
});

test("the throttle HUD readout and simulation share the same clamped stick and keyboard input", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftY = -0.45;
  assert.equal(readThrottle(bus), readInput(bus).throttle);
  assert.equal(readThrottle(bus), 0.45);

  bus.leftY = 0.6;
  assert.equal(readThrottle(bus), -0.6);
  assert.equal(readThrottle(bus), readInput(bus).throttle);

  bus.leftY = -0.4;
  bus.keys.add("KeyW");
  assert.equal(readThrottle(bus), 1);
  assert.equal(readThrottle(bus), readInput(bus).throttle);
});

test("Orbital stick double-tap adds vertical thrust independently of stick throttle", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftX = 0.25;
  bus.leftY = -0.5;
  pulseVectorManeuver(bus, { axis: "vertical", direction: 1 });
  const input = readInput(bus);

  assert.equal(input.yaw, -0.25);
  assert.equal(input.throttle, 0.5);
  assert.equal(input.pitch, 0);
  assert.equal(input.vertical, 1);
  assert.ok(Math.abs(input.strafe) < Number.EPSILON);
});

test("dragging the Orbital stick downward commands reverse thrust", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftY = 0.7;

  const input = readInput(bus);
  assert.equal(input.throttle, -0.7);
  assert.equal(input.pitch, 0);
});

test("up-arrow action remains a vertical maneuver, not forward throttle", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.keys.add("KeyC");

  const input = readInput(bus);
  assert.equal(input.vertical, 1);
  assert.equal(input.throttle, 0);
});

test("all four Rust Disc edge double-taps reach the matching Orbital maneuver axis", () => {
  const cases = [
    ["up", 1, 0],
    ["down", -1, 0],
    ["left", 0, 1],
    ["right", 0, -1],
  ] as const;

  for (const [sector, expectedVertical, expectedStrafe] of cases) {
    const bus = createBus("arc");
    bus.orbital = true;
    bus.leftStickFlight = true;
    pulseVectorManeuver(bus, pulseForSector(sector));
    const input = readInput(bus);
    assert.ok(Math.abs(input.vertical - expectedVertical) < Number.EPSILON, `${sector} vertical thrust`);
    assert.ok(Math.abs(input.strafe - expectedStrafe) < Number.EPSILON, `${sector} lateral thrust after adapter sign conversion`);
  }
});

test("circular roll streams live offline Orbital input and expires cleanly", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  setCircularRollControl(bus, 0.76, 1_000, 120);
  assert.deepEqual(readInput(bus, 1_050).maneuver, {
    version: 1,
    kind: "barrel-roll-control",
    input: 0.76,
  });
  assert.equal(readInput(bus, 1_121).maneuver, undefined);
  assert.equal(bus.circularRoll, 0);

  setCircularRollControl(bus, -0.5, 2_000);
  assert.equal(readInput(bus, 2_050).maneuver?.kind, "barrel-roll-control");
  clearInput(bus);
  assert.equal(readInput(bus, 2_060).maneuver, undefined);

  const online = createBus("arc");
  online.orbital = true;
  setCircularRollControl(online, -1, 2_000);
  assert.equal(readInput(online, 2_050).maneuver, undefined);
});

test("Orbital countermeasure button is consumed as one action pulse", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.countermeasureEnabled = true;
  bus.countermeasurePulse = true;
  assert.equal(readInput(bus).countermeasure, true);
  assert.equal(readInput(bus).countermeasure, false);
});

test("circular roll rejects invalid clocks and durations while neutralizing prior input", () => {
  const bus = createBus("arc");
  bus.orbital = bus.leftStickFlight = true;
  for (const [value, at, hold] of [
    [Infinity, 1000, 120], [NaN, 1000, 120],
    [1, Infinity, 120], [1, NaN, 120], [1, -1, 120],
    [1, 1000, Infinity], [1, 1000, NaN], [1, 1000, -1], [1, 1000, 0],
  ]) {
    setCircularRollControl(bus, 1, 1000);
    setCircularRollControl(bus, value, at, hold);
    assert.equal(bus.circularRoll, 0);
    assert.equal(bus.circularRollStartedAt, 0);
    assert.equal(bus.circularRollUntil, 0);
    assert.equal(readInput(bus, 1050).maneuver, undefined);
  }
});

test("circular roll watchdog cannot be extended by oversized holds or malformed bus deadlines", () => {
  const bus = createBus("arc");
  bus.orbital = bus.leftStickFlight = true;
  setCircularRollControl(bus, 8, 1000, 60_000);
  assert.equal(bus.circularRollUntil, 1000 + MAX_CIRCULAR_ROLL_HOLD_MS);
  assert.deepEqual(readInput(bus, 1001).maneuver, { version: 1, kind: "barrel-roll-control", input: 1 });
  assert.equal(readInput(bus, 1120).maneuver, undefined);
  for (const [value, deadline, at] of [[1, Infinity, 1000], [NaN, 1120, 1000], [1, 60_000, 1000], [1, 1120, NaN]]) {
    bus.circularRoll = value;
    bus.circularRollUntil = deadline;
    assert.equal(readInput(bus, at).maneuver, undefined);
    assert.equal(bus.circularRollUntil, 0);
    assert.equal(bus.circularRoll, 0);
  }
});

test("mode changes and backward clock jumps cannot revive a prior circular roll", () => {
  const bus = createBus("arc");
  bus.orbital = bus.leftStickFlight = true;
  setCircularRollControl(bus, 1, 1000);
  assert.equal(readInput(bus, 900).maneuver, undefined);
  setCircularRollControl(bus, 1, 1000, 1);
  assert.equal(readInput(bus, 999).maneuver, undefined);
  setCircularRollControl(bus, 1, 2000);
  bus.leftStickFlight = false;
  setCircularRollControl(bus, 1, 2001);
  bus.leftStickFlight = true;
  assert.equal(readInput(bus, 2050).maneuver, undefined);
});

test("campaign-compatible Orbital input omits the new training-only countermeasure field", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.countermeasurePulse = true;
  assert.equal(readInput(bus).countermeasure, undefined);
});

test("live Wing keeps its existing non-Orbital movement mapping", () => {
  const bus = createBus("arc");
  bus.leftX = 0.5;
  bus.leftY = -0.25;
  const input = readInput(bus);
  assert.equal(input.yaw, -0.5);
  assert.equal(input.strafe, 0);
});
