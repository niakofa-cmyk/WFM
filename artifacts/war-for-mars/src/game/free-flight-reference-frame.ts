import {
  UNIVERSE_MOON_REFERENCE, UNIVERSE_REFERENCE_FRAME_ID, type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import {
  ORIGIN_SECTOR, nearbySectorOffset, rebaseUniversePosition,
  universeLocalFrameTranslation, type UniversePosition, type UniverseSectorAddress,
} from "./universe-sectors";

export function ownSharedFlightReference(snapshot: FreeFlightSnapshotV1) {
  const own = snapshot.actors.find(a => a.actorId === snapshot.ownActorId && a.own && a.kind === "pilot");
  if (!own || !Object.values(own.position).every(Number.isFinite)) return null;
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

/** The one server-to-render transform, independent of the viewer's predicted position. */
export function sharedPointInLocalFrame(point: UniversePosition, address: UniverseSectorAddress) {
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
