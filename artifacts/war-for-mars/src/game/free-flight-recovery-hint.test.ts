import assert from "node:assert/strict";
import test from "node:test";
import { readFreeFlightRecoveryHint, freeFlightRecoveryHintText } from "./free-flight-recovery-hint";

const retained = { protocol: 1, mode: "loadout", shipId: "duskbreaker", faction: "ussf",
  alive: true, locationKey: "mars:rust-disc" };

test("a retained living damaged deployment gives actionable guidance, not a false death", () => {
  const hint = readFreeFlightRecoveryHint(retained)!;
  assert.ok(hint);
  const text = freeFlightRecoveryHintText(hint);
  assert.match(text, /reselect Duskbreaker in Fleet/);
  assert.match(text, /rust disc/);
  assert.match(text, /cannot repair/);
});

test("disabled pilots at a different location receive normal travel and settlement guidance", () => {
  const hint = readFreeFlightRecoveryHint({ ...retained, mode: "location", alive: false })!;
  assert.match(freeFlightRecoveryHintText(hint), /normal travel/);
  assert.match(freeFlightRecoveryHintText(hint), /after battle results settle/);
});

test("recovery hints reject spoofed identities, injected fields and malformed locations", () => {
  for (const value of [null, [], { ...retained, faction: "accord" },
    { ...retained, shipId: "unknown" }, { ...retained, hull: 999 },
    { ...retained, protocol: 2 }, { ...retained, locationKey: "<script>" },
    { ...retained, alive: "true" }]) assert.equal(readFreeFlightRecoveryHint(value), null);
});
