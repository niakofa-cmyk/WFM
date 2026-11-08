import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { anomalyGravityWellForSector } from "@workspace/orbital-sim";
import {
  buildAnomalyLensingVisual,
  buildUniverseSectorNeighborhood,
  disposeUniverseSectorNeighborhood,
  setOriginSystemFrame,
} from "./universe-sector-visuals";
import {
  ORIGIN_SECTOR,
  universeSectorContents,
  universeSectorGravityWells,
} from "./universe-sectors";

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

test("local streamed anomalies use the shared gravity seed and can be hidden for server-owned flight", () => {
  let address = { x: "1", y: "0", z: "0" };
  for (let x = 1; x <= 100 && !universeSectorContents(address).anomaly; x++) {
    address = { x: String(x), y: "0", z: "0" };
  }
  const contents = universeSectorContents(address);
  assert.ok(contents.anomaly);
  const well = anomalyGravityWellForSector(contents.key);
  assert.ok(well);
  const localWell = universeSectorGravityWells(address).find((candidate) => candidate.id === well.id);
  assert.ok(localWell);
  assert.deepEqual(localWell.center, well.center);

  const visible = buildUniverseSectorNeighborhood(address);
  const serverOwned = buildUniverseSectorNeighborhood(address, { includeAnomalies: false });
  assert.ok(visible.children.some((cell) =>
    cell.children.some((child) => child.name === `sector-anomaly:${contents.key}`),
  ));
  assert.equal(serverOwned.children.some((cell) =>
    cell.children.some((child) => child.name.startsWith("sector-anomaly:")),
  ), false);
  disposeUniverseSectorNeighborhood(visible);
  disposeUniverseSectorNeighborhood(serverOwned);
});

test("server anomaly visualization is a disposable lens assembly", () => {
  const well = anomalyGravityWellForSector("mars:mars-orbit");
  assert.ok(well);
  const visual = buildAnomalyLensingVisual(well);
  const meshes: THREE.Mesh[] = [];
  visual.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  assert.equal(visual.name, `server-anomaly-lens:${well.id}`);
  assert.equal(meshes.length, 3);
  disposeUniverseSectorNeighborhood(visual);
});
