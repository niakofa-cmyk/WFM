import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "./three-flight-runtime";
import { isArmamentSnapshot, isVisibleArmamentActor, readArmamentSnapshot, type VisibleArmamentActor } from "@workspace/orbital-sim";
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
