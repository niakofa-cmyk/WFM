import assert from "node:assert/strict";
import test from "node:test";
import {
  ORBITAL_ENGINE_TRAIL_MAX_CONTACTS,
  writeOrbitalEngineTrail,
  type NativeSpectatorContact,
} from "./orbital-native-spectator-renderer";

const contact: NativeSpectatorContact = {
  x: 12,
  z: 24,
  yaw: 0,
  shipId: "glide",
  team: 0,
  alive: true,
  health: 1,
  velocity: { x: 0, y: 0, z: 8 },
};

test("Orbital traffic exhaust cues are bounded, deterministic, and reuse caller storage", () => {
  const first = new Float32Array(ORBITAL_ENGINE_TRAIL_MAX_CONTACTS * 12);
  const second = new Float32Array(ORBITAL_ENGINE_TRAIL_MAX_CONTACTS * 12);
  assert.equal(writeOrbitalEngineTrail(contact, first, 0), 2);
  assert.equal(writeOrbitalEngineTrail(contact, second, 0), 2);
  assert.deepEqual(first.slice(0, 12), second.slice(0, 12));
  assert.ok(Array.from(first.slice(0, 12)).every(Number.isFinite));
  assert.ok(first[2]! > first[8]!, "the trail extends opposite the forward velocity");
  assert.equal(writeOrbitalEngineTrail(contact, first, ORBITAL_ENGINE_TRAIL_MAX_CONTACTS * 2), 0);
});

test("Orbital traffic exhaust cues ignore dead and malformed contacts", () => {
  const output = new Float32Array(12);
  assert.equal(writeOrbitalEngineTrail({ ...contact, alive: false }, output, 0), 0);
  assert.equal(writeOrbitalEngineTrail({ ...contact, yaw: Number.NaN }, output, 0), 0);
  assert.equal(writeOrbitalEngineTrail({ ...contact, velocity: { x: 0, y: 0, z: Number.POSITIVE_INFINITY } }, output, 0), 2);
});
