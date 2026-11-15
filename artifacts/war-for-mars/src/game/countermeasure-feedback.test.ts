import assert from "node:assert/strict";
import test from "node:test";
import { countermeasureFeedbackLabel } from "./countermeasure-feedback";

test("countermeasure feedback distinguishes decoys, hardened guidance disruption, and mixed volleys", () => {
  assert.equal(countermeasureFeedbackLabel(1, 0), "1 MISSILE DECOYED");
  assert.equal(countermeasureFeedbackLabel(3, 0), "3 MISSILES DECOYED");
  assert.equal(countermeasureFeedbackLabel(0, 2), "2 GUIDANCE DISRUPTED");
  assert.equal(countermeasureFeedbackLabel(1, 1), "1 DECOYED · 1 DISRUPTED");
  assert.equal(countermeasureFeedbackLabel(0, 0), "COUNTERMEASURE RELEASED");
  assert.equal(countermeasureFeedbackLabel(Number.NaN, -1), "COUNTERMEASURE RELEASED");
});
