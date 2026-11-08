import assert from "node:assert/strict";
import test from "node:test";
import {
  ORIGIN_SECTOR, UNIVERSE_SECTOR_EDGE, UNIVERSE_SECTOR_HALF_EDGE,
  isOriginSector, nearbySectorOffset, nearbyUniverseSectors, positionInCurrentSector,
  rebaseUniversePosition, sectorAddressKey, universeSectorColliders, universeSectorContents,
  universeDisplacement, universeLocalFrameTranslation,
} from "./universe-sectors";

test("sector rebasing preserves world position at positive, negative, and multi-cell boundaries", () => {
  const samples = [
    { x: UNIVERSE_SECTOR_HALF_EDGE, y: 0, z: 0 },
    { x: -UNIVERSE_SECTOR_HALF_EDGE - 0.01, y: -600, z: 778 },
    { x: 512 * 1_000_002 + 18, y: -512 * 1_000_003 - 37, z: -256.5 },
  ];
  for (const before of samples) {
    const rebased = rebaseUniversePosition(ORIGIN_SECTOR, before);
    const after = {
      x: Number(BigInt(rebased.address.x)) * UNIVERSE_SECTOR_EDGE + rebased.local.x,
      y: Number(BigInt(rebased.address.y)) * UNIVERSE_SECTOR_EDGE + rebased.local.y,
      z: Number(BigInt(rebased.address.z)) * UNIVERSE_SECTOR_EDGE + rebased.local.z,
    };
    assert.equal(after.x, before.x);
    assert.equal(after.y, before.y);
    assert.equal(after.z, before.z);
    assert.ok(Math.abs(rebased.local.x) <= UNIVERSE_SECTOR_HALF_EDGE);
    assert.ok(Math.abs(rebased.local.y) <= UNIVERSE_SECTOR_HALF_EDGE);
    assert.ok(Math.abs(rebased.local.z) <= UNIVERSE_SECTOR_HALF_EDGE);
  }
});

test("sector addresses and generated landmarks are stable across return trips and huge addresses", () => {
  const address = { x: "900719925474099312345", y: "-19", z: "4" };
  const first = universeSectorContents(address);
  const second = universeSectorContents({ ...address });
  assert.equal(sectorAddressKey(address), "900719925474099312345:-19:4");
  assert.deepEqual(second, first);
  assert.ok(first.asteroids.length >= 3);
  assert.ok(first.asteroids.every(({ x, y, z, r }) => [x, y, z, r].every(Number.isFinite)));
  assert.equal(isOriginSector(ORIGIN_SECTOR), true);
  assert.equal(universeSectorContents(ORIGIN_SECTOR).kind, "origin");
  assert.notEqual(first.key, universeSectorContents({ x: "900719925474099312346", y: "-19", z: "4" }).key);
});

test("nearby streaming produces a 27-cell deterministic neighborhood with local transforms", () => {
  const sectors = nearbyUniverseSectors(ORIGIN_SECTOR);
  assert.equal(sectors.length, 27);
  assert.equal(new Set(sectors.map(({ contents }) => contents.key)).size, 27);
  assert.ok(sectors.some(({ address, offset }) =>
    address.x === "0" && address.y === "0" && address.z === "0" &&
    offset.x === 0 && offset.y === 0 && offset.z === 0));
  assert.deepEqual(nearbySectorOffset(ORIGIN_SECTOR, { x: "-1", y: "0", z: "1" }), {
    x: -UNIVERSE_SECTOR_EDGE, y: 0, z: UNIVERSE_SECTOR_EDGE,
  });
  assert.equal(nearbySectorOffset(ORIGIN_SECTOR, { x: "100000000000000", y: "0", z: "0" }), null);
});

test("origin shifts keep the camera frame with the pilot and return vectors across distant sectors", () => {
  assert.deepEqual(
    universeLocalFrameTranslation(ORIGIN_SECTOR, { x: "1", y: "-2", z: "0" }),
    { x: -UNIVERSE_SECTOR_EDGE, y: UNIVERSE_SECTOR_EDGE * 2, z: 0 },
  );
  assert.deepEqual(
    universeLocalFrameTranslation(ORIGIN_SECTOR, { x: "98", y: "0", z: "0" }),
    { x: -UNIVERSE_SECTOR_EDGE * 98, y: 0, z: 0 },
  );

  const outbound = rebaseUniversePosition(ORIGIN_SECTOR, { x: 50_000, y: 0, z: -12.5 });
  assert.deepEqual(
    universeDisplacement(outbound.address, outbound.local, ORIGIN_SECTOR, { x: 0, y: 0, z: 0 }),
    { x: -50_000, y: 0, z: 12.5 },
  );
});

test("Cinder stays a fixed destination while streamed sector rocks share collision coordinates", () => {
  const colliders = universeSectorColliders(ORIGIN_SECTOR);
  assert.ok(colliders.some((rock) => rock.r === 67 && rock.x === -100 && rock.z === -200));
  assert.ok(universeSectorColliders({ x: "1", y: "0", z: "0" }).some((rock) => rock.r < 20));
  const cinderFromNextSector = positionInCurrentSector(
    { x: "0", y: "0", z: "-1" }, ORIGIN_SECTOR, { x: 0, y: 0, z: -118 },
  );
  assert.deepEqual(cinderFromNextSector, { x: 0, y: 0, z: 394 });
  assert.equal(positionInCurrentSector(
    { x: "1000001", y: "0", z: "0" }, ORIGIN_SECTOR, { x: 0, y: 0, z: 0 },
  ), null);
});

test("invalid or non-finite sector coordinates fail explicitly", () => {
  assert.throws(() => sectorAddressKey({ x: "1.2", y: "0", z: "0" }));
  assert.throws(() => rebaseUniversePosition(ORIGIN_SECTOR, { x: NaN, y: 0, z: 0 }));
});
