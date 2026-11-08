import assert from "node:assert/strict";
import test from "node:test";
import { createOrbitalStarfieldBuffers } from "./orbital-starfield";

test("Orbital starfields are stable for a sector seed and vary across sectors", () => {
  const first = createOrbitalStarfieldBuffers(1938);
  const replay = createOrbitalStarfieldBuffers(1938);
  const nextSector = createOrbitalStarfieldBuffers(1939);

  assert.deepEqual(first.positions, replay.positions);
  assert.deepEqual(first.phases, replay.phases);
  assert.notDeepEqual(first.positions, nextSector.positions);
  assert.equal(first.positions.length, 700 * 3);
  assert.equal(first.phases.length, 700);
});

test("Orbital starfield generation rejects unsafe seeds and excessive allocations", () => {
  assert.throws(() => createOrbitalStarfieldBuffers(-1), /unsigned 32-bit/);
  assert.throws(() => createOrbitalStarfieldBuffers(1.5), /unsigned 32-bit/);
  assert.throws(() => createOrbitalStarfieldBuffers(1, 0), /between 1 and 20000/);
  assert.throws(() => createOrbitalStarfieldBuffers(1, 20_001), /between 1 and 20000/);
});
