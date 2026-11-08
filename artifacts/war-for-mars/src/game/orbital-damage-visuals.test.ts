import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrbitalShip,
  createOrbitalDamageController,
} from "./orbital-visuals";

test("Orbital hull damage is visible in the 3D ship model without changing its geometry", () => {
  const model = buildOrbitalShip("duskbreaker");
  const engine = model.getObjectByName("engine-housing-1");
  assert.ok(engine);
  const geometry = engine.geometry;
  const originalMaterial = engine.material;
  const controller = createOrbitalDamageController(model);

  assert.equal(controller.update(80, 100), "intact");
  assert.equal(controller.update(50, 100), "field");
  assert.equal(model.userData.flightDamageState, "field");
  assert.notEqual(engine.material, originalMaterial);
  assert.equal(engine.geometry, geometry);
  assert.equal(model.getObjectByName("orbital-flight-damage-scorch")?.visible, true);

  assert.equal(controller.update(20, 100), "critical");
  assert.notEqual(engine.material, originalMaterial);
  assert.equal(engine.geometry, geometry);
  assert.equal(controller.update(80, 100), "intact");
  assert.equal(engine.material, originalMaterial);
  assert.equal(model.getObjectByName("orbital-flight-damage-scorch")?.visible, false);

  controller.dispose();
  assert.equal(model.getObjectByName("orbital-flight-damage-scorch"), undefined);
});
