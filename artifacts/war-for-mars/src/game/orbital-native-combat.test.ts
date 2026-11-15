import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCinderSkirmish, NATIVE_CINDER_SKIRMISH_WORLD } from "./orbital-native-combat";
import { CINDER_ASTEROID_SECTOR, NEUTRAL_FLIGHT_INPUT, stepFlight } from "./flight-sector";
import { evaluateNativeCinderDock } from "./orbital-native-docking";

test("Cinder station launches a native drone skirmish inside the approach gate", () => {
  const flight = createNativeCinderSkirmish("duskbreaker");
  assert.equal(flight.stage, "drone");
  assert.deepEqual(flight.position, { x: 0, y: 0, z: -98 });
  assert.deepEqual(flight.drone.position, { x: 0, y: 0, z: -230 });
  assert.equal(flight.drone.hull, 72);
  assert.equal(evaluateNativeCinderDock(flight).eligible, true);
  assert.equal(CINDER_ASTEROID_SECTOR.drone?.z, -540);
  assert.notEqual(NATIVE_CINDER_SKIRMISH_WORLD.id, CINDER_ASTEROID_SECTOR.id);
});

test("native station skirmish supports lock, guided missiles, projectile hits, and target destruction", () => {
  const flight = createNativeCinderSkirmish("duskbreaker");
  for (let tick = 0; tick < 36; tick++) {
    stepFlight(flight, { ...NEUTRAL_FLIGHT_INPUT, lock: true }, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  }
  assert.equal(flight.lock, 1);
  stepFlight(flight, { ...NEUTRAL_FLIGHT_INPUT, lock: true, missile: true }, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  assert.equal(flight.missiles, 2);

  for (let tick = 0; tick < 180 && flight.stage === "drone"; tick++) {
    stepFlight(flight, { ...NEUTRAL_FLIGHT_INPUT, fire: true }, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  }
  assert.equal(flight.stage, "extract");
  assert.equal(flight.drone.hull, 0);
  assert.ok(flight.hits > 0);
  assert.ok(flight.hull > 0);
});

test("native skirmish drone fires a guided threat that the flare action clears", () => {
  const flight = createNativeCinderSkirmish("duskbreaker");
  for (let tick = 0; tick < 121; tick++) {
    stepFlight(flight, NEUTRAL_FLIGHT_INPUT, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  }
  assert.ok(flight.projectiles.some((projectile) => projectile.hostile && projectile.guided));
  stepFlight(flight, { ...NEUTRAL_FLIGHT_INPUT, countermeasure: true }, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  assert.equal(flight.projectiles.some((projectile) => projectile.hostile && projectile.guided), false);
  assert.equal(flight.flareCooldown, 8);
});

test("native sortie completion is terminal and can be recovered at the station by a local reset", () => {
  const flight = createNativeCinderSkirmish("duskbreaker");
  flight.stage = "extract";
  flight.position = { ...NATIVE_CINDER_SKIRMISH_WORLD.extraction };
  stepFlight(flight, NEUTRAL_FLIGHT_INPUT, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  assert.equal(flight.stage, "complete");
  const elapsedAtCompletion = flight.elapsed;
  stepFlight(flight, { ...NEUTRAL_FLIGHT_INPUT, throttle: 1 }, 1 / 30, NATIVE_CINDER_SKIRMISH_WORLD);
  assert.equal(flight.elapsed, elapsedAtCompletion);
});
