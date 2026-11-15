import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  buildOrbitalShip,
  createHangarInspectionEffects,
  shouldAnimateHangarPreview,
} from "./orbital-visuals";
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

test("hangar damage states are presentation-only, reversible, and leave gameplay models untouched", () => {
  for (const shipId of Object.keys(SHIPS) as ShipId[]) {
    const color = SHIPS[shipId].faction === "accord" ? 0xe0a15a : 0x78bfff;
    const preview = buildOrbitalShip(shipId);
    const gameplayModel = buildOrbitalShip(shipId);
    const previewEngine = preview.getObjectByName("engine-housing-1") as THREE.Mesh;
    const gameplayEngine = gameplayModel.getObjectByName("engine-housing-1") as THREE.Mesh;
    const previewWeapon = preview.getObjectByName("primary-cannon-1") as THREE.Mesh;
    const originalMaterial = previewEngine.material;
    const effects = createHangarInspectionEffects(preview, color);
    let damageMaterialDisposeCount = 0;

    assert.equal(preview.userData.presentationOnly, true);
    effects.setDamage("field");
    (previewEngine.material as THREE.Material).addEventListener("dispose", () => { damageMaterialDisposeCount += 1; });
    assert.equal(previewEngine.visible, true);
    assert.notEqual(previewEngine.material, originalMaterial, `${shipId} should show a scorched engine surface`);
    assert.equal(preview.getObjectByName("hangar-inspection-scorch")?.visible, true);
    effects.setDamage("critical");
    assert.equal(previewEngine.visible, false, `${shipId} should show a missing engine pod`);
    assert.equal(previewWeapon.visible, false, `${shipId} should show a missing weapon barrel`);
    assert.equal(gameplayEngine.visible, true, `${shipId} gameplay construction must remain intact`);
    effects.setDamage("intact");
    assert.equal(previewEngine.visible, true);
    assert.equal(previewEngine.material, originalMaterial);
    assert.equal(preview.getObjectByName("hangar-inspection-scorch")?.visible, false);
    effects.dispose();
    assert.equal(damageMaterialDisposeCount, 1, `${shipId} damaged preview materials must be released`);

    for (const model of [preview, gameplayModel]) {
      model.traverse((object) => {
        if ("geometry" in object && object.geometry) object.geometry.dispose();
        if ("material" in object) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
  }
});

test("hangar engine and weapon effects animate only when enabled and reset to a still preview", () => {
  const model = buildOrbitalShip("mandjet");
  const effects = createHangarInspectionEffects(model, 0xffb64f);
  const exhaust = model.getObjectByName("exhaust") as THREE.Mesh;
  const baseScale = exhaust.scale.toArray();
  const flashes = model.getObjectByName("hangar-weapon-preview-flashes") as THREE.Points;
  const flashMaterial = flashes.material as THREE.PointsMaterial;

  effects.update("engines", 200, true);
  assert.notDeepEqual(exhaust.scale.toArray(), baseScale, "engine close-up should pulse existing exhaust geometry");
  effects.update("engines", 200, false);
  assert.deepEqual(exhaust.scale.toArray(), baseScale, "hidden or reduced-motion rendering resets engine effects");
  effects.update("weapons", 50, true);
  assert.equal(flashes.visible, true);
  assert.ok(flashMaterial.opacity > 0, "weapon close-up should preview a brief muzzle flash");
  assert.ok(flashMaterial.size >= 6, "muzzle flashes should remain visible at mobile canvas sizes");
  effects.update("weapons", 50, false);
  assert.equal(flashes.visible, false);
  assert.equal(flashMaterial.opacity, 0);

  model.traverse((object) => {
    if ("geometry" in object && object.geometry) object.geometry.dispose();
    if ("material" in object) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
});

test("hangar animation pauses for hidden pages, offscreen displays, and reduced motion", () => {
  assert.equal(shouldAnimateHangarPreview(true, true, false), true);
  assert.equal(shouldAnimateHangarPreview(false, true, false), false);
  assert.equal(shouldAnimateHangarPreview(true, false, false), false);
  assert.equal(shouldAnimateHangarPreview(true, true, true), false);
});

test("hangar close-up effects stay within the mobile inspection geometry budget", () => {
  for (const shipId of Object.keys(SHIPS) as ShipId[]) {
    const model = buildOrbitalShip(shipId);
    createHangarInspectionEffects(model, SHIPS[shipId].faction === "accord" ? 0xe0a15a : 0x78bfff);
    let meshes = 0;
    let points = 0;
    let triangles = 0;
    let muzzleVertices = 0;
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        meshes += 1;
        const vertexCount = object.geometry.index?.count ?? object.geometry.getAttribute("position").count;
        triangles += Math.floor(vertexCount / 3);
      } else if (object instanceof THREE.Points) {
        points += 1;
        muzzleVertices += object.geometry.getAttribute("position").count;
      }
    });
    assert.ok(meshes <= 61, `${shipId} hangar preview uses ${meshes} meshes`);
    assert.ok(points <= 1, `${shipId} hangar preview uses ${points} point effects`);
    assert.ok(meshes + points <= 62, `${shipId} preview should keep draw-object count bounded`);
    assert.ok(triangles <= 5_100, `${shipId} preview uses ${triangles} triangles`);
    assert.ok(muzzleVertices <= 4, `${shipId} weapon effect uses ${muzzleVertices} muzzle points`);
    model.traverse((object) => {
      if ("geometry" in object && object.geometry) object.geometry.dispose();
      if ("material" in object) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
});
