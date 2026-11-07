import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { orbitalStartForVerifiedWorldLocation } from "./orbital-world-entry";

test("verified Phobos and Cinder locations restore to their physical Orbital anchors", () => {
  assert.equal(orbitalStartForVerifiedWorldLocation("phobos-yard"), "mars-orbit");
  assert.equal(orbitalStartForVerifiedWorldLocation("cinder-asteroid"), "cinder-ring");
});

test("unmapped, missing, and untrusted locations cannot invent an Orbital spawn", () => {
  assert.equal(orbitalStartForVerifiedWorldLocation("rust-disc"), null);
  assert.equal(orbitalStartForVerifiedWorldLocation("unknown"), null);
  assert.equal(orbitalStartForVerifiedWorldLocation(undefined), null);
  assert.equal(orbitalStartForVerifiedWorldLocation(null), null);
});

test("authenticated universe entry restores only an account-verified physical anchor", () => {
  const app = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  assert.match(app, /const enterOrbitalUniverse = async \(\) =>/);
  assert.match(app, /await narrativeWorld\.refetch\(\)/);
  assert.match(app, /orbitalStartForVerifiedWorldLocation\(world\?\.currentLocation\)/);
  assert.match(app, /No substitute spawn was selected/);
  assert.match(app, /startLocation: orbitalStartLocation \?\? "mars-orbit"/);
});

test("co-op runs in an overlay while the Orbital universe remains mounted", () => {
  const app = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  const galaxy = readFileSync(new URL("./GalaxyScreen.tsx", import.meta.url), "utf8");
  const expedition = readFileSync(new URL("./SectorExpedition.tsx", import.meta.url), "utf8");
  assert.match(app, /<SectorExpedition[\s\S]*?embedded[\s\S]*?initialMissionId=\{universeExpeditionMission\}/);
  assert.match(app, /onReturnToUniverse=\{\(\) => \{[\s\S]*?setUniverseServicesOpen\(false\)/);
  assert.match(galaxy, /onLaunchExpedition\("rust-disc"\)/);
  assert.match(galaxy, /button-launch-campaign-in-universe/);
  assert.match(expedition, /RETURN TO ORBIT/);
});

test("server-authorized campaign and Wing operations can return to Orbital", () => {
  const app = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  assert.match(app, /returnToOrbitalAfterOperationRef\.current = true/);
  assert.match(app, /if \(returnToOrbitalAfterOperationRef\.current\) \{\s*setUniverseServicesOpen\(false\);\s*setOrbitalUniverseOpen\(false\);/);
  assert.match(app, /returnToOrbitalAfterOperationRef\.current \? "Return to Universe" : "Hangar"/);
  assert.match(app, /void enterOrbitalUniverse\(\)/);
});
