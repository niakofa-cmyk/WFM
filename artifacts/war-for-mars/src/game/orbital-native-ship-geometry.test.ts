import assert from "node:assert/strict";
import test from "node:test";
import { SHIPS, type ShipId } from "./ships";
import { buildOrbitalNativeShipGeometry, ORBITAL_NATIVE_HULLS } from "./orbital-native-ship-geometry";

function signature(data: Float32Array) {
  let hash = 2166136261;
  for (const value of data) {
    const bits = Math.round(value * 10_000);
    hash = Math.imul(hash ^ bits, 16777619);
  }
  return `${data.length}:${hash >>> 0}`;
}

test("every saved hull has an individual native low-poly silhouette", () => {
  const ids = Object.keys(SHIPS) as ShipId[];
  const signatures = new Set<string>();
  assert.deepEqual(Object.keys(ORBITAL_NATIVE_HULLS).sort(), ids.sort());

  for (const id of ids) {
    const color = SHIPS[id].faction === "ussf" ? [0.34,0.76,1] as const : [1,0.62,0.26] as const;
    const geometry = buildOrbitalNativeShipGeometry(id, color);
    assert.ok(geometry.length >= 180, `${id} needs a visible fuselage, wing, and fittings`);
    assert.equal(geometry.length % 6, 0, `${id} geometry must use position/RGB vertices`);
    assert.ok([...geometry].every(Number.isFinite), `${id} geometry must be finite`);
    assert.ok(geometry.length / 6 < 10_000, `${id} must stay within a modest native geometry budget`);
    signatures.add(signature(geometry));
  }
  assert.equal(signatures.size, ids.length, "hulls must not collapse to one generic fighter mesh");
});

test("native hull coordinates preserve a forward nose and distinct declared identities", () => {
  for (const id of Object.keys(SHIPS) as ShipId[]) {
    const spec = ORBITAL_NATIVE_HULLS[id];
    assert.ok(spec.silhouette.length > 4);
    assert.ok(spec.sections[0]![0] < 0, `${id} nose starts in front of its center`);
    assert.ok(spec.engineOffsets.length >= 2, `${id} needs multiple visible propulsion points`);
    assert.ok(spec.hardpoints.length >= 2, `${id} needs visible weapon or missile fittings`);
    assert.ok(spec.wing.length >= 5, `${id} needs an identifiable wing planform`);
  }
});
