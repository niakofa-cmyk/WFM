import assert from "node:assert/strict";
import test from "node:test";
import { createBus, pulseVectorManeuver, readInput } from "./input";

test("offline Orbital left-stick axes match Rust Disc steering, pitch, and coordinated bank", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftX = 0.6;
  bus.leftY = -0.4;

  const input = readInput(bus);
  assert.equal(input.yaw, -0.6);
  assert.equal(input.pitch, 0.4);
  assert.equal(input.roll, -0.6 * 0.42);
  assert.ok(Math.abs(input.strafe) < Number.EPSILON);
  assert.ok(Math.abs(input.vertical) < Number.EPSILON);
});

test("Orbital stick double-tap pulses thrust without changing the Rust Disc steering axes", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  bus.leftX = 0.25;
  bus.leftY = -0.5;
  pulseVectorManeuver(bus, { axis: "vertical", direction: 1 });
  const input = readInput(bus);

  assert.equal(input.yaw, -0.25);
  assert.equal(input.pitch, 0.5);
  assert.equal(input.vertical, 1);
  assert.ok(Math.abs(input.strafe) < Number.EPSILON);
});

test("Orbital countermeasure button is consumed as one action pulse", () => {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.countermeasureEnabled = true;
  bus.countermeasurePulse = true;
  assert.equal(readInput(bus).countermeasure, true);
  assert.equal(readInput(bus).countermeasure, false);
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
