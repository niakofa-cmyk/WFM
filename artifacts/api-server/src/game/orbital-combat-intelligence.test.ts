import assert from "node:assert/strict";
import test from "node:test";
import { integrateSpatialFlight, newFlight, type SpatialCraft } from "@workspace/orbital-sim";
import { SHIPS } from "./ships";
import { tacticalFlight } from "./orbital-combat-intelligence";
const craft = (id: number, x = 0, z = 0): SpatialCraft => ({
  id, x, z, yaw: 0, pitch: 0, speed: 0, steer: 0, hull: 100, hullMax: 100,
  alive: true, root: 0, jam: 0, boost: 0, cloak: 0, untargetable: 0,
  radius: 1.5, lockTargetId: null, space: newFlight(),
});
const memory = () => ({ evadeUntil: 0, readyAt: 0, strafe: 0, vertical: 0 });

test("rear interception and distinct squad angles are heading-relative, not world-axis offsets or teleports", () => {
  const target = craft(1);
  const points = [2, 3, 4].map(id => {
    const ship = craft(id, 35, -60), before = structuredClone(ship);
    const result = tacticalFlight(ship, target, "interceptor", 1, [], "ussf", memory());
    assert.deepEqual(ship, before);
    assert.equal(result.mode, "rear-intercept");
    assert.ok(result.intercept.z > target.z, "point is behind a target facing negative Z");
    return result.intercept;
  });
  assert.equal(new Set(points.map(p => JSON.stringify(p))).size, 3);
  target.space = newFlight(Math.PI / 2);
  const rotated = tacticalFlight(craft(3, 0, -60), target, "interceptor", 1, [], "ussf", memory());
  assert.ok(rotated.intercept.x > target.x, "rear quarter rotates with target heading");
});

test("interceptor physically reaches the target rear quarter through ordinary integrated flight", () => {
  const enemy = craft(3, 35, -60), target = craft(1), state = memory();
  let reached = false;
  for (let tick = 1; tick <= 1800; tick++) {
    const result = tacticalFlight(enemy, target, "interceptor", tick, [], "ussf", state);
    const before = { x: enemy.x, z: enemy.z };
    integrateSpatialFlight(enemy, result.controls, 1 / 30, 1, [], SHIPS.duskbreaker, { boundaryRadius: null });
    assert.ok(Math.hypot(enemy.x - before.x, enemy.z - before.z) < 5, "no instantaneous repositioning");
    if (enemy.z > target.z + 8 && Math.hypot(enemy.x, enemy.z) < 70) { reached = true; break; }
  }
  assert.ok(reached, "AI actually reaches a rear-quarter position");
});

test("incoming fire triggers a timed physical dodge; friendly and receding rounds do not", () => {
  const enemy = craft(3), target = craft(1, 0, -40), state = memory();
  const incoming = { x: 0, y: 0, z: -25, vx: 0, vy: 0, vz: 50, life: 2,
    dmg: 10, r: .2, homeId: null, missile: true, faction: "accord" };
  assert.notEqual(tacticalFlight(enemy, target, "interceptor", 1,
    [{ ...incoming, faction: "ussf" }], "ussf", memory()).mode, "evade");
  assert.notEqual(tacticalFlight(enemy, target, "interceptor", 1,
    [{ ...incoming, vz: -50 }], "ussf", memory()).mode, "evade");
  let result = tacticalFlight(enemy, target, "interceptor", 1, [incoming], "ussf", state);
  assert.equal(result.mode, "evade");
  const readyAt = state.readyAt;
  for (let tick = 1; tick <= 12; tick++) {
    result = tacticalFlight(enemy, target, "interceptor", tick, [incoming], "ussf", state);
    integrateSpatialFlight(enemy, result.controls, 1 / 30, 1, [], SHIPS.duskbreaker, { boundaryRadius: null });
  }
  assert.ok(Math.abs(enemy.x) > .1 && Math.abs(enemy.space!.y) > .1);
  assert.ok(enemy.space!.energy < 100);
  assert.equal(enemy.untargetable, 0, "evasion grants no invulnerability");
  assert.equal(state.readyAt, readyAt, "incoming fire cannot reset the dodge cooldown every tick");
  assert.notEqual(tacticalFlight(enemy, target, "interceptor", 20, [incoming], "ussf", state).mode, "evade");
});

test("missile intent requires alignment and existing lock, ammunition and cooldown", () => {
  const enemy = craft(1), target = craft(2, 0, -40);
  const run = () => tacticalFlight(enemy, target, "interceptor", 343, [], "ussf", memory()).controls;
  assert.equal(run().missile, false);
  enemy.space!.lockProgress = 1;
  assert.equal(run().missile, true);
  enemy.space!.missileCd = 1;
  assert.equal(run().missile, false);
  enemy.space!.missileCd = 0; enemy.space!.ammo = 0;
  assert.equal(run().missile, false);
});
