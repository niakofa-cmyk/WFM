import type { FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import type { FlightPresenceEntry } from "./FlightPresencePanel";

/** Nearby authorized snapshots only; never infer global or offline presence. */
export function flightPresence(snapshot: FreeFlightSnapshotV1): FlightPresenceEntry[] {
  const own = snapshot.actors.find(actor => actor.own && actor.actorId === snapshot.ownActorId);
  if (!own) return [];
  return snapshot.actors.filter(actor => !actor.own && actor.actorId !== own.actorId)
    .map(actor => ({
      actorId: actor.actorId, kind: actor.kind, faction: actor.faction,
      callsign: actor.callsign, friendly: actor.faction === own.faction,
      alive: actor.alive,
      distanceMeters: Math.round(Math.hypot(
        actor.position.x - own.position.x, actor.position.y - own.position.y,
        actor.position.z - own.position.z,
      ) / 5) * 5,
    })).sort((a, b) => a.distanceMeters - b.distanceMeters || a.actorId.localeCompare(b.actorId));
}
