import { rotate, type Quaternion } from "@workspace/orbital-sim";
import {
  universeDisplacement,
  UNIVERSE_SECTOR_EDGE,
  type UniversePosition,
  type UniverseSectorAddress,
} from "./universe-sectors";

export type UniverseNavigationAnchor = {
  sectorAddress: UniverseSectorAddress;
  position: UniversePosition;
};

export type UniverseReturnCue = {
  distanceMeters: number;
  bearingDegrees: number;
  elevationDegrees: number;
};

export const UNIVERSE_RETURN_CUE_MIN_DISTANCE_METERS = UNIVERSE_SECTOR_EDGE * 2;

/** Compute a ship-relative return vector while retaining the exact sector address. */
export function universeReturnCue(
  currentAddress: UniverseSectorAddress,
  currentPosition: UniversePosition,
  anchor: UniverseNavigationAnchor,
  orientation: Quaternion,
): UniverseReturnCue | null {
  const displacement = universeDisplacement(
    currentAddress,
    currentPosition,
    anchor.sectorAddress,
    anchor.position,
  );
  if (!displacement || !orientation.every(Number.isFinite)) return null;
  const quaternionLength = Math.hypot(...orientation);
  if (quaternionLength < 0.9 || quaternionLength > 1.1) return null;

  const distanceMeters = Math.hypot(displacement.x, displacement.y, displacement.z);
  if (!Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1e-6) {
    return { distanceMeters, bearingDegrees: 0, elevationDegrees: 0 };
  }

  const inverse: Quaternion = [-orientation[0], -orientation[1], -orientation[2], orientation[3]];
  const local = rotate(inverse, displacement.x, displacement.y, displacement.z);
  const bearingDegrees = Math.atan2(local.x, -local.z) * 180 / Math.PI;
  const elevationDegrees = Math.atan2(local.y, Math.hypot(local.x, local.z)) * 180 / Math.PI;
  if (![bearingDegrees, elevationDegrees].every(Number.isFinite)) return null;
  return { distanceMeters, bearingDegrees, elevationDegrees };
}

export function formatUniverseRange(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return "—";
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)} M`;
  if (distanceMeters < 1_000_000) {
    return `${(distanceMeters / 1_000).toFixed(distanceMeters < 10_000 ? 1 : 0)} KM`;
  }
  if (distanceMeters < 1_000_000_000) return `${(distanceMeters / 1_000_000).toFixed(1)} Mm`;
  if (distanceMeters < 1_000_000_000_000) return `${(distanceMeters / 1_000_000_000).toFixed(1)} Gm`;
  return `${distanceMeters.toExponential(2)} M`;
}
