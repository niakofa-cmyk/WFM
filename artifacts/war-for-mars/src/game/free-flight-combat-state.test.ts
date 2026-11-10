import assert from "node:assert/strict";
import test from "node:test";
import { freeFlightConnectionStatusAfter, freeFlightRecoveryRequired } from "./free-flight-combat-state";

test("reconnect callbacks cannot dismiss a refused join's recovery requirement", () => {
  const rejected = freeFlightConnectionStatusAfter("connecting", "unavailable", "freeflight_recovery_required");
  assert.equal(rejected, "freeflight_recovery_required");
  assert.equal(freeFlightConnectionStatusAfter(rejected, "reconnecting", "socket_closed"), rejected);
  assert.equal(freeFlightConnectionStatusAfter(rejected, "connecting"), rejected);
  assert.equal(freeFlightConnectionStatusAfter(rejected, "joined"), "joined");
});

test("a refused recovery join retains a visible recovery path without inventing vitals", () => {
  assert.equal(freeFlightRecoveryRequired("freeflight_recovery_required", null), true);
  assert.equal(freeFlightRecoveryRequired("connecting", null), false);
  assert.equal(freeFlightRecoveryRequired("joined", {
    alive: false, hull: 0, hullMax: 78, shield: 0, shieldMax: 100,
  }), true);
  assert.equal(freeFlightRecoveryRequired("joined", {
    alive: true, hull: 78, hullMax: 78, shield: 100, shieldMax: 100,
  }), false);
});
import { combatStatusAfterError, combatStatusAfterRequest, freeFlightCombatNotice, freeFlightPilotVitals, freeFlightPrimaryFireEnabled, freeFlightWeaponsEnabled, sameFreeFlightPilotVitals } from "./free-flight-combat-state";

const pilot = {
  actorId: "pilot-test", callsign: "Pilot", kind: "pilot", faction: "ussf",
  shipId: "glide", own: true, alive: true,
  hull: 40, hullMax: 80, shield: 12, shieldMax: 30,
  position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }, yaw: 0, pitch: 0, speed: 0,
} as const;

test("shared-flight health selects only the authoritative own pilot", () => {
  const snapshot = { ownActorId: pilot.actorId, actors: [pilot] };
  const vitals = freeFlightPilotVitals(snapshot);
  assert.deepEqual(vitals, { alive: true, hull: 40, hullMax: 80, shield: 12, shieldMax: 30 });
  assert.equal(sameFreeFlightPilotVitals(vitals, freeFlightPilotVitals(snapshot)), true);
  assert.equal(freeFlightPilotVitals(undefined), null);
  assert.equal(freeFlightPilotVitals({ ...snapshot, ownActorId: "someone-else" }), null);
  assert.equal(freeFlightPilotVitals({ ...snapshot, actors: [{ ...pilot, own: false }] }), null);
  assert.equal(freeFlightPilotVitals({ ...snapshot, actors: [{ ...pilot, kind: "patrol" }] }), null);
});

test("an active encounter cannot arm a destroyed, unknown or idle pilot", () => {
  const living = freeFlightPilotVitals({ ownActorId: pilot.actorId, actors: [pilot] });
  const destroyed = freeFlightPilotVitals({
    ownActorId: pilot.actorId, actors: [{ ...pilot, alive: false, hull: 0, shield: 0 }],
  });
  assert.equal(freeFlightPrimaryFireEnabled(living), true);
  assert.equal(freeFlightPrimaryFireEnabled(destroyed), false);
  assert.equal(freeFlightPrimaryFireEnabled(null), false);
  assert.equal(freeFlightWeaponsEnabled(true, living), true);
  assert.equal(freeFlightWeaponsEnabled(false, living), false);
  assert.equal(freeFlightWeaponsEnabled(true, destroyed), false);
  assert.equal(freeFlightWeaponsEnabled(true, null), false);
  assert.equal(sameFreeFlightPilotVitals(living, destroyed), false);
  assert.equal(combatStatusAfterError("active", true, "freeflight_pilot_destroyed"), "disabled");
  assert.match(freeFlightCombatNotice("freeflight_pilot_destroyed"), /Ship disabled/);
  assert.match(freeFlightCombatNotice("freeflight_recovery_pending_settlement"), /unresolved/);
  assert.match(freeFlightCombatNotice("freeflight_recovery_required"), /cannot repair/);
});

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
