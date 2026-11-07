import assert from "node:assert/strict";
import test from "node:test";
import { createFlight, CINDER_ASTEROID_SECTOR, NEUTRAL_FLIGHT_INPUT, stepFlight } from "./flight-sector";
import { evaluateNativeCinderDock, NATIVE_CINDER_DOCK_LIMITS } from "./orbital-native-docking";

function atApproach(distance = NATIVE_CINDER_DOCK_LIMITS.range) {
  const flight = createFlight("duskbreaker");
  flight.position = { x: 0, y: 0, z: -118 + distance };
  return flight;
}

test("native Cinder dock uses the 22 m local station range and matching 4 m/s approach limit", () => {
  const flight = atApproach(22);
  flight.velocity = { x: 0, y: 0, z: -3.6 };
  const gate = evaluateNativeCinderDock(flight);
  assert.equal(gate.reason, "ready");
  assert.equal(gate.eligible, true);
  assert.equal(gate.distance, 22);
  assert.equal(gate.speed, 3.6);
});

test("a slow forward-flight trace can reach the rendered station without colliding with sector rocks", () => {
  const flight = createFlight("duskbreaker", CINDER_ASTEROID_SECTOR);
  let braking = false;
  for (let tick = 0; tick < 6000; tick++) {
    const range = Math.hypot(flight.position.x, flight.position.y, flight.position.z + 118);
    if (range <= NATIVE_CINDER_DOCK_LIMITS.range) braking = true;
    stepFlight(flight, { ...NEUTRAL_FLIGHT_INPUT, throttle: braking ? 0 : .08, brake: braking }, 1 / 30, CINDER_ASTEROID_SECTOR);
    if (braking && Math.hypot(flight.velocity.x, flight.velocity.y, flight.velocity.z) < .1) break;
  }
  assert.equal(flight.collisions, 0);
  assert.equal(evaluateNativeCinderDock(flight).eligible, true);
});

test("native Cinder docking rejects range, speed, and nose alignment independently", () => {
  assert.equal(evaluateNativeCinderDock(atApproach(22.01)).reason, "range");

  const fast = atApproach();
  fast.velocity = { x: 0, y: 0, z: -4.01 };
  assert.equal(evaluateNativeCinderDock(fast).reason, "closure");

  const misaligned = atApproach();
  misaligned.orientation = { x: 0, y: 1, z: 0, w: 0 };
  assert.equal(evaluateNativeCinderDock(misaligned).reason, "heading");
});

test("destroyed or non-finite native flight cannot dock", () => {
  const destroyed = atApproach();
  destroyed.stage = "destroyed";
  assert.equal(evaluateNativeCinderDock(destroyed).reason, "inactive");

  const invalid = atApproach();
  invalid.position.x = Number.NaN;
  assert.equal(evaluateNativeCinderDock(invalid).reason, "inactive");
});
