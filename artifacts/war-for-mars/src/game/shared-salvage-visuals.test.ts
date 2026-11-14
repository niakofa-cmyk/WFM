import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "./three-flight-runtime";
import { createSalvageVisuals } from "./shared-salvage-visuals";

test("salvage crates share the ship reference transform, update in place and release removed meshes", () => {
  const scene = new THREE.Scene();
  const visuals = createSalvageVisuals(scene);
  const contacts = [{ id: "encounter:ship", recoverable: false, distanceMeters: 50,
    position: { x: 1000, y: 2000, z: 3000 } }];
  const local = (p: typeof contacts[number]["position"]) => ({ x: p.x - 900, y: p.y - 1900, z: p.z - 2900 });
  visuals.update(contacts, local);
  assert.equal(scene.children.length, 1);
  const mesh = scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  assert.deepEqual(mesh.position.toArray(), [100, 100, 100]);
  assert.equal(mesh.material.color.getHex(), 0xdca958);
  visuals.update([{ ...contacts[0]!, recoverable: true }], local);
  assert.equal(scene.children[0], mesh);
  assert.equal(mesh.material.color.getHex(), 0x68e6cf);
  visuals.update(contacts, () => null);
  assert.equal(mesh.visible, false, "invalid reference transforms must not leave an old-position crate visible");
  let geometryDisposed = false, materialDisposed = false;
  mesh.geometry.addEventListener("dispose", () => { geometryDisposed = true; });
  mesh.material.addEventListener("dispose", () => { materialDisposed = true; });
  visuals.update([], local);
  assert.equal(scene.children.length, 0);
  assert.equal(geometryDisposed && materialDisposed, true);
  visuals.clear();
});
test("recovery UI sends only a package intent, consumes the result, and invalidates hangar equipment", () => {
  const client = readFileSync(new URL("./free-flight-client.ts", import.meta.url), "utf8");
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.match(client, /type: "freeflight_salvage_recover", protocol: 1, packageId/);
  assert.match(arena, /data-testid="button-recover-wreck"/);
  assert.match(arena, /packet.type === "freeflight_error"/);
  assert.match(arena, /readSalvageContacts\(packet.packages\)/);
  assert.match(arena, /invalidateQueries\(\{ queryKey: \["\/api\/game\/equipment"\]/);
});
