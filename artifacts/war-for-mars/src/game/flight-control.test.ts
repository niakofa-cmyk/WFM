import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFlightControls, neutralFlightControls, toOrbitalStepInput, toSectorFlightInput } from "./flight-control";

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
  const sector = toSectorFlightInput({
    throttle: -0.6, yaw: 0.2, strafe: -0.4, vertical: 0.7,
    fire: true, missile: true, countermeasure: true,
  });
  assert.equal(sector.throttle, 0);
  assert.equal(sector.brake, true);
  assert.equal(sector.strafe, -0.4);
  assert.equal(sector.vertical, 0.7);
  assert.equal(sector.fire, true);
  assert.equal(sector.missile, true);
  assert.equal(sector.countermeasure, true);

  const orbital = toOrbitalStepInput({
    throttle: -0.5, yaw: 0.2, roll: -0.3, strafe: 0.6, vertical: 0.4,
    boost: true, brake: true, drift: true, inertial: true, missile: true, aimAssist: true,
  });
  assert.equal(orbital.throttle, -0.5);
  assert.equal(orbital.strafe, 0.6);
  assert.equal(orbital.vertical, 0.4);
  assert.equal(orbital.drift, true);
  assert.equal(orbital.inertial, true);
  assert.equal(orbital.missile, true);
  assert.equal(orbital.aimAssist, true);
});
