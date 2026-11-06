import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFlightControls, neutralFlightControls, toOrbitalPilotStepInput, toOrbitalStepInput, toSectorFlightInput } from "./flight-control";

test("shared flight controls clamp axes and reject non-finite input", () => {
  const controls = normalizeFlightControls({
    throttle: Number.NaN, yaw: 2, pitch: -4, strafe: 0.45, vertical: -0.3,
  });
  assert.equal(controls.throttle, 0);
  assert.equal(controls.yaw, 1);
  assert.equal(controls.pitch, -1);
  assert.equal(controls.strafe, 0.45);
  assert.equal(controls.vertical, -0.3);
  assert.deepEqual(neutralFlightControls(0.35).throttle, 0.35);
});

test("mode adapters preserve compatible controls and make unsupported legacy behavior explicit", () => {
  const maneuver = { version: 1 as const, kind: "barrel-roll" as const, direction: "right" as const };
  const sector = toSectorFlightInput({
    throttle: -0.6, yaw: 0.2, strafe: -0.4, vertical: 0.7,
    fire: true, missile: true, countermeasure: true, maneuver,
  });
  assert.equal(sector.throttle, 0);
  assert.equal(sector.brake, true);
  assert.equal(sector.strafe, -0.4);
  assert.equal(sector.vertical, 0.7);
  assert.equal(sector.fire, true);
  assert.equal(sector.missile, true);
  assert.equal(sector.countermeasure, true);
  assert.equal("maneuver" in sector, false);

  const orbital = toOrbitalStepInput({
    throttle: -0.5, yaw: 0.2, roll: -0.3, strafe: 0.6, vertical: 0.4,
    boost: true, brake: true, drift: true, inertial: true, missile: true, aimAssist: true, maneuver,
  });
  assert.equal(orbital.throttle, -0.5);
  assert.equal(orbital.yaw, 0.2);
  assert.equal(orbital.roll, -0.3);
  assert.equal(orbital.strafe, 0.6);
  assert.equal(orbital.vertical, 0.4);
  assert.equal(orbital.drift, true);
  assert.equal(orbital.inertial, true);
  assert.equal(orbital.missile, true);
  assert.equal(orbital.aimAssist, true);
  assert.deepEqual(orbital.maneuver, maneuver);
});

test("Rust Disc pilot convention is adapted only at the canonical Orbital control boundary", () => {
  const orbital = toOrbitalPilotStepInput({
    throttle: 0.5, yaw: 0.2, pitch: -0.4, roll: 0.3, strafe: 0.6, vertical: 0.7,
  });
  assert.equal(orbital.yaw, -0.2);
  assert.equal(orbital.pitch, -0.4);
  assert.equal(orbital.roll, -0.3);
  assert.equal(orbital.strafe, -0.6);
  assert.equal(orbital.vertical, 0.7);
});

test("live barrel-roll control is bounded for Orbital and stripped from sector authority", () => {
  const maneuver = {
    version: 1 as const,
    kind: "barrel-roll-control" as const,
    input: 2,
  };
  const orbital = toOrbitalStepInput({ throttle: 0.5, maneuver });
  assert.deepEqual(orbital.maneuver, { ...maneuver, input: 1 });
  const sector = toSectorFlightInput({ throttle: 0.5, maneuver });
  assert.equal("maneuver" in sector, false);
});
