import { orbitalWorldPositionFromMeters, type OrbitalWorldPosition } from "./spatial-world";

/**
 * Deterministic planetary coordinates and local lighting helpers.
 *
 * Coordinates are meters in a Mars-centered inertial frame: +Y is north,
 * longitude zero points along +Z, and positive longitude rotates toward +X.
 * Shared-world callers must supply server-owned elapsed world time.
 */
export const MARS_MEAN_SOLAR_DAY_SECONDS = 88_775.244;
export const MARS_MEAN_RADIUS_METERS = 3_389_500;
const TAU = Math.PI * 2;

export type MarsSurfacePoint = {
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeMeters: number;
};

export type MarsVector3 = { x: number; y: number; z: number };

export type MarsSolarExposure = {
  /** Signed direct-light cosine: positive is day, negative is night. */
  cosine: number;
  /** Direct illumination in [0, 1], before atmosphere or terrain shading. */
  directFraction: number;
  daylight: boolean;
};

function assertFinite(...values: number[]) {
  if (!values.every(Number.isFinite)) throw new RangeError("Mars world values must be finite numbers.");
}

function assertSurfacePoint(point: MarsSurfacePoint) {
  assertFinite(point.latitudeDegrees, point.longitudeDegrees, point.altitudeMeters);
  if (point.latitudeDegrees < -90 || point.latitudeDegrees > 90) {
    throw new RangeError("Mars latitude must be between -90 and 90 degrees.");
  }
  if (point.altitudeMeters <= -MARS_MEAN_RADIUS_METERS) {
    throw new RangeError("Mars altitude must remain outside the planet center.");
  }
}

function normalizeRadians(angle: number) {
  return ((angle % TAU) + TAU) % TAU;
}

function normalizeLongitudeDegrees(longitude: number) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

/** Rotation of the planetary-fixed frame relative to the inertial frame. */
export function marsRotationAngle(elapsedWorldSeconds: number, epochAngleRadians = 0): number {
  assertFinite(elapsedWorldSeconds, epochAngleRadians);
  return normalizeRadians(epochAngleRadians + (elapsedWorldSeconds / MARS_MEAN_SOLAR_DAY_SECONDS) * TAU);
}

/** Convert a planet-fixed surface coordinate into a Mars-centered inertial normal. */
export function marsSurfaceNormal(
  point: Pick<MarsSurfacePoint, "latitudeDegrees" | "longitudeDegrees">,
  rotationRadians = 0,
): MarsVector3 {
  assertFinite(point.latitudeDegrees, point.longitudeDegrees, rotationRadians);
  if (point.latitudeDegrees < -90 || point.latitudeDegrees > 90) {
    throw new RangeError("Mars latitude must be between -90 and 90 degrees.");
  }
  const latitude = point.latitudeDegrees * Math.PI / 180;
  const longitude = point.longitudeDegrees * Math.PI / 180 + rotationRadians;
  const latitudeRadius = Math.cos(latitude);
  return {
    x: latitudeRadius * Math.sin(longitude),
    y: Math.sin(latitude),
    z: latitudeRadius * Math.cos(longitude),
  };
}

/** Convert a planet-fixed surface coordinate to inertial meters. */
export function marsSurfacePosition(point: MarsSurfacePoint, rotationRadians = 0): MarsVector3 {
  assertSurfacePoint(point);
  const normal = marsSurfaceNormal(point, rotationRadians);
  const radius = MARS_MEAN_RADIUS_METERS + point.altitudeMeters;
  return { x: normal.x * radius, y: normal.y * radius, z: normal.z * radius };
}

/** Chunk-addressed Mars position for large-world routing and nearby rendering. */
export function marsSurfaceWorldPosition(
  point: MarsSurfacePoint,
  rotationRadians = 0,
): OrbitalWorldPosition {
  const position = marsSurfacePosition(point, rotationRadians);
  return orbitalWorldPositionFromMeters(position.x, position.y, position.z);
}

/** Convert an inertial position back to planet-fixed latitude/longitude/altitude. */
export function marsSurfaceCoordinates(position: MarsVector3, rotationRadians = 0): MarsSurfacePoint {
  assertFinite(position.x, position.y, position.z, rotationRadians);
  const radius = Math.hypot(position.x, position.y, position.z);
  if (radius <= 0) throw new RangeError("Mars coordinates cannot be recovered from the planet center.");
  const inertialLongitude = Math.atan2(position.x, position.z);
  return {
    latitudeDegrees: Math.asin(Math.max(-1, Math.min(1, position.y / radius))) * 180 / Math.PI,
    longitudeDegrees: normalizeLongitudeDegrees((inertialLongitude - rotationRadians) * 180 / Math.PI),
    altitudeMeters: radius - MARS_MEAN_RADIUS_METERS,
  };
}

/**
 * Evaluate direct sunlight at a fixed surface location. A shared world should
 * use a normalized, server-owned Sun direction and authoritative world clock.
 */
export function marsSolarExposure(
  point: Pick<MarsSurfacePoint, "latitudeDegrees" | "longitudeDegrees">,
  elapsedWorldSeconds: number,
  sunDirection: MarsVector3 = { x: 1, y: 0, z: 0 },
  epochAngleRadians = 0,
): MarsSolarExposure {
  assertFinite(sunDirection.x, sunDirection.y, sunDirection.z);
  const sunLength = Math.hypot(sunDirection.x, sunDirection.y, sunDirection.z);
  if (sunLength <= 1e-12) throw new RangeError("Sun direction must be a non-zero vector.");
  const normal = marsSurfaceNormal(point, marsRotationAngle(elapsedWorldSeconds, epochAngleRadians));
  const cosine = (normal.x * sunDirection.x + normal.y * sunDirection.y + normal.z * sunDirection.z) / sunLength;
  return { cosine, directFraction: Math.max(0, cosine), daylight: cosine > 0 };
}
