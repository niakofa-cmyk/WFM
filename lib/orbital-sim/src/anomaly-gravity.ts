import { detHypot } from "./detmath";
import { seedUniverseSector } from "./universe-sector-seeding";

export const ANOMALY_GRAVITY_VERSION = 1 as const;

export type AnomalyGravityVector3 = { x: number; y: number; z: number };

/**
 * Bounded, server-shareable environmental force. Physics parameters are part
 * of the versioned field instead of being inferred from renderer state.
 */
export type AnomalyGravityWellV1 = {
  version: typeof ANOMALY_GRAVITY_VERSION;
  id: string;
  center: AnomalyGravityVector3;
  influenceRadius: number;
  softeningRadius: number;
  gravitationalParameter: number;
  maxAcceleration: number;
};

const WELL_ID = /^anomaly:[0-9a-f]{8}$/;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function finiteBounded(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

export function isAnomalyGravityWellV1(value: unknown): value is AnomalyGravityWellV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const well = value as Record<string, unknown>;
  if (!exactKeys(well, [
    "version", "id", "center", "influenceRadius", "softeningRadius",
    "gravitationalParameter", "maxAcceleration",
  ]) || well.version !== ANOMALY_GRAVITY_VERSION ||
      typeof well.id !== "string" || !WELL_ID.test(well.id)) return false;

  const center = well.center;
  if (!center || typeof center !== "object" || Array.isArray(center)) return false;
  const point = center as Record<string, unknown>;
  if (!exactKeys(point, ["x", "y", "z"]) ||
      !["x", "y", "z"].every((axis) => finiteBounded(point[axis], 4_096))) return false;

  return typeof well.influenceRadius === "number" &&
    Number.isFinite(well.influenceRadius) &&
    well.influenceRadius >= 32 && well.influenceRadius <= 512 &&
    typeof well.softeningRadius === "number" &&
    Number.isFinite(well.softeningRadius) &&
    well.softeningRadius >= 1 && well.softeningRadius < well.influenceRadius &&
    well.softeningRadius <= 64 &&
    typeof well.gravitationalParameter === "number" &&
    Number.isFinite(well.gravitationalParameter) &&
    well.gravitationalParameter >= 0 && well.gravitationalParameter <= 1_000_000 &&
    typeof well.maxAcceleration === "number" &&
    Number.isFinite(well.maxAcceleration) &&
    well.maxAcceleration >= 0 && well.maxAcceleration <= 16;
}

/** Deterministically derives the one possible gravity well from a sector key. */
export function anomalyGravityWellForSector(key: string): AnomalyGravityWellV1 | null {
  const sector = seedUniverseSector(key);
  if (!sector.anomaly) return null;
  return {
    version: ANOMALY_GRAVITY_VERSION,
    id: `anomaly:${sector.seed.toString(16).padStart(8, "0")}`,
    center: { ...sector.anomaly },
    influenceRadius: 180,
    softeningRadius: 18,
    gravitationalParameter: 18_000,
    maxAcceleration: 4,
  };
}

/** Fixed-step acceleration toward a bounded well, zero outside its influence. */
export function anomalyGravityAcceleration(
  position: AnomalyGravityVector3,
  well: AnomalyGravityWellV1,
): AnomalyGravityVector3 {
  if (!isAnomalyGravityWellV1(well) ||
      ![position.x, position.y, position.z].every((value) => Number.isFinite(value) && Math.abs(value) <= 100_000)) {
    throw new Error("Invalid Orbital anomaly gravity input.");
  }
  const dx = well.center.x - position.x;
  const dy = well.center.y - position.y;
  const dz = well.center.z - position.z;
  const distance = detHypot(detHypot(dx, dy), dz);
  if (distance <= 1e-6 || distance >= well.influenceRadius || well.maxAcceleration === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const distanceSquared = distance * distance;
  const softeningSquared = well.softeningRadius * well.softeningRadius;
  const edge = 1 - distanceSquared / (well.influenceRadius * well.influenceRadius);
  const softenedCube = (distanceSquared + softeningSquared) *
    Math.sqrt(distanceSquared + softeningSquared);
  const scale = well.gravitationalParameter * edge * edge / softenedCube;
  let acceleration = {
    x: dx * scale,
    y: dy * scale,
    z: dz * scale,
  };
  const magnitude = detHypot(detHypot(acceleration.x, acceleration.y), acceleration.z);
  if (magnitude > well.maxAcceleration) {
    const cap = well.maxAcceleration / magnitude;
    acceleration = {
      x: acceleration.x * cap,
      y: acceleration.y * cap,
      z: acceleration.z * cap,
    };
  }
  return acceleration;
}
