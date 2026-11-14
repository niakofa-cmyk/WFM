import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "./three-flight-runtime";
import { EQUIPMENT_CATALOG, isArmamentSnapshot, isVisibleArmamentActor, readArmamentSnapshot, type VisibleArmamentActor } from "@workspace/orbital-sim";
import { buildOrbitalShip } from "./orbital-visuals";
import { createMountedArmamentVisuals, MAX_ARMAMENT_MESHES_PER_SHIP } from "./mounted-armament-visuals";

const record = (mounts = [
  { hardpointId: "primary", equipmentId: "railgun" },
  { hardpointId: "secondary", equipmentId: "rocket" },
]): VisibleArmamentActor => ({ actorId: "pilot:one", shipId: "bastion", mounts });
const snapshot = () => ({ protocol: 1, sessionInstanceId: "session-1", tick: 15, actors: [record()] });

test("public armament validates compatible mounts, bounds and identities without exposing private item fields", () => {
  assert.equal(isArmamentSnapshot(snapshot()), true);
  for (const bad of [
    { ...snapshot(), protocol: 2 }, { ...snapshot(), tick: NaN },
    { ...snapshot(), inventory: [] }, { ...snapshot(), actors: [record(), record()] },
    { ...snapshot(), actors: Array.from({ length: 33 }, (_, i) => ({ ...record(), actorId: `pilot:${i}` })) },
    { ...snapshot(), actors: [{ ...record(), userId: "private-account" }] },
    { ...snapshot(), actors: [record([{ hardpointId: "primary", equipmentId: "capital-cannon" }])] },
    { ...snapshot(), actors: [record([{ hardpointId: "primary", equipmentId: "seeker" }])] },
    { ...snapshot(), actors: [record([{ hardpointId: "primary", equipmentId: "unknown-weapon" }])] },
    { ...snapshot(), actors: [{ ...record(), shipId: "unknown-hull" }] },
    { ...snapshot(), actors: [record([{ hardpointId: "primary", equipmentId: "railgun", instanceId: "private-item" } as never])] },
  ]) assert.equal(isArmamentSnapshot(bad), false);
  assert.ok(readArmamentSnapshot(snapshot(), "session-1", 14));
  assert.equal(readArmamentSnapshot(snapshot(), null), null);
  assert.equal(readArmamentSnapshot(snapshot(), "old-session"), null);
  assert.equal(readArmamentSnapshot(snapshot(), "session-1", 15), null);
  assert.equal(readArmamentSnapshot(snapshot(), "session-1", 30), null);
  assert.equal(readArmamentSnapshot({ ...snapshot(), protocol: 2 }, "session-1"), null);
});

test("issued modules replace stock weapon presentation and inherit the actual hull transform", () => {
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  const original = model.getObjectByName("primary-cannon-1")!;
  visuals.update(record());
  assert.equal(original.visible, false);
  assert.equal(model.getObjectByName("missile-round-1")!.visible, false);
  const root = visuals.root!;
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0]!.userData.equipmentId, "railgun");
  assert.equal(root.children[1]!.userData.equipmentId, "rocket");
  assert.ok(root.userData.meshCount <= MAX_ARMAMENT_MESHES_PER_SHIP);
  model.position.set(510, -40, 12);
  model.rotation.set(.4, .2, -.8);
  model.scale.setScalar(2.1);
  model.updateMatrixWorld(true);
  const mount = root.children[0]!;
  const expected = model.localToWorld(mount.position.clone());
  const actual = mount.getWorldPosition(new THREE.Vector3());
  assert.ok(actual.distanceTo(expected) < 1e-9);
  visuals.update({ ...record(), mounts: record().mounts.reverse() });
  assert.equal(visuals.root, root, "unchanged fits do not rebuild geometry at snapshot/frame cadence");
  visuals.hide();
  assert.equal(root.visible, false);
  visuals.update(record());
  assert.equal(root.visible, true);
  visuals.clear();
  assert.equal(original.visible, true);
  assert.equal(model.getObjectByName("missile-round-1")!.visible, true);
  assert.equal(visuals.root, null);
  visuals.dispose();
});

test("a full heavy fit stays bounded and refit/disposal release only mounted resources", () => {
  const full = record([
    { hardpointId: "primary", equipmentId: "railgun" }, { hardpointId: "secondary", equipmentId: "torpedo" },
    { hardpointId: "special", equipmentId: "warhead" }, { hardpointId: "defensive", equipmentId: "hardened-decoys" },
    { hardpointId: "utility-1", equipmentId: "armor" }, { hardpointId: "utility-2", equipmentId: "sensors" },
    { hardpointId: "utility-3", equipmentId: "power" }, { hardpointId: "utility-4", equipmentId: "comms" },
  ]);
  assert.equal(isVisibleArmamentActor(full), true);
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  visuals.update(full);
  assert.equal(visuals.root!.children.length, 8);
  const count = Number(visuals.root!.userData.meshCount);
  assert.ok(count <= MAX_ARMAMENT_MESHES_PER_SHIP);
  let geometryDisposals = 0, materialDisposals = 0, hullDisposals = 0;
  const materials = new Set<THREE.Material>();
  visuals.root!.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.addEventListener("dispose", () => geometryDisposals++);
    if (mesh.material && !Array.isArray(mesh.material)) materials.add(mesh.material);
  });
  for (const material of materials) material.addEventListener("dispose", () => materialDisposals++);
  (model.getObjectByName("fuselage") as THREE.Mesh).geometry.addEventListener("dispose", () => hullDisposals++);
  visuals.update(record([]));
  assert.equal(geometryDisposals, count);
  assert.equal(hullDisposals, 0);
  assert.equal(visuals.root, null);
  visuals.update(record());
  visuals.dispose();
  visuals.dispose();
  assert.equal(materialDisposals, materials.size);
  assert.equal(hullDisposals, 0);
  assert.equal(model.getObjectByName("primary-cannon-1")!.visible, true);
});

test("incompatible or foreign-hull appearance fails closed without changing the hull or game state", () => {
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  visuals.update(record());
  visuals.update({ ...record(), shipId: "glide" });
  assert.equal(visuals.root, null);
  assert.equal(model.getObjectByName("primary-cannon-1")!.visible, true);
  visuals.update(record([{ hardpointId: "primary", equipmentId: "capital-cannon" }]));
  assert.equal(visuals.root, null);
  visuals.dispose();
});

test("confirmed mounted fire recoils barrel parts and flashes at the muzzle through hull rotation, scale and origin shifts", () => {
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  visuals.update(record());
  const mount = visuals.root!.getObjectByName("hardpoint:primary")!;
  const barrel = mount.getObjectByName("recoiling-weapon")!;
  const flash = barrel.getObjectByName("mounted-muzzle-flash") as THREE.Mesh;
  const base = mount.children[0]!;
  const basePosition = base.position.clone(), mountPosition = mount.position.clone();
  assert.equal(visuals.fire("autocannon", 1000), false, "a different fitted weapon cannot flash");
  assert.equal(visuals.fire("railgun", NaN), false);
  assert.equal(flash.visible, false, "a fit snapshot is not a shot");
  model.position.set(30, -18, 40);
  model.rotation.set(.4, -.8, 1.1);
  model.scale.setScalar(2.1);
  const originalPose = { p: model.position.toArray(), q: model.quaternion.toArray() };
  assert.equal(visuals.fire("railgun", 1000), true);
  visuals.animate(1000);
  assert.ok(barrel.position.z < 0);
  assert.deepEqual(base.position, basePosition);
  assert.deepEqual(mount.position, mountPosition);
  assert.equal(flash.visible, true);
  assert.equal(flash.position.z, .805, "rail tips end at .775; flash is .03 ahead, on the same assembly");
  for (const shift of [0, 100_000]) {
    model.position.x = originalPose.p[0]! + shift;
    model.updateMatrixWorld(true);
    const expected = barrel.localToWorld(new THREE.Vector3(0, 0, .805));
    assert.ok(flash.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-8);
  }
  assert.deepEqual(model.quaternion.toArray(), originalPose.q, "recoil never rotates the pilot or camera");
  visuals.animate(1100);
  assert.equal(flash.visible, false);
  assert.ok(barrel.position.z < 0, "the barrel returns after the brief flash ends");
  visuals.animate(1250);
  assert.ok(Math.abs(barrel.position.z) < 1e-12);
  visuals.dispose();
});

test("launcher flashes alternate actual tube tips; visibility, stale fits and disposal cancel animation", () => {
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  visuals.update(record());
  const mount = visuals.root!.getObjectByName("hardpoint:secondary")!;
  const barrel = mount.getObjectByName("recoiling-weapon")!;
  const flash = barrel.getObjectByName("mounted-muzzle-flash") as THREE.Mesh;
  visuals.fire("rocket", 1000); visuals.animate(1000);
  assert.deepEqual(flash.position.toArray(), [-.075, -.07, .405]);
  visuals.fire("rocket", 1100); visuals.animate(1100);
  assert.deepEqual(flash.position.toArray(), [.075, -.07, .405]);
  visuals.hide();
  assert.equal(flash.visible, false);
  assert.equal(barrel.position.z, 0);
  assert.equal(visuals.fire("rocket", 1200), false);
  visuals.update(record());
  visuals.animate(1200);
  assert.equal(flash.visible, false, "showing a hull must not replay a hidden launch");
  model.visible = false;
  assert.equal(visuals.fire("rocket", 1200), false);
  model.visible = true;
  visuals.update(record([{ hardpointId: "primary", equipmentId: "autocannon" }]));
  assert.equal(visuals.fire("rocket", 1200), false);
  visuals.dispose();
  assert.equal(visuals.fire("autocannon", 1300), false);
});

test("sustained firing reuses a bounded flash and material per weapon slot", () => {
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  visuals.update(record());
  const meshes: THREE.Object3D[] = [];
  visuals.root!.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  assert.ok(meshes.length <= MAX_ARMAMENT_MESHES_PER_SHIP);
  const root = visuals.root;
  for (let i = 0; i < 1000; i++) {
    visuals.fire(i % 2 ? "railgun" : "rocket", i * 10);
    visuals.animate(i * 10);
  }
  const after: THREE.Object3D[] = [];
  visuals.root!.traverse(object => { if (object instanceof THREE.Mesh) after.push(object); });
  assert.equal(visuals.root, root);
  assert.deepEqual(after, meshes);
  visuals.dispose();
});

test("each supported cannon and launcher puts its flash directly beyond the authored barrel or nose", () => {
  const model = buildOrbitalShip("bastion");
  const visuals = createMountedArmamentVisuals(model, "bastion");
  const covered = new Set<string>();
  for (const def of EQUIPMENT_CATALOG) {
    if (def.kind !== "primary" && def.kind !== "secondary") continue;
    const appearance = record([{ hardpointId: def.kind, equipmentId: def.id }]);
    if (!isVisibleArmamentActor(appearance)) continue; // Capital-only fittings remain incompatible.
    visuals.update(appearance);
    const barrel = visuals.root!.getObjectByName("recoiling-weapon")!;
    const flash = barrel.getObjectByName("mounted-muzzle-flash")!;
    let end = -Infinity;
    for (const part of barrel.children) {
      if (!(part instanceof THREE.Mesh) || part === flash) continue;
      part.updateMatrix();
      part.geometry.computeBoundingBox();
      end = Math.max(end, part.geometry.boundingBox!.clone().applyMatrix4(part.matrix).max.z);
    }
    assert.ok(Math.abs(flash.position.z - end - .03) < 1e-6, def.id);
    assert.equal(visuals.fire(def.id, 1000), true);
    visuals.animate(1000);
    assert.equal(flash.visible, true);
    covered.add(def.id);
  }
  for (const id of ["autocannon", "rotary-gun", "railgun", "rocket", "seeker", "torpedo"])
    assert.ok(covered.has(id), `missing barrel coverage: ${id}`);
  visuals.dispose();
});
