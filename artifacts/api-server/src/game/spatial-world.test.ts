import assert from "node:assert/strict";
import test from "node:test";
import {
  ORBITAL_WORLD_CHUNK_SIZE_METERS,
  marsSurfaceWorldPosition,
  normalizeOrbitalWorldPosition,
  offsetOrbitalWorldPosition,
  orbitalWorldChunkKey,
  orbitalWorldPositionFromMeters,
  relativeOrbitalWorldOffset,
} from "@workspace/orbital-sim";

const size = ORBITAL_WORLD_CHUNK_SIZE_METERS;

test("Orbital world positions normalize positive and negative chunk crossings", () => {
  const start = { chunkX: 3, chunkY: 0, chunkZ: -2, localX: size - 0.25, localY: 0, localZ: 1 };
  const moved = offsetOrbitalWorldPosition(start, { x: 0.5, y: -1, z: -2 });
  assert.deepEqual(moved, {
    chunkX: 4, chunkY: -1, chunkZ: -3, localX: 0.25, localY: size - 1, localZ: size - 1,
  });
  assert.deepEqual(normalizeOrbitalWorldPosition(moved), moved);
  assert.equal(orbitalWorldChunkKey(moved), "4,-1,-3");
});

test("nearby relative offsets stay exact across a chunk boundary and reject distant targets", () => {
  const origin = { chunkX: 1_000_000_000, chunkY: -8, chunkZ: 2, localX: size - 10, localY: 4, localZ: 7 };
  const target = offsetOrbitalWorldPosition(origin, { x: 35, y: -12, z: 0 });
  assert.deepEqual(relativeOrbitalWorldOffset(origin, target), { x: 35, y: -12, z: 0 });
  assert.equal(relativeOrbitalWorldOffset(origin, { ...target, chunkX: origin.chunkX + 2 }), null);
  assert.throws(() => relativeOrbitalWorldOffset(origin, target, Number.MAX_SAFE_INTEGER), RangeError);
});

test("planetary surface coordinates can be represented as chunk-addressed world positions", () => {
  const point = { latitudeDegrees: 17.5, longitudeDegrees: -121.25, altitudeMeters: 240 };
  const position = marsSurfaceWorldPosition(point, 0.73);
  for (const local of [position.localX, position.localY, position.localZ]) {
    assert.ok(local >= 0 && local < size);
  }

  const rebuilt = {
    x: position.chunkX * size + position.localX,
    y: position.chunkY * size + position.localY,
    z: position.chunkZ * size + position.localZ,
  };
  const direct = orbitalWorldPositionFromMeters(rebuilt.x, rebuilt.y, rebuilt.z);
  assert.deepEqual(direct, position);
});

test("spatial helpers fail closed on non-finite values and unsafe chunk ranges", () => {
  assert.throws(() => orbitalWorldPositionFromMeters(Infinity, 0, 0), RangeError);
  assert.throws(() => normalizeOrbitalWorldPosition({
    chunkX: Number.MAX_SAFE_INTEGER + 1, chunkY: 0, chunkZ: 0, localX: 0, localY: 0, localZ: 0,
  }), RangeError);
  assert.throws(() => offsetOrbitalWorldPosition(
    { chunkX: Number.MAX_SAFE_INTEGER, chunkY: 0, chunkZ: 0, localX: size - 1, localY: 0, localZ: 0 },
    { x: 1, y: 0, z: 0 },
  ), RangeError);
});

test("seeded spatial movement normalizes repeatably without losing chunk continuity", () => {
  let seed = 17;
  const next = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  let position = orbitalWorldPositionFromMeters(0, 0, 0);
  for (let i = 0; i < 2_000; i++) {
    const delta = { x: (next() - 0.5) * size * 4, y: (next() - 0.5) * size * 4, z: (next() - 0.5) * size * 4 };
    const moved = offsetOrbitalWorldPosition(position, delta);
    const actual = relativeOrbitalWorldOffset(position, moved, 4);
    assert.ok(actual);
    assert.ok(Math.abs(actual.x - delta.x) < 1e-8);
    assert.ok(Math.abs(actual.y - delta.y) < 1e-8);
    assert.ok(Math.abs(actual.z - delta.z) < 1e-8);
    position = moved;
  }
});
