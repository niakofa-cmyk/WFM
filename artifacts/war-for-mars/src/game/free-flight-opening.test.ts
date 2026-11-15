import assert from "node:assert/strict";
import test from "node:test";
import { freeFlightJoinPacket, openingEncounterNotice } from "./free-flight-opening";

test("opening join requests only a scenario, never a target, position or reward", () => {
  assert.deepEqual(freeFlightJoinPacket(), { type: "freeflight_join" });
  assert.deepEqual(freeFlightJoinPacket(true), { type: "freeflight_join", openingEncounter: true });
});

test("opening notices distinguish insertion, reconnect and unavailable patrols", () => {
  assert.match(openingEncounterNotice("ready"), /HOSTILES AHEAD/);
  assert.match(openingEncounterNotice("resumed"), /PRESERVED/);
  assert.match(openingEncounterNotice("unavailable"), /CONTINUE FREE FLIGHT/);
  assert.equal(openingEncounterNotice("victory"), "");
});
