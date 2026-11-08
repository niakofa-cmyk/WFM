import assert from "node:assert/strict";
import test from "node:test";
import { combatStatusAfterError, combatStatusAfterRequest, freeFlightCombatNotice } from "./free-flight-combat-state";

test("secondary fleet requests and reservation failures retain active combat controls", () => {
  assert.equal(combatStatusAfterRequest(true), "active");
  assert.equal(combatStatusAfterRequest(false), "requesting");
  for (const reason of [
    "freeflight_patrol_reservation_unavailable", "freeflight_encounter_active",
    "freeflight_patrol_departed", "freeflight_patrol_roster_changed",
  ]) {
    assert.equal(combatStatusAfterError("active", true, reason), "active");
    assert.ok(freeFlightCombatNotice(reason).length > 0);
  }
});

test("a rejection cannot create combat authority and an explicit missing encounter clears it", () => {
  assert.equal(combatStatusAfterError("requesting", false, "freeflight_patrol_reservation_unavailable"),
    "freeflight_patrol_reservation_unavailable");
  assert.equal(combatStatusAfterError("active", true, "freeflight_engagement_required"), "idle");
  assert.equal(combatStatusAfterError("requesting", false, "freeflight_rate_limited"), "requesting");
  assert.equal(freeFlightCombatNotice("freeflight_rate_limited"), "");
});
