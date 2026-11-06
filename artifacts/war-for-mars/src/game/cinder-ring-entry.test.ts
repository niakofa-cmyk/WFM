import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cinderRingEntrySurface } from "./cinder-ring-entry";

describe("Cinder Ring station arrival flow", () => {
  it("keeps the travel hub available before the server location is Cinder Ring", () => {
    assert.equal(cinderRingEntrySurface(false, "entry"), "travel-hub");
    assert.equal(cinderRingEntrySurface(false, "docked"), "travel-hub");
  });

  it("requires a local approach and docking before exposing the station hub", () => {
    assert.equal(cinderRingEntrySurface(true, "entry"), "approach-entry");
    assert.equal(cinderRingEntrySurface(true, "approach"), "approach-flight");
    assert.equal(cinderRingEntrySurface(true, "docked"), "docked-hub");
  });
});
