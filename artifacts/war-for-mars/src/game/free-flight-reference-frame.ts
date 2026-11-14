import {
  UNIVERSE_MOON_REFERENCE, UNIVERSE_REFERENCE_FRAME_ID, type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import {
  ORIGIN_SECTOR, UNIVERSE_SECTOR_EDGE, UNIVERSE_SECTOR_HALF_EDGE, nearbySectorOffset, rebaseUniversePosition,
  universeLocalFrameTranslation, type UniversePosition, type UniverseSectorAddress,
} from "./universe-sectors";

export function ownSharedFlightReference(snapshot: FreeFlightSnapshotV1) {
  const own = snapshot.actors.find(a => a.actorId === snapshot.ownActorId && a.own && a.kind === "pilot");
  if (!own || !representablePosition(own.position)) return null;
  const rebased = rebaseUniversePosition(ORIGIN_SECTOR, own.position);
  const moonOffset = {
    x: UNIVERSE_MOON_REFERENCE.position.x - own.position.x,
    y: UNIVERSE_MOON_REFERENCE.position.y - own.position.y,
    z: UNIVERSE_MOON_REFERENCE.position.z - own.position.z,
  };
  return {
    frameId: UNIVERSE_REFERENCE_FRAME_ID, position: own.position,
    sector: rebased.address, local: rebased.local, moonOffset,
    moonRange: Math.hypot(moonOffset.x, moonOffset.y, moonOffset.z),
  };
}
export type SharedFlightReference = NonNullable<ReturnType<typeof ownSharedFlightReference>>;

function representablePosition(point: UniversePosition) {
  return [point.x, point.y, point.z].every(value =>
    Number.isFinite(value) && Number.isSafeInteger(Math.floor((value + UNIVERSE_SECTOR_HALF_EDGE) / UNIVERSE_SECTOR_EDGE)));
}

/** Both positions must be in the same physics frame (no render-only Y lift). */
export function sharedFlightDistance(from: UniversePosition, to: UniversePosition) {
  if (![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite)) return null;
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  return Number.isFinite(distance) ? distance : null;
}

/** The one server-to-render transform, independent of the viewer's predicted position. */
export function sharedPointInLocalFrame(point: UniversePosition, address: UniverseSectorAddress) {
  if (!representablePosition(point)) return null;
  const normalized = rebaseUniversePosition(ORIGIN_SECTOR, point);
  const offset = nearbySectorOffset(address, normalized.address, 8);
  return offset ? {
    x: normalized.local.x + offset.x,
    y: normalized.local.y + offset.y,
    z: normalized.local.z + offset.z,
  } : null;
}

/** Reconcile authenticated position without changing health, authority or attitude.
 * Ordinary corrections blend in the existing sector; insertion/recovery uses the
 * exact server pose. Rebase the camera by the same amount as the local origin.
 */
export function reconcileSharedFlightPosition(
  pilot: { x: number; z: number; space?: { y: number } },
  snapshot: FreeFlightSnapshotV1,
  address: UniverseSectorAddress,
  initial: boolean,
) {
  const reference = ownSharedFlightReference(snapshot);
  if (!reference || !pilot.space) return null;
  const before = { x: pilot.x, y: pilot.space.y, z: pilot.z };
  const target = sharedPointInLocalFrame(reference.position, address);
  const insertion = initial || !target;
  const frame = insertion ? reference.sector : address;
  const local = insertion ? reference.local : {
    x: before.x + (target.x - before.x) * 0.65,
    y: before.y + (target.y - before.y) * 0.65,
    z: before.z + (target.z - before.z) * 0.65,
  };
  const result = rebaseUniversePosition(frame, local);
  pilot.x = result.local.x;
  pilot.space.y = result.local.y;
  pilot.z = result.local.z;
  const translation = insertion ? {
    x: result.local.x - before.x, y: result.local.y - before.y, z: result.local.z - before.z,
  } : universeLocalFrameTranslation(address, result.address);
  return { address: result.address, translation, reference };
}
