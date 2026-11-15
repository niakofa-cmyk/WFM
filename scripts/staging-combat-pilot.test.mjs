import assert from "node:assert/strict";
import test from "node:test";
import { battlePilotIntent, evasivePilotKeys } from "./lib/staging-combat-pilot.mjs";

const own = { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
const target = (x, y, z) => ({ position: { x, y, z } });

test("staging combat driver advances on distant aligned contacts and reverses before overlap", () => {
  assert.equal(battlePilotIntent(own, target(0, 0, -100)).forward, true);
  assert.equal(battlePilotIntent(own, target(0, 0, -10)).reverse, true);
  assert.equal(battlePilotIntent(own, target(100, 0, 10)).forward, false);
});

test("staging aim uses ship-local axes and the device-facing yaw convention", () => {
  assert.ok(battlePilotIntent(own, target(10, 0, -30)).steer > 0);
  assert.ok(battlePilotIntent(own, target(0, 10, -30)).stickPitch < 0);
  const turned = { ...own, orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } };
  assert.ok(Math.abs(battlePilotIntent(turned, target(-40, 0, 0)).steer) < 1e-12);
});

test("staging missile requests remain range- and alignment-gated without granting a lock", () => {
  assert.equal(battlePilotIntent(own, target(0, 0, -40)).missile, true);
  assert.equal(battlePilotIntent(own, target(0, 0, -100)).missile, false);
  assert.equal(battlePilotIntent(own, target(40, 0, -10)).missile, false);
});

test("staging steering is invariant under a distant universe origin", () => {
  const moved = { ...own, position: { x: 1e6, y: -2e6, z: 3e6 } };
  assert.deepEqual(
    battlePilotIntent(own, target(10, 10, -40)),
    battlePilotIntent(moved, target(1e6 + 10, -2e6 + 10, 3e6 - 40)),
  );
});

test("staging evasion alternates valid lateral and vertical controls independently", () => {
  assert.deepEqual(evasivePilotKeys(0), ["KeyX", "KeyV"]);
  assert.deepEqual(evasivePilotKeys(900), ["KeyZ", "KeyV"]);
  assert.deepEqual(evasivePilotKeys(1300), ["KeyZ", "KeyC"]);
  assert.deepEqual(evasivePilotKeys(1800), ["KeyX", "KeyC"]);
});

test("staging evasion rejects invalid timers", () => {
  for (const value of [-1, NaN, Infinity]) assert.throws(() => evasivePilotKeys(value), RangeError);
});
