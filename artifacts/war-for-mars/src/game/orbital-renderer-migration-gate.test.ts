import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CURRENT_MAIN_RENDERER_EVIDENCE,
  mayRetireCompatibilityRenderer,
  type MainRendererParityEvidence,
} from "./orbital-renderer-migration-gate";

test("native-renderer parity gate fails closed until every production acceptance passes", () => {
  assert.equal(mayRetireCompatibilityRenderer(CURRENT_MAIN_RENDERER_EVIDENCE), false);
  const allPassed = Object.fromEntries(
    Object.keys(CURRENT_MAIN_RENDERER_EVIDENCE).map((key) => [key, true]),
  ) as MainRendererParityEvidence;
  assert.equal(mayRetireCompatibilityRenderer(allPassed), true);
  assert.equal(mayRetireCompatibilityRenderer({ ...allPassed, targetDevicePerformanceAccepted: false }), false);
  assert.equal(mayRetireCompatibilityRenderer({ everyProductionSurfaceMigrated: true } as MainRendererParityEvidence), false);
});

test("compatibility Arena remains protected while Orbital native parity is incomplete", () => {
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.equal(mayRetireCompatibilityRenderer(CURRENT_MAIN_RENDERER_EVIDENCE), false);
  assert.match(arena, /new THREE\.WebGLRenderer\(/);
  assert.match(arena, /new THREE\.Scene\(/);
});
