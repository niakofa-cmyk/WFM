import assert from "node:assert/strict";
import test from "node:test";
import { ORIGIN_SECTOR, rebaseUniversePosition } from "./universe-sectors";
import { formatUniverseRange, universeReturnCue } from "./universe-navigation";

test("return guidance preserves a 50 km round-trip range across streamed sectors", () => {
  const outward = rebaseUniversePosition(ORIGIN_SECTOR, { x: 50_000, y: 0, z: 0 });
  const cue = universeReturnCue(
    outward.address,
    outward.local,
    { sectorAddress: ORIGIN_SECTOR, position: { x: 0, y: 0, z: 0 } },
    [0, 0, 0, 1],
  );

  assert.ok(cue);
  assert.equal(cue.distanceMeters, 50_000);
  assert.equal(Math.abs(cue.bearingDegrees), 90);
  assert.equal(cue.elevationDegrees, 0);
  assert.equal(formatUniverseRange(cue.distanceMeters), "50 KM");

  const returned = universeReturnCue(
    ORIGIN_SECTOR,
    { x: 0, y: 0, z: 0 },
    { sectorAddress: ORIGIN_SECTOR, position: { x: 0, y: 0, z: 0 } },
    [0, 0, 0, 1],
  );
  assert.equal(returned?.distanceMeters, 0);
});

test("return guidance rejects invalid vectors and formats deep-space ranges", () => {
  assert.equal(formatUniverseRange(10_250), "10 KM");
  assert.equal(formatUniverseRange(3_200_000), "3.2 Mm");
  assert.equal(formatUniverseRange(Number.NaN), "—");
  assert.equal(
    universeReturnCue(
      ORIGIN_SECTOR,
      { x: 0, y: 0, z: 0 },
      { sectorAddress: ORIGIN_SECTOR, position: { x: 0, y: 0, z: 0 } },
      [0, 0, 0, 0],
    ),
    null,
  );
});
