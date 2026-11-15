import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCinderRingDockingGate } from "./CinderRingDockingGate";

describe("Cinder Ring docking approach gate", () => {
  const safeState = { x: 0.3, y: -0.2, z: 2.1, speed: 1.1, alignmentErrorDeg: 4 };

  it("allows only a slow, aligned craft inside the approach volume", () => {
    assert.deepEqual(evaluateCinderRingDockingGate(safeState), { canDock: true, reason: "ready" });
  });

  it("rejects a craft outside the physical approach volume", () => {
    assert.deepEqual(evaluateCinderRingDockingGate({ ...safeState, z: 7 }), {
      canDock: false,
      reason: "outside-volume",
    });
  });

  it("rejects excess speed and poor alignment independently", () => {
    assert.deepEqual(evaluateCinderRingDockingGate({ ...safeState, speed: 3 }), {
      canDock: false,
      reason: "speed",
    });
    assert.deepEqual(evaluateCinderRingDockingGate({ ...safeState, alignmentErrorDeg: 18 }), {
      canDock: false,
      reason: "alignment",
    });
  });
});
