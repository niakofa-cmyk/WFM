import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
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

test("all sixteen Orbital hulls have individual construction, role fittings, faction identity, and mobile-sized detail", () => {
  const silhouettes = new Set<string>();
  for (const shipId of Object.keys(SHIPS) as ShipId[]) {
    const model = buildOrbitalShip(shipId);
    assert.equal(model.userData.faction, SHIPS[shipId].faction);
    assert.equal(model.userData.specialAbility, SHIPS[shipId].ultName);
    assert.equal(model.userData.primaryWeaponFit, SHIPS[shipId].primaryFit);
    assert.equal(model.userData.missileFit, SHIPS[shipId].missileFit);
    assert.equal(model.userData.missileAmmo, SHIPS[shipId].missileAmmo);
    assert.equal(
      model.userData.designLanguage,
      SHIPS[shipId].faction === "accord" ? "accord-energy-forged" : "ussf-modular-military",
    );
    assert.ok(typeof model.userData.silhouette === "string");
    silhouettes.add(model.userData.silhouette as string);
    assert.ok(Number(model.userData.engineCount) >= 2, `${shipId} needs a distinct engine fit`);
    assert.ok(Number(model.userData.weaponHardpoints) >= 2, `${shipId} needs visible primary hardpoints`);
    assert.ok(Number(model.userData.missileRails) >= 2, `${shipId} needs visible missile rails`);

    const names = new Set<string>();
    let meshes = 0;
    let triangles = 0;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      names.add(object.name);
      const vertexCount = object.geometry.index?.count ?? object.geometry.getAttribute("position").count;
      triangles += Math.floor(vertexCount / 3);
    });
    for (const requiredPart of ["fuselage", "cockpit-canopy", "sensor-beacon", "exhaust", "primary-cannon-1", "missile-round-1", "docking-pad-1"]) {
      if (requiredPart === "sensor-beacon" && (model.userData.sensorFit === "dish" || model.userData.sensorFit === "radial")) continue;
      assert.ok(names.has(requiredPart), `${shipId} is missing ${requiredPart}`);
    }
    assert.ok(meshes <= 60, `${shipId} uses ${meshes} meshes; keep mobile draw-call cost bounded`);
    assert.ok(triangles <= 5_000, `${shipId} uses ${triangles} triangles; keep hangar/gameplay detail bounded`);

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }
  assert.equal(silhouettes.size, Object.keys(SHIPS).length, "every original hull needs a unique silhouette blueprint");
});
