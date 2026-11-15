import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTLEFIELD_PROFILES,
  battlefieldMapCoordinate,
  battlefieldProfile,
} from "./battlefield";

test("every server battlefield has a named briefing and tactical read", () => {
  assert.deepEqual(Object.keys(BATTLEFIELD_PROFILES).sort(), [
    "beacon",
    "dust",
    "night",
    "rust",
  ]);
  for (const profile of Object.values(BATTLEFIELD_PROFILES)) {
    assert.ok(profile.title.length > 0);
    assert.ok(profile.briefing.length > 0);
    assert.ok(profile.tacticalRead.length > 0);
  }
  assert.equal(battlefieldProfile("beacon").callsign, "BEACON");
});

test("tactical map coordinates stay inside the arena boundary", () => {
  assert.equal(battlefieldMapCoordinate(0), 50);
  assert.equal(battlefieldMapCoordinate(-78), 7);
  assert.equal(battlefieldMapCoordinate(78), 93);
  assert.equal(battlefieldMapCoordinate(-500), 7);
  assert.equal(battlefieldMapCoordinate(500), 93);
});
