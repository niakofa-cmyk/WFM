import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { buildUniverseSectorNeighborhood, disposeUniverseSectorNeighborhood, setOriginSystemFrame } from "./universe-sector-visuals";
import { ORIGIN_SECTOR } from "./universe-sectors";

test("nearby streamed scenery is deterministic, low-poly, and keeps the origin scene out of duplicate cells", () => {
  const first = buildUniverseSectorNeighborhood(ORIGIN_SECTOR);
  const second = buildUniverseSectorNeighborhood(ORIGIN_SECTOR);
  const asteroidNames = (group: THREE.Group) => {
    const names: string[] = [];
    group.traverse((object) => {
      if (object.name.startsWith("sector-asteroid:")) names.push(object.name);
    });
    return names.sort();
  };
  assert.equal(first.children.length, 26);
  assert.deepEqual(asteroidNames(first), asteroidNames(second));
  assert.ok(asteroidNames(first).length >= 75);
  assert.equal(first.children.some((child) => child.name === "sector:0:0:0"), false);
  disposeUniverseSectorNeighborhood(first);
  disposeUniverseSectorNeighborhood(second);
});

test("origin system scenery recenters within adjacent cells and unloads at distant sectors", () => {
  const root = new THREE.Group();
  assert.equal(setOriginSystemFrame(root, { x: "1", y: "-1", z: "0" }, 512), true);
  assert.deepEqual(root.position.toArray(), [-512, 512, 0]);
  assert.equal(setOriginSystemFrame(root, { x: "2", y: "0", z: "0" }, 512), false);
  assert.equal(root.visible, false);
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  assert.equal(setOriginSystemFrame(root, ORIGIN_SECTOR, 512), true);
  assert.equal(root.visible, true);
});
