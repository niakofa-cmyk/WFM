import assert from "node:assert/strict";
import test from "node:test";
import { RECOVERED_INTEL, SORTIES, sortieUnlocked, TECHS } from "./campaign";

test("campaign is a four-sortie chain with discoveries and technology unlocks", () => {
  assert.deepEqual(SORTIES.map((sortie) => sortie.id), ["contact", "beacon", "warden", "cage"]);
  assert.equal(sortieUnlocked("contact", 0), true);
  assert.equal(sortieUnlocked("beacon", 0), false);
  assert.equal(sortieUnlocked("beacon", 1), true);
  assert.equal(sortieUnlocked("warden", 2), true);
  assert.equal(sortieUnlocked("cage", 3), true);
  assert.deepEqual(TECHS.map((tech) => tech.need), [1, 2, 3]);
  assert.deepEqual(RECOVERED_INTEL.map((record) => record.need), [1, 2, 3, 4]);
});
