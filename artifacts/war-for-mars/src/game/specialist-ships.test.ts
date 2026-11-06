import assert from "node:assert/strict";
import test from "node:test";
import { ROSTER, SHIPS, type Faction, type ShipId } from "./ships";

const original = {
  accord: ["mandjet", "shakuna", "sundara", "tripura"],
  ussf: ["duskbreaker", "sentinel", "splitter", "glide"],
} as const;

test("specialist expansion preserves the original four ships and adds four compatible hulls per faction", () => {
  assert.deepEqual(ROSTER.accord.slice(0, 4), original.accord);
  assert.deepEqual(ROSTER.ussf.slice(0, 4), original.ussf);
  assert.equal(ROSTER.accord.length, 8);
  assert.equal(ROSTER.ussf.length, 8);
  assert.equal(new Set([...ROSTER.accord, ...ROSTER.ussf]).size, 16);
  assert.deepEqual(ROSTER.accord.slice(4), ["apep", "sekhmet", "garuda", "vajra"]);
  assert.deepEqual(ROSTER.ussf.slice(4), ["wasp", "valiant", "aegis", "bastion"]);
});

test("all sixteen spacecraft retain unique faction-owned weapon and ability definitions", () => {
  const ids = Object.keys(SHIPS) as ShipId[];
  assert.equal(ids.length, 16);
  assert.equal(new Set(ids.map((id) => SHIPS[id].ability)).size, 16);
  for (const faction of ["accord", "ussf"] as const satisfies readonly Faction[]) {
    for (const id of ROSTER[faction]) {
      const ship = SHIPS[id];
      assert.equal(ship.id, id);
      assert.equal(ship.faction, faction);
      assert.ok(ship.role.length > 4);
      assert.ok(ship.primaryFit.length > 4);
      assert.ok(ship.missileFit.length > 4);
      assert.ok(ship.missileAmmo >= 4 && ship.missileAmmo <= 12);
      assert.ok(ship.missileDamage >= 28 && ship.missileDamage <= 76);
      assert.ok(ship.ultCd >= 7 && ship.ultCd <= 16);
    }
  }
});
