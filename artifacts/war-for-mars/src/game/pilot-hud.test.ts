import assert from "node:assert/strict";
import test from "node:test";
import { isTargetHullCritical, targetFactionAccent, targetHullColor } from "./pilot-hud";

test("orbital pilot target status colors distinguish faction shields", () => {
  assert.equal(targetFactionAccent("ussf"), "#69c2ff");
  assert.equal(targetFactionAccent("accord"), "#e7a65b");
});

test("hull indicators transition from faction color toward red as damage increases", () => {
  assert.equal(targetHullColor("ussf", 100), "#69c2ff");
  assert.equal(targetHullColor("accord", 100), "#e7a65b");
  assert.notEqual(targetHullColor("ussf", 20), targetFactionAccent("ussf"));
  assert.notEqual(targetHullColor("accord", 20), targetFactionAccent("accord"));
  assert.equal(targetHullColor("ussf", 0), "#ff3630");
});

test("low or invalid hull integrity is marked critical", () => {
  assert.equal(isTargetHullCritical(30), true);
  assert.equal(isTargetHullCritical(31), false);
  assert.equal(isTargetHullCritical(Number.NaN), true);
});
