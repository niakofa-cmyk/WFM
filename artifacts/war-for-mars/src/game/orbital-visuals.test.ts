import assert from "node:assert/strict";
import test from "node:test";
import { buildOrbitalShip } from "./orbital-visuals";
import { SHIPS, type ShipId } from "./ships";

test("hangar procedural hulls map every canonical roster ID to a distinct populated Three.js model", () => {
  const assets = new Set<string>();
  for (const shipId of Object.keys(SHIPS) as ShipId[]) {
    const model = buildOrbitalShip(shipId);
    assert.equal(model.userData.asset, `wfm-orbital-${shipId}`);
    assert.ok(model.children.length > 10, `${shipId} should contain hull, wing, engine, and trim geometry`);
    assert.ok(!assets.has(model.userData.asset), `${shipId} should not reuse another hull asset`);
    assets.add(model.userData.asset);
    model.traverse((object) => {
      if ("geometry" in object && object.geometry) object.geometry.dispose();
      if ("material" in object) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
  assert.equal(assets.size, Object.keys(SHIPS).length);
});
