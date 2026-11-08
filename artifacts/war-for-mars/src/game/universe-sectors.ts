import type { AnomalyGravityWellV1, Rock } from "@workspace/orbital-sim";
import { anomalyGravityWellForSector, seedUniverseSector, type SeededUniverseSector } from "@workspace/orbital-sim";

/**
 * Sector-local coordinates stay small for deterministic flight. The address is
 * an arbitrary-precision integer triple, so navigation never accumulates a
 * huge floating-point world position.
 */
export const UNIVERSE_SECTOR_EDGE = 512;
export const UNIVERSE_SECTOR_HALF_EDGE = UNIVERSE_SECTOR_EDGE / 2;
export const ORIGIN_SECTOR: UniverseSectorAddress = { x: "0", y: "0", z: "0" };

export type UniverseSectorAddress = { x: string; y: string; z: string };
export type UniversePosition = { x: number; y: number; z: number };

export type SectorAsteroid = Rock & { y: number; seed: number };
export type UniverseSectorContents = Omit<SeededUniverseSector, "kind" | "asteroids"> & {
  key: string;
  kind: "origin" | SeededUniverseSector["kind"];
  asteroids: SectorAsteroid[];
};
export type UniverseAnomalySignal = {
  id: string;
  sectorKey: string;
  label: string;
  position: UniversePosition;
  distance: number;
};

const COORDINATE = /^-?(0|[1-9]\d*)$/;
const contentsCache = new Map<string, UniverseSectorContents>();
const colliderCache = new Map<string, Rock[]>();
const gravityWellCache = new Map<string, readonly AnomalyGravityWellV1[]>();

function coordinate(value: string): bigint {
  if (!COORDINATE.test(value)) throw new Error(`Invalid universe sector coordinate: ${value}`);
  return BigInt(value);
}

function canonical(value: bigint): string {
  return value.toString();
}

export function sectorAddressKey(address: UniverseSectorAddress): string {
  return `${canonical(coordinate(address.x))}:${canonical(coordinate(address.y))}:${canonical(coordinate(address.z))}`;
}

export function isOriginSector(address: UniverseSectorAddress): boolean {
  return coordinate(address.x) === 0n && coordinate(address.y) === 0n && coordinate(address.z) === 0n;
}

/** Translate the local craft frame into a stable sector address without touching velocity or attitude. */
export function rebaseUniversePosition(
  address: UniverseSectorAddress,
  position: UniversePosition,
): { address: UniverseSectorAddress; local: UniversePosition; crossed: boolean } {
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new Error("Universe position must be finite before sector rebasing.");
  }
  const current = [coordinate(address.x), coordinate(address.y), coordinate(address.z)] as const;
  const values = [position.x, position.y, position.z] as const;
  const shifts = values.map((value) => Math.floor((value + UNIVERSE_SECTOR_HALF_EDGE) / UNIVERSE_SECTOR_EDGE));
  if (shifts.some((shift) => !Number.isSafeInteger(shift))) throw new Error("Universe sector shift exceeds the local physics frame.");
  const nextAddress = current.map((value, index) => canonical(value + BigInt(shifts[index]!)));
  const local = values.map((value, index) => value - shifts[index]! * UNIVERSE_SECTOR_EDGE);
  return {
    address: { x: nextAddress[0]!, y: nextAddress[1]!, z: nextAddress[2]! },
    local: { x: local[0]!, y: local[1]!, z: local[2]! },
    crossed: shifts.some((shift) => shift !== 0),
  };
}

/** Sector offset in the current local frame, returned only for nearby cells. */
export function nearbySectorOffset(
  address: UniverseSectorAddress,
  relative: UniverseSectorAddress,
  radius = 1,
): UniversePosition | null {
  const current = [coordinate(address.x), coordinate(address.y), coordinate(address.z)] as const;
  const target = [coordinate(relative.x), coordinate(relative.y), coordinate(relative.z)] as const;
  const delta = target.map((value, index) => value - current[index]!);
  if (delta.some((value) => value < BigInt(-radius) || value > BigInt(radius))) return null;
  return {
    x: Number(delta[0]) * UNIVERSE_SECTOR_EDGE,
    y: Number(delta[1]) * UNIVERSE_SECTOR_EDGE,
    z: Number(delta[2]) * UNIVERSE_SECTOR_EDGE,
  };
}

/**
 * Local-frame translation to apply when the active sector origin changes.
 * Cameras and local render state move with the rebased universe instead of
 * easing across the old coordinate frame.
 */
export function universeLocalFrameTranslation(
  previous: UniverseSectorAddress,
  next: UniverseSectorAddress,
): UniversePosition | null {
  const from = [coordinate(previous.x), coordinate(previous.y), coordinate(previous.z)] as const;
  const to = [coordinate(next.x), coordinate(next.y), coordinate(next.z)] as const;
  const translation = from.map((value, index) =>
    Number(value - to[index]!) * UNIVERSE_SECTOR_EDGE,
  );
  if (!translation.every(Number.isFinite)) return null;
  return { x: translation[0]!, y: translation[1]!, z: translation[2]! };
}

/** World-space vector from one local sector position to another. */
export function universeDisplacement(
  fromAddress: UniverseSectorAddress,
  fromPosition: UniversePosition,
  toAddress: UniverseSectorAddress,
  toPosition: UniversePosition,
): UniversePosition | null {
  const localValues = [
    fromPosition.x, fromPosition.y, fromPosition.z,
    toPosition.x, toPosition.y, toPosition.z,
  ];
  if (!localValues.every(Number.isFinite)) return null;
  const from = [coordinate(fromAddress.x), coordinate(fromAddress.y), coordinate(fromAddress.z)] as const;
  const to = [coordinate(toAddress.x), coordinate(toAddress.y), coordinate(toAddress.z)] as const;
  const localDelta = [
    toPosition.x - fromPosition.x,
    toPosition.y - fromPosition.y,
    toPosition.z - fromPosition.z,
  ];
  const vector = from.map((value, index) =>
    Number(to[index]! - value) * UNIVERSE_SECTOR_EDGE + localDelta[index]!,
  );
  if (!vector.every(Number.isFinite)) return null;
  return { x: vector[0]!, y: vector[1]!, z: vector[2]! };
}

/** Pure, address-seeded local sector content. It creates no multiplayer operation or reward. */
export function universeSectorContents(address: UniverseSectorAddress): UniverseSectorContents {
  const key = sectorAddressKey(address);
  const cached = contentsCache.get(key);
  if (cached) return cached;
  if (isOriginSector(address)) {
    const origin = { key, seed: 1938, name: "MARS ORBIT · CINDER RING", kind: "origin" as const, asteroids: [], anomaly: null };
    contentsCache.set(key, origin);
    return origin;
  }

  const contents = { key, ...seedUniverseSector(key) };
  if (contentsCache.size >= 256) contentsCache.delete(contentsCache.keys().next().value!);
  contentsCache.set(key, contents);
  return contents;
}

export function nearestUniverseAnomaly(
  address: UniverseSectorAddress,
  localPosition: UniversePosition,
  radius = 1,
): UniverseAnomalySignal | null {
  let nearest: UniverseAnomalySignal | null = null;
  for (const sector of nearbyUniverseSectors(address, radius)) {
    const anomaly = sector.contents.anomaly;
    if (!anomaly) continue;
    const position = {
      x: sector.offset.x + anomaly.x,
      y: sector.offset.y + anomaly.y,
      z: sector.offset.z + anomaly.z,
    };
    const distance = Math.hypot(
      position.x - localPosition.x,
      position.y - localPosition.y,
      position.z - localPosition.z,
    );
    if (!nearest || distance < nearest.distance) {
      nearest = {
        id: `anomaly:${sector.contents.key}`,
        sectorKey: sector.contents.key,
        label: sector.contents.name,
        position,
        distance,
      };
    }
  }
  return nearest;
}

/** Nearby sector cells for visual streaming; stable IDs make content reproducible after a return trip. */
export function nearbyUniverseSectors(address: UniverseSectorAddress, radius = 1) {
  const x = coordinate(address.x);
  const y = coordinate(address.y);
  const z = coordinate(address.z);
  const sectors: Array<{ address: UniverseSectorAddress; offset: UniversePosition; contents: UniverseSectorContents }> = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const neighbor = { x: canonical(x + BigInt(dx)), y: canonical(y + BigInt(dy)), z: canonical(z + BigInt(dz)) };
        sectors.push({
          address: neighbor,
          offset: { x: dx * UNIVERSE_SECTOR_EDGE, y: dy * UNIVERSE_SECTOR_EDGE, z: dz * UNIVERSE_SECTOR_EDGE },
          contents: universeSectorContents(neighbor),
        });
      }
    }
  }
  return sectors;
}

/** Server-independent local wells use the same sector seed and bounded physics rule. */
export function universeSectorGravityWells(address: UniverseSectorAddress): readonly AnomalyGravityWellV1[] {
  const key = sectorAddressKey(address);
  const cached = gravityWellCache.get(key);
  if (cached) return cached;
  const wells: AnomalyGravityWellV1[] = [];
  for (const sector of nearbyUniverseSectors(address)) {
    if (!sector.contents.anomaly) continue;
    const well = anomalyGravityWellForSector(sector.contents.key);
    if (!well) continue;
    wells.push({
      ...well,
      center: {
        x: sector.offset.x + well.center.x,
        y: sector.offset.y + well.center.y,
        z: sector.offset.z + well.center.z,
      },
    });
  }
  if (gravityWellCache.size >= 64) gravityWellCache.delete(gravityWellCache.keys().next().value!);
  gravityWellCache.set(key, wells);
  return wells;
}

/** Collision candidates use the same deterministic rocks as sector visuals. */
export function universeSectorColliders(address: UniverseSectorAddress): Rock[] {
  const key = sectorAddressKey(address);
  const cached = colliderCache.get(key);
  if (cached) return cached;
  const rocks: Rock[] = [];
  for (const sector of nearbyUniverseSectors(address)) {
    for (const asteroid of sector.contents.asteroids) {
      const x = sector.offset.x + asteroid.x;
      const y = sector.offset.y + asteroid.y;
      const z = sector.offset.z + asteroid.z;
      if (Math.hypot(x, y, z) <= 320 + asteroid.r) rocks.push({ x, y, z, r: asteroid.r });
    }
  }

  const mars = nearbySectorOffset(address, ORIGIN_SECTOR);
  if (mars) rocks.push({ x: mars.x - 100, y: mars.y + 21 - 0.9, z: mars.z - 200, r: 67 });
  if (colliderCache.size >= 64) colliderCache.delete(colliderCache.keys().next().value!);
  colliderCache.set(key, rocks);
  return rocks;
}

/** Distance from the local craft frame to a stable destination in a known sector. */
export function positionInCurrentSector(
  current: UniverseSectorAddress,
  targetSector: UniverseSectorAddress,
  targetPosition: UniversePosition,
  maximumSectorDelta = 1_000_000,
): UniversePosition | null {
  const a = [coordinate(current.x), coordinate(current.y), coordinate(current.z)] as const;
  const b = [coordinate(targetSector.x), coordinate(targetSector.y), coordinate(targetSector.z)] as const;
  const delta = b.map((value, index) => value - a[index]!);
  if (delta.some((value) => value < BigInt(-maximumSectorDelta) || value > BigInt(maximumSectorDelta))) return null;
  return {
    x: Number(delta[0]) * UNIVERSE_SECTOR_EDGE + targetPosition.x,
    y: Number(delta[1]) * UNIVERSE_SECTOR_EDGE + targetPosition.y,
    z: Number(delta[2]) * UNIVERSE_SECTOR_EDGE + targetPosition.z,
  };
}
