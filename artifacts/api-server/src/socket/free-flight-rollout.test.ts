import assert from "node:assert/strict";
import test from "node:test";
import { isOrbitalFreeFlightEnabled } from "@workspace/orbital-sim";

test("free flight is available by default in development when prerequisites are ready", () => {
  assert.equal(isOrbitalFreeFlightEnabled({
    environment: "development",
    prerequisitesReady: true,
  }), true);
});

test("production free flight stays explicitly gated", () => {
  assert.equal(isOrbitalFreeFlightEnabled({
    environment: "production",
    prerequisitesReady: true,
  }), false);
  assert.equal(isOrbitalFreeFlightEnabled({
    environment: "production",
    featureFlag: "true",
    prerequisitesReady: true,
  }), true);
});

test("an explicit false flag or missing prerequisite disables free flight", () => {
  assert.equal(isOrbitalFreeFlightEnabled({
    environment: "development",
    featureFlag: "false",
    prerequisitesReady: true,
  }), false);
  assert.equal(isOrbitalFreeFlightEnabled({
    environment: "development",
    prerequisitesReady: false,
  }), false);
});
