import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isEquipmentTelemetry } from "@workspace/orbital-sim";

test("equipment fitting remains inside the existing hangar armory with real account-scoped APIs", () => {
  const bay = readFileSync(new URL("./EquipmentBay.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("./HomeScreen.tsx", import.meta.url), "utf8");
  assert.match(home, /<EquipmentBay shipId=\{draft\.ship\} signedIn=\{props\.signedIn\}/);
  for (const hook of ["useGetEquipment", "useFitEquipment", "useRecoverEquipment"]) assert.ok(bay.includes(hook));
  assert.match(bay, /expectedRevision: locker\.revision/);
  assert.match(bay, /owner !== userRef\.current/);
  assert.match(bay, /client\.setQueryData\(key, locker\)/);
  assert.match(bay, /client\.invalidateQueries/);
  assert.match(bay, /userId \?\? "anon"/);
  assert.doesNotMatch(bay, /localStorage|sessionStorage/);
});
test("all requested weapon specifications and honest pending/error states are visible in the fitting surface", () => {
  const bay = readFileSync(new URL("./EquipmentBay.tsx", import.meta.url), "utf8");
  for (const field of ["damage", "ammunition", "roundsPerMinute", "range", "projectileVelocity", "tracking",
    "lockSeconds", "reloadSeconds", "heat", "durability", "energy", "size", "mass", "power"])
    assert.ok(bay.includes(`"${field}"`), field);
  for (const state of ["equipment-bay-signed-out", "equipment-bay-loading", "equipment-bay-error"])
    assert.ok(bay.includes(state));
  assert.match(bay, /next newly issued shared-universe flight/);
});
test("live modular weapon telemetry rejects invalid ammunition, heat and reactor values", () => {
  const resource = { rounds: 12, reserve: 36, heat: 45, reload: 0, overheated: false };
  const packet = { protocol: 1, unguided: false, primary: resource, secondary: null, energy: 40, primaryEnergy: 6 };
  assert.equal(isEquipmentTelemetry(packet), true);
  assert.equal(isEquipmentTelemetry({ ...packet, energy: Infinity }), false);
  assert.equal(isEquipmentTelemetry({ ...packet, primary: { ...resource, rounds: 1.5 } }), false);
  assert.equal(isEquipmentTelemetry({ ...packet, primary: { ...resource, heat: 101 } }), false);
  assert.equal(isEquipmentTelemetry({ ...packet, primary: { ...resource, reload: -1 } }), false);
});
