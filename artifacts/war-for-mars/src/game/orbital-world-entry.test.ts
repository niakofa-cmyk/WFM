import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MARS_NIGHT_SIDE_STATION, ORBITAL_MARS_CENTER, RUST_DISC_RELAY } from "./orbital-universe-session";
import { orbitalStartForVerifiedWorldLocation } from "./orbital-world-entry";

test("verified Phobos and Cinder locations restore to their physical Orbital anchors", () => {
  assert.equal(orbitalStartForVerifiedWorldLocation("phobos-yard"), "mars-orbit");
  assert.equal(orbitalStartForVerifiedWorldLocation("cinder-asteroid"), "cinder-ring");
  assert.equal(orbitalStartForVerifiedWorldLocation("rust-disc"), "rust-disc");
  assert.equal(orbitalStartForVerifiedWorldLocation("night-side"), "mars-night-side");
});

test("unmapped, missing, and untrusted locations cannot invent an Orbital spawn", () => {
  assert.equal(orbitalStartForVerifiedWorldLocation("unknown"), null);
  assert.equal(orbitalStartForVerifiedWorldLocation(undefined), null);
  assert.equal(orbitalStartForVerifiedWorldLocation(null), null);
});

test("Rust Disc and night-side entries resolve to distinct spatial landmarks", () => {
  assert.notDeepEqual(RUST_DISC_RELAY.position, RUST_DISC_RELAY.approach);
  assert.ok(Math.hypot(
    RUST_DISC_RELAY.position.x - RUST_DISC_RELAY.approach.x,
    RUST_DISC_RELAY.position.y - RUST_DISC_RELAY.approach.y,
    RUST_DISC_RELAY.position.z - RUST_DISC_RELAY.approach.z,
  ) > 30);
  assert.ok(Math.abs(Math.hypot(
    MARS_NIGHT_SIDE_STATION.position.x - ORBITAL_MARS_CENTER.x,
    MARS_NIGHT_SIDE_STATION.position.y - ORBITAL_MARS_CENTER.y,
    MARS_NIGHT_SIDE_STATION.position.z - ORBITAL_MARS_CENTER.z,
  ) - 72) < 1e-9);
  assert.ok(Math.abs(Math.hypot(
    MARS_NIGHT_SIDE_STATION.approach.x - ORBITAL_MARS_CENTER.x,
    MARS_NIGHT_SIDE_STATION.approach.y - ORBITAL_MARS_CENTER.y,
    MARS_NIGHT_SIDE_STATION.approach.z - ORBITAL_MARS_CENTER.z,
  ) - 108) < 1e-9);
  const visuals = readFileSync(new URL("./orbital-visuals.ts", import.meta.url), "utf8");
  assert.match(visuals, /relay\.name = "rust-disc-relay"/);
  assert.match(visuals, /nightStation\.name = "mars-night-side-station"/);
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
