import assert from "node:assert/strict";
import test from "node:test";
import { resolveArenaModeId, resolveArenaRuntime, resolveArenaTech } from "./arena-config";
import { LEGACY_SURFACE_RUNTIME_ID, ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";

test("server-owned null technology is not replaced by a saved client preference", () => {
  assert.equal(resolveArenaTech({ tech: null }, "barrels"), null);
});

test("server-owned technology is used for an authorized strike", () => {
  assert.equal(resolveArenaTech({ tech: "stick" }, "barrels"), "stick");
});

test("offline practice keeps the saved technology preference", () => {
  assert.equal(resolveArenaTech(undefined, "mark"), "mark");
  assert.equal(resolveArenaTech(null, null), null);
});

test("offline Arena practice selects the canonical orbital runtime", () => {
  assert.equal(resolveArenaRuntime(undefined, false), ORBITAL_RUNTIME_ID);
  assert.equal(resolveArenaRuntime(null, false), ORBITAL_RUNTIME_ID);
});

test("live rooms and unversioned server runs stay on compatibility runtime", () => {
  assert.equal(resolveArenaRuntime(undefined, true), LEGACY_SURFACE_RUNTIME_ID);
  assert.equal(resolveArenaRuntime({ tech: null }, false), LEGACY_SURFACE_RUNTIME_ID);
  assert.equal(resolveArenaRuntime({ tech: null, flightModel: "future-v2" }, false), LEGACY_SURFACE_RUNTIME_ID);
});

test("server-issued run runtime is followed exactly", () => {
  assert.equal(resolveArenaRuntime({ tech: null, flightModel: ORBITAL_RUNTIME_ID }, false), ORBITAL_RUNTIME_ID);
  assert.equal(resolveArenaRuntime({ tech: null, flightModel: LEGACY_SURFACE_RUNTIME_ID }, false), LEGACY_SURFACE_RUNTIME_ID);
});

test("offline Strike launches the Arcade operation while generic local practice stays distinct", () => {
  assert.equal(resolveArenaModeId(null, false, true), "arcade-skirmish");
  assert.equal(resolveArenaModeId(null, false, false), "local-arena-practice");
});

test("only an Orbital Contact server run uses the Contact operation contract", () => {
  assert.equal(
    resolveArenaModeId({ mission: "contact", tech: null, flightModel: ORBITAL_RUNTIME_ID }, false),
    "campaign-contact",
  );
  assert.equal(
    resolveArenaModeId({ mission: "contact", tech: null, flightModel: LEGACY_SURFACE_RUNTIME_ID }, false),
    "campaign-sortie",
  );
  assert.equal(
    resolveArenaModeId({ mission: "beacon", tech: null, flightModel: ORBITAL_RUNTIME_ID }, false),
    "campaign-sortie",
  );
});

test("live rooms always use the Wing operation contract", () => {
  assert.equal(resolveArenaModeId(null, true), "wing-online");
  assert.equal(resolveArenaModeId({ mission: "contact", tech: null, flightModel: ORBITAL_RUNTIME_ID }, true), "wing-online");
});
