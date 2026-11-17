import { UNIVERSE_MARS_REFERENCE, UNIVERSE_MOON_REFERENCE } from "./universe-reference-frame";

export type SeededUniverseAsteroid = {
  x: number;
  y: number;
  z: number;
  r: number;
  seed: number;
};

export type SeededUniverseSector = {
  seed: number;
  name: string;
  kind: "asteroid-field" | "debris-stream" | "anomaly-front" | "quiet-space";
  asteroids: SeededUniverseAsteroid[];
  anomaly: { x: number; y: number; z: number } | null;
};

const SECTOR_NAMES = ["ASHEN REACH", "DUSTWAKE", "GLASS CURRENT", "NIGHTWARD", "PALE FRONTIER", "RED VEIL"] as const;
const SECTOR_KINDS = ["asteroid-field", "debris-stream", "anomaly-front", "quiet-space"] as const;
const SECTOR_EDGE_METERS = 512;
// Keep the entire lensing assembly and a small visual gap clear of celestial bodies.
const ANOMALY_BODY_CLEARANCE_METERS = 36;
const CANONICAL_SECTOR_COORDINATE = /^-?(0|[1-9]\d*)$/;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function randomStream(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function canonicalSectorOffset(key: string) {
  const parts = key.split(":");
  if (parts.length !== 3 || parts.some((part) => !CANONICAL_SECTOR_COORDINATE.test(part))) return null;
  const cells = parts.map(BigInt);
  if (cells.some((cell) => cell < -1n || cell > 1n)) return null;
  return cells.map((cell) => Number(cell) * SECTOR_EDGE_METERS) as [number, number, number];
}

function anomalyClearsCelestialBodies(
  point: { x: number; y: number; z: number },
  offset: readonly [number, number, number],
) {
  const worldPoint = {
    x: point.x + offset[0],
    y: point.y + offset[1],
    z: point.z + offset[2],
  };
  return [UNIVERSE_MARS_REFERENCE, UNIVERSE_MOON_REFERENCE].every((body) => {
    const distance = Math.hypot(
      worldPoint.x - body.position.x,
      worldPoint.y - body.position.y,
      worldPoint.z - body.position.z,
    );
    return distance >= body.radius + ANOMALY_BODY_CLEARANCE_METERS;
  });
}

function safeAnomalyPosition(
  key: string,
  candidate: { x: number; y: number; z: number },
  seed: number,
) {
  const offset = canonicalSectorOffset(key);
  if (!offset || anomalyClearsCelestialBodies(candidate, offset)) return candidate;

  const choices = [-135, 0, 135] as const;
  const verticalChoices = [-95, 0, 95] as const;
  const safe: Array<{ x: number; y: number; z: number }> = [];
  for (const x of choices) {
    for (const y of verticalChoices) {
      for (const z of choices) {
        const point = { x, y, z };
        if (anomalyClearsCelestialBodies(point, offset)) safe.push(point);
      }
    }
  }
  // At least one candidate is clear even in the origin cell. Rotation by the
  // sector seed keeps the reposition deterministic without clustering anomalies.
  if (safe.length > 0) return safe[seed % safe.length]!;

  // Defensive fallback for future reference-frame changes: place it at the
  // candidate with the greatest clearance rather than intersecting a body.
  let farthest = candidate;
  let farthestDistance = -1;
  for (const x of choices) {
    for (const y of verticalChoices) {
      for (const z of choices) {
        const point = { x, y, z };
        const distance = Math.min(
          ...[UNIVERSE_MARS_REFERENCE, UNIVERSE_MOON_REFERENCE].map((body) =>
            Math.hypot(
              point.x + offset[0] - body.position.x,
              point.y + offset[1] - body.position.y,
              point.z + offset[2] - body.position.z,
            ) - body.radius,
          ),
        );
        if (distance > farthestDistance) {
          farthest = point;
          farthestDistance = distance;
        }
      }
    }
  }
  return farthest;
}

/**
 * Pure coordinate-keyed universe content shared by browser and server.
 * The key must be the canonical integer sector address from the universe
 * sector system; this function never accepts client-authored world state.
 */
export function seedUniverseSector(key: string): SeededUniverseSector {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Universe sector key is required.");
  }
  const seed = hashText(key);
  const random = randomStream(seed);
  const kind = SECTOR_KINDS[seed % SECTOR_KINDS.length]!;
  const name = `${SECTOR_NAMES[(seed >>> 4) % SECTOR_NAMES.length]} · ${kind.replace("-", " ").toUpperCase()}`;
  const asteroids = Array.from({ length: 3 + (seed % 3) }, (_, index) => ({
    x: (random() * 2 - 1) * 188,
    y: (random() * 2 - 1) * 126,
    z: (random() * 2 - 1) * 188,
    r: 7 + random() * 12,
    seed: (seed + index * 7919) >>> 0,
  }));
  const anomalyCandidate = kind === "anomaly-front"
    ? { x: (random() * 2 - 1) * 145, y: (random() * 2 - 1) * 105, z: (random() * 2 - 1) * 145 }
    : null;
  const anomaly = anomalyCandidate ? safeAnomalyPosition(key, anomalyCandidate, seed) : null;
  return { seed, name, kind, asteroids, anomaly };
}
