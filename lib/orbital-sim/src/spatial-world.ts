/**
 * Precision-safe coordinates for large Orbital worlds.
 *
 * Store a bounded offset inside an integer-addressed chunk instead of growing
 * one absolute floating-point position without limit. This is a coordinate
 * primitive only; it does not create streamed sectors or persistent world data.
 */
export const ORBITAL_WORLD_CHUNK_SIZE_METERS = 4_096;

export type OrbitalWorldPosition = {
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  localX: number;
  localY: number;
  localZ: number;
};

export type OrbitalWorldOffset = { x: number; y: number; z: number };

const MAX_RELATIVE_CHUNK_DISTANCE = 1_000_000;

function assertChunkCoordinate(value: number) {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Orbital chunk coordinates must be safe integers.");
  }
}

function normalizeAxis(chunk: number, local: number): [number, number] {
  assertChunkCoordinate(chunk);
  if (!Number.isFinite(local)) throw new RangeError("Orbital local coordinates must be finite.");

  const crossedChunks = Math.floor(local / ORBITAL_WORLD_CHUNK_SIZE_METERS);
  if (!Number.isSafeInteger(crossedChunks)) {
    throw new RangeError("Orbital local coordinate exceeds the supported precision range.");
  }

  let nextChunk = chunk + crossedChunks;
  let nextLocal = local - crossedChunks * ORBITAL_WORLD_CHUNK_SIZE_METERS;
  if (!Number.isSafeInteger(nextChunk)) {
    throw new RangeError("Orbital position exceeds the supported chunk range.");
  }

  // Correct rare floating-point boundary residue after quotient/remainder.
  if (nextLocal >= ORBITAL_WORLD_CHUNK_SIZE_METERS) {
    nextLocal -= ORBITAL_WORLD_CHUNK_SIZE_METERS;
    nextChunk += 1;
  } else if (nextLocal < 0) {
    nextLocal += ORBITAL_WORLD_CHUNK_SIZE_METERS;
    nextChunk -= 1;
  }
  if (!Number.isSafeInteger(nextChunk) || nextLocal < 0 ||
      nextLocal >= ORBITAL_WORLD_CHUNK_SIZE_METERS) {
    throw new RangeError("Orbital position could not be normalized safely.");
  }

  return [nextChunk, Object.is(nextLocal, -0) ? 0 : nextLocal];
}

/** Canonicalize local offsets into [0, chunk size), carrying into chunk indices. */
export function normalizeOrbitalWorldPosition(
  position: OrbitalWorldPosition,
): OrbitalWorldPosition {
  const [chunkX, localX] = normalizeAxis(position.chunkX, position.localX);
  const [chunkY, localY] = normalizeAxis(position.chunkY, position.localY);
  const [chunkZ, localZ] = normalizeAxis(position.chunkZ, position.localZ);
  return { chunkX, chunkY, chunkZ, localX, localY, localZ };
}

/** Convert a bounded absolute meter coordinate, such as a planetary location. */
export function orbitalWorldPositionFromMeters(
  x: number,
  y: number,
  z: number,
): OrbitalWorldPosition {
  return normalizeOrbitalWorldPosition({
    chunkX: 0, chunkY: 0, chunkZ: 0,
    localX: x, localY: y, localZ: z,
  });
}

/** Move in local meters while keeping the stored offsets bounded. */
export function offsetOrbitalWorldPosition(
  position: OrbitalWorldPosition,
  offset: OrbitalWorldOffset,
): OrbitalWorldPosition {
  const current = normalizeOrbitalWorldPosition(position);
  if (![offset.x, offset.y, offset.z].every(Number.isFinite)) {
    throw new RangeError("Orbital movement offsets must be finite.");
  }

  function apply(chunk: number, local: number, delta: number): [number, number] {
    const crossedChunks = Math.floor(delta / ORBITAL_WORLD_CHUNK_SIZE_METERS);
    if (!Number.isSafeInteger(crossedChunks)) {
      throw new RangeError("Orbital movement exceeds the supported precision range.");
    }
    const remainder = delta - crossedChunks * ORBITAL_WORLD_CHUNK_SIZE_METERS;
    return normalizeAxis(chunk + crossedChunks, local + remainder);
  }

  const [chunkX, localX] = apply(current.chunkX, current.localX, offset.x);
  const [chunkY, localY] = apply(current.chunkY, current.localY, offset.y);
  const [chunkZ, localZ] = apply(current.chunkZ, current.localZ, offset.z);
  return { chunkX, chunkY, chunkZ, localX, localY, localZ };
}

/**
 * Return a precise nearby offset from `origin` to `target`.
 * Returns null when the target is outside the bounded neighborhood.
 */
export function relativeOrbitalWorldOffset(
  origin: OrbitalWorldPosition,
  target: OrbitalWorldPosition,
  maxChunkDistance = 1,
): OrbitalWorldOffset | null {
  if (!Number.isSafeInteger(maxChunkDistance) || maxChunkDistance < 0 ||
      maxChunkDistance > MAX_RELATIVE_CHUNK_DISTANCE) {
    throw new RangeError("Maximum relative chunk distance is outside the supported range.");
  }
  const from = normalizeOrbitalWorldPosition(origin);
  const to = normalizeOrbitalWorldPosition(target);
  const dx = to.chunkX - from.chunkX;
  const dy = to.chunkY - from.chunkY;
  const dz = to.chunkZ - from.chunkZ;
  if ([dx, dy, dz].some((distance) =>
    !Number.isSafeInteger(distance) || Math.abs(distance) > maxChunkDistance)) {
    return null;
  }

  return {
    x: dx * ORBITAL_WORLD_CHUNK_SIZE_METERS + to.localX - from.localX,
    y: dy * ORBITAL_WORLD_CHUNK_SIZE_METERS + to.localY - from.localY,
    z: dz * ORBITAL_WORLD_CHUNK_SIZE_METERS + to.localZ - from.localZ,
  };
}

/** Stable address for deterministic chunk content, caches, and diagnostics. */
export function orbitalWorldChunkKey(position: OrbitalWorldPosition): string {
  const normalized = normalizeOrbitalWorldPosition(position);
  return `${normalized.chunkX},${normalized.chunkY},${normalized.chunkZ}`;
}
