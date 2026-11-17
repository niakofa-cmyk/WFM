import assert from "node:assert/strict";
import test from "node:test";
import { DISPATCHES, SORTIES, sortieUnlocked, TECHS } from "./campaign";

test("campaign is a four-sortie chain with discoveries and technology unlocks", () => {
  assert.deepEqual(SORTIES.map((sortie) => sortie.id), ["contact", "beacon", "warden", "cage"]);
  assert.equal(SORTIES[0]?.objective, "BREAK THE DEFENDING WING");
  assert.match(SORTIES[0]?.brief ?? "", /Break the defending wing/i);
  assert.equal(sortieUnlocked("contact", 0), true);
  assert.equal(sortieUnlocked("beacon", 0), false);
  assert.equal(sortieUnlocked("beacon", 1), true);
  assert.equal(sortieUnlocked("warden", 2), true);
  assert.equal(sortieUnlocked("cage", 3), true);
  assert.deepEqual(TECHS.map((tech) => tech.need), [1, 2, 3]);
  assert.match(SORTIES[3]?.brief ?? "", /later transfer/i);
  assert.match(DISPATCHES[0]?.text ?? "", /captured after his expedition was destroyed/i);
  assert.doesNotMatch(JSON.stringify(DISPATCHES), /Dusk knew the cage was a trap|chose the route/i);
});
