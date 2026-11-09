import assert from "node:assert/strict";
import test from "node:test";
import { newFlight, orbitalCombatPursuit, type SpatialCraft } from "@workspace/orbital-sim";

function craft(id: number, x = 0, y = 0, z = 0): SpatialCraft {
  return {
    id, x, z, yaw: 0, pitch: 0, speed: 0, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0,
    boost: 0, cloak: 0, untargetable: 0, radius: 1, lockTargetId: null,
    space: { ...newFlight(), y },
  };
}

test("training and live pursuit use role spacing rather than flying through targets", () => {
  const pilot = craft(2);
  assert.equal(orbitalCombatPursuit(pilot, craft(3, 0, 0, -100), "Heavy").controls.throttle, 0.4);
  assert.equal(orbitalCombatPursuit(pilot, craft(3, 0, 0, -30), "Heavy").controls.throttle, 0);
  assert.equal(orbitalCombatPursuit(pilot, craft(3, 0, 0, -5), "Heavy").controls.throttle, -0.3);
  assert.equal(orbitalCombatPursuit(pilot, craft(3, 0, 0, -30), "Heavy").controls.strafe, 0);
  assert.equal(orbitalCombatPursuit(pilot, craft(3, 0, 0, -30), "Striker").controls.strafe, 0.16);
  assert.equal(orbitalCombatPursuit(craft(1), craft(3, 0, 0, -30), "Striker").controls.strafe, -0.16);
});

test("combat pursuit preserves training ship-local pitch and yaw at remote universe origins", () => {
  const pilot = craft(1, 10, -3, 5);
  pilot.space!.q = newFlight(Math.PI / 2).q;
  const target = craft(2, -50, 20, -15);
  const expected = orbitalCombatPursuit(pilot, target, "Escort");
  for (const ship of [pilot, target]) {
    ship.x += 1_000_000;
    ship.z -= 2_000_000;
    ship.space!.y += 500_000;
  }
  assert.deepEqual(orbitalCombatPursuit(pilot, target, "Escort"), expected);
  assert.ok(expected.controls.pitch > 0);
});

test("legacy training preserves its neutral strafe and 35-metre stand-off", () => {
  const result = orbitalCombatPursuit(craft(2), craft(3, 0, 0, -30), "Striker", false);
  assert.equal(result.controls.throttle, 0);
  assert.equal(result.controls.strafe, 0);
  assert.throws(() => orbitalCombatPursuit({ ...craft(1), space: undefined }, craft(2), "Heavy"));
});
