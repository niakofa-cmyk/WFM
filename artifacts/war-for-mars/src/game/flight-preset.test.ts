import assert from "node:assert/strict";
import test from "node:test";
import { parseTrainingShipPreset, resolveInitialTrainingShip } from "./flight-preset";

test("Rust Disc accepts a known ship preset from the Hangar launch link", () => {
  assert.equal(parseTrainingShipPreset("?ship=shakuna"), "shakuna");
  assert.equal(resolveInitialTrainingShip("?ship=shakuna"), "shakuna");
});

test("unknown and prototype property names cannot become ship presets", () => {
  for (const value of ["missing", "constructor", "__proto__", "toString"]) {
    assert.equal(parseTrainingShipPreset(`?ship=${value}`), null);
    assert.equal(resolveInitialTrainingShip(`?ship=${value}`), "glide");
  }
});

test("an authoritative expedition ship takes precedence over a local URL preset", () => {
  assert.equal(resolveInitialTrainingShip("?ship=shakuna", "mandjet"), "mandjet");
});

test("malformed or absent search strings fall back to the existing trainer hull", () => {
  assert.equal(parseTrainingShipPreset("not a URL"), null);
  assert.equal(resolveInitialTrainingShip(""), "glide");
});
