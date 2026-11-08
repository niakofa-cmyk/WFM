import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MARS_NIGHT_SIDE_STATION, ORBITAL_MARS_CENTER, RUST_DISC_RELAY } from "./orbital-universe-session";
import { orbitalStartForVerifiedWorldLocation } from "./orbital-world-entry";

test("verified world locations map only to known Orbital anchors", () => {
  assert.equal(orbitalStartForVerifiedWorldLocation("phobos-yard"), "mars-orbit");
  assert.equal(orbitalStartForVerifiedWorldLocation("cinder-asteroid"), "cinder-ring");
  assert.equal(orbitalStartForVerifiedWorldLocation("rust-disc"), "rust-disc");
  assert.equal(orbitalStartForVerifiedWorldLocation("night-side"), "mars-night-side");
  assert.equal(orbitalStartForVerifiedWorldLocation("unknown"), null);
  assert.equal(orbitalStartForVerifiedWorldLocation(undefined), null);
  assert.equal(orbitalStartForVerifiedWorldLocation(null), null);
});

test("universe landmarks retain distinct spatial anchors", () => {
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
});

test("the live entry uses Orbital Cinder flight and does not mount retired renderers", () => {
  const boot = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(boot, /<OrbitalFlightPreview/);
  assert.match(boot, /nativeDestinationAvailable/);
  assert.match(boot, /orbitalStartForVerifiedWorldLocation/);
  assert.match(boot, /useGetWorldPatrols/);
  assert.doesNotMatch(boot, /<Arena|<SectorExpedition|<CinderRingDockingApproach/);
  assert.match(app, /CO-OP FLIGHT RETIRED/);
  assert.doesNotMatch(app, /<WarApp|<RustDiscFlight|<SectorExpedition|<SoloFlight/);
});
