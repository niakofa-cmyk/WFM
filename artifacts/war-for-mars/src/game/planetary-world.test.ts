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

test("renderer proof uses native WebGL2 and remains an opt-in preview rather than claiming flight migration", () => {
  const source = readFileSync(new URL("./OrbitalMarsRendererProof.tsx", import.meta.url), "utf8");
  assert.match(source, /getContext\("webgl2"/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /drawElementsInstanced/);
  assert.match(source, /createAsteroidInstances/);
  assert.match(source, /asteroidGeometry = createSphere\(8, 12\)/);
  assert.match(source, /deleteBuffer/);
  assert.match(source, /deleteBuffer\(instanceBuffer\)/);
  assert.doesNotMatch(source, /from ["']three["']/);
  assert.match(source, /not simulation-driven flight, streamed terrain, multiplayer state/);
  assert.match(source, /CLOSE PREVIEW/);
});
