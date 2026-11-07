import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  MARS_MEAN_RADIUS_METERS,
  MARS_MEAN_SOLAR_DAY_SECONDS,
  marsRotationAngle,
  marsSolarExposure,
  marsSurfaceCoordinates,
  marsSurfaceNormal,
  marsSurfacePosition,
} from "@workspace/orbital-sim";

test("Mars planetary-fixed coordinates rotate continuously in an inertial frame", () => {
  assert.deepEqual(marsSurfaceNormal({ latitudeDegrees: 0, longitudeDegrees: 0 }), { x: 0, y: 0, z: 1 });
  const quarter = marsSurfaceNormal({ latitudeDegrees: 0, longitudeDegrees: 0 }, Math.PI / 2);
  assert.ok(Math.abs(quarter.x - 1) < 1e-12);
  assert.ok(Math.abs(quarter.z) < 1e-12);
  assert.ok(Math.abs(marsRotationAngle(MARS_MEAN_SOLAR_DAY_SECONDS) - marsRotationAngle(0)) < 1e-12);
  assert.ok(Math.abs(marsRotationAngle(-MARS_MEAN_SOLAR_DAY_SECONDS / 4) - Math.PI * 1.5) < 1e-12);
});

test("Mars surface coordinate conversion round-trips latitude, longitude, altitude, and rotation", () => {
  const source = { latitudeDegrees: -32.5, longitudeDegrees: 147.25, altitudeMeters: 1_120 };
  const rotation = 2.1;
  const result = marsSurfaceCoordinates(marsSurfacePosition(source, rotation), rotation);
  assert.ok(Math.abs(result.latitudeDegrees - source.latitudeDegrees) < 1e-10);
  assert.ok(Math.abs(result.longitudeDegrees - source.longitudeDegrees) < 1e-10);
  assert.ok(Math.abs(result.altitudeMeters - source.altitudeMeters) < 1e-8);
  assert.ok(Math.abs(Math.hypot(...Object.values(marsSurfaceNormal(source)) as [number, number, number]) - 1) < 1e-12);
  assert.equal(marsSurfacePosition({ latitudeDegrees: 0, longitudeDegrees: 0, altitudeMeters: 0 }).z, MARS_MEAN_RADIUS_METERS);
});

test("one location transitions between daylight and night using the rotating planetary frame", () => {
  const station = { latitudeDegrees: 0, longitudeDegrees: 90 };
  const day = marsSolarExposure(station, 0, { x: 1, y: 0, z: 0 });
  const night = marsSolarExposure(station, MARS_MEAN_SOLAR_DAY_SECONDS / 2, { x: 1, y: 0, z: 0 });
  assert.equal(day.daylight, true);
  assert.ok(day.directFraction > 0.999);
  assert.equal(night.daylight, false);
  assert.equal(night.directFraction, 0);
  assert.ok(Math.abs(day.cosine + night.cosine) < 1e-12);
});

test("planetary coordinates reject impossible or non-finite inputs", () => {
  assert.throws(() => marsSurfacePosition({ latitudeDegrees: 91, longitudeDegrees: 0, altitudeMeters: 0 }), RangeError);
  assert.throws(() => marsSurfacePosition({ latitudeDegrees: 0, longitudeDegrees: 0, altitudeMeters: -MARS_MEAN_RADIUS_METERS }), RangeError);
  assert.throws(() => marsRotationAngle(Number.NaN), RangeError);
  assert.throws(() => marsSurfaceCoordinates({ x: 0, y: 0, z: 0 }), RangeError);
  assert.throws(() => marsSolarExposure({ latitudeDegrees: 0, longitudeDegrees: 0 }, 0, { x: 0, y: 0, z: 0 }), RangeError);
});

test("native preview renders the shared Orbital sector state with collision-matched instanced rocks", () => {
  const renderer = readFileSync(new URL("./orbital-native-flight-renderer.ts", import.meta.url), "utf8");
  const component = readFileSync(new URL("./OrbitalFlightPreview.tsx", import.meta.url), "utf8");
  const input = readFileSync(new URL("./orbital-flight-preview-input.ts", import.meta.url), "utf8");
  const silhouettes = readFileSync(new URL("./orbital-native-ship-geometry.ts", import.meta.url), "utf8");
  assert.match(renderer, /getContext\("webgl2"/);
  assert.match(renderer, /drawElementsInstanced/);
  assert.match(renderer, /sector\.rocks/);
  assert.match(renderer, /state\.position/);
  assert.match(renderer, /state\.orientation/);
  assert.match(renderer, /state\.projectiles/);
  assert.match(renderer, /nativeStationGeometry/);
  assert.match(renderer, /buildOrbitalNativeShipGeometry\(shipId/);
  assert.match(renderer, /ResizeObserver/);
  assert.match(renderer, /deleteBuffer/);
  assert.doesNotMatch(renderer, /from ["']three["']/);
  assert.match(component, /createFlight\(shipId, CINDER_ASTEROID_SECTOR\)/);
  assert.match(component, /stepFlight\(flight, input, FIXED_STEP, CINDER_ASTEROID_SECTOR\)/);
  assert.match(component, /evaluateNativeCinderDock/);
  assert.match(component, /button-orbital-preview-dock/);
  assert.match(component, /button-orbital-preview-undock/);
  assert.match(component, /no rewards/);
  assert.match(component, /PilotFlightStick/);
  assert.match(component, /EXIT FLIGHT/);
  assert.match(input, /toSectorFlightInput/);
  assert.match(input, /barrel-roll-control/);
  assert.match(silhouettes, /ORBITAL_NATIVE_HULLS: Record<ShipId, HullSpec>/);
  assert.match(silhouettes, /presentation only/);
});
