import assert from "node:assert/strict";
import test from "node:test";
import { seedUniverseSector } from "@workspace/orbital-sim";

test("Orbital sector seeding repeats deterministically for large addresses", () => {
  const key = "900719925474099312345:-19:4";
  const server = seedUniverseSector(key);
  const clientReference = seedUniverseSector(key);
  assert.deepEqual(server, clientReference);
  assert.ok(server.asteroids.length >= 3 && server.asteroids.length <= 5);
  assert.ok(server.asteroids.every(({ x, y, z, r, seed }) =>
    [x, y, z, r, seed].every(Number.isFinite),
  ));
  assert.notDeepEqual(server, seedUniverseSector("900719925474099312346:-19:4"));
});

test("Orbital sector seeding rejects missing identity instead of silently creating origin content", () => {
  assert.throws(() => seedUniverseSector(""));
});
