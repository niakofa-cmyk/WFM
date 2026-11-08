import { rotate, type FreeFlightSnapshotV1, type SpatialCraft } from "@workspace/orbital-sim";

/**
 * Correct kinematics from the authenticated own seat. Position remains in the
 * rebased local frame; remote traffic is already anchored relative to this seat.
 * This never creates authority, health, weapons, or a client-supplied server pose.
 */
export function reconcileFreeFlightKinematics(
  pilot: SpatialCraft, snapshot: FreeFlightSnapshotV1, initial: boolean,
): boolean {
  const own = snapshot.actors.find((actor) =>
    actor.actorId === snapshot.ownActorId && actor.own && actor.kind === "pilot");
  if (!own || !pilot.space) return false;
  const space = pilot.space;
  const target = [own.orientation.x, own.orientation.y, own.orientation.z, own.orientation.w];
  const sign = space.q.reduce((sum, value, i) => sum + value * target[i]!, 0) < 0 ? -1 : 1;
  const blend = initial ? 1 : 0.65;
  const q = space.q.map((value, i) => value + (target[i]! * sign - value) * blend);
  const length = Math.hypot(...q);
  if (!Number.isFinite(length) || length < 0.001) return false;
  space.q = q.map((value) => value / length) as typeof space.q;
  space.vx += (own.velocity.x - space.vx) * blend;
  space.vy += (own.velocity.y - space.vy) * blend;
  space.vz += (own.velocity.z - space.vz) * blend;
  const forward = rotate(space.q, 0, 0, -1);
  pilot.yaw = Math.atan2(-forward.x, -forward.z);
  pilot.pitch = Math.atan2(forward.y, Math.hypot(forward.x, forward.z));
  pilot.speed = space.vx * forward.x + space.vy * forward.y + space.vz * forward.z;
  return true;
}
