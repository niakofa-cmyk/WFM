import assert from "node:assert/strict";
import test from "node:test";
import {
  BARREL_ROLL_CONTROL_PROTOCOL_V1,
  ORBITAL_RULES_VERSION,
  parseOrbitalInput,
} from "@workspace/orbital-sim";

function input(values: Record<string, unknown> = {}) {
  return {
    version: ORBITAL_RULES_VERSION, seq: 1, targetId: null,
    throttle: 0, yaw: 0, pitch: 0, strafe: 0, vertical: 0, roll: 0,
    fire: false, missile: false, boost: false, brake: false,
    inertial: false, aimAssist: false, countermeasure: false,
    ...values,
  };
}

test("free-flight advertises the separately versioned direct barrel-roll capability", () => {
  assert.equal(BARREL_ROLL_CONTROL_PROTOCOL_V1, "orbital-barrel-roll-control-v1");
});

test("Orbital input accepts bounded barrel-roll controls without changing legacy packets", () => {
  const parsed = parseOrbitalInput(input({
    maneuver: { version: 1, kind: "barrel-roll-control", input: -0.72 },
  }));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.input.maneuver, {
    version: 1, kind: "barrel-roll-control", input: -0.72,
  });

  const legacy = parseOrbitalInput(input());
  assert.equal(legacy.ok, true);
  if (legacy.ok) assert.equal(legacy.input.maneuver, undefined);
});

test("free-flight rejects malformed, unsupported and oversized barrel-roll intent", () => {
  for (const maneuver of [
    { version: 2, kind: "barrel-roll-control", input: 1 },
    { version: 1, kind: "barrel-roll", direction: "right" },
    { version: 1, kind: "barrel-roll-control", input: 1.01 },
    { version: 1, kind: "barrel-roll-control", input: Number.NaN },
    { version: 1, kind: "barrel-roll-control", input: 1, durationMs: 50 },
    null,
  ]) {
    assert.deepEqual(parseOrbitalInput(input({ maneuver })).ok, false);
  }
});
