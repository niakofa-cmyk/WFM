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
  const anomaly = kind === "anomaly-front"
    ? { x: (random() * 2 - 1) * 145, y: (random() * 2 - 1) * 105, z: (random() * 2 - 1) * 145 }
    : null;
  return { seed, name, kind, asteroids, anomaly };
}
