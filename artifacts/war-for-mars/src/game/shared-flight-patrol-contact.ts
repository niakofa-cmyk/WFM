import type { FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import {
  PATROL_SENSOR_RANGE_METERS,
} from "./universe-patrol-flight";
import type { UniversePatrolEncounterNotice } from "./UniversePatrolEncounterPrompt";
import { SHIPS, type ShipId } from "./ships";

/** Derive the nearest hostile contact from a validated server snapshot only. */
export function sharedFlightPatrolContact(
  snapshot: FreeFlightSnapshotV1,
): UniversePatrolEncounterNotice | null {
  const own = snapshot.actors.find((actor) =>
    actor.actorId === snapshot.ownActorId && actor.own && actor.kind === "pilot",
  );
  if (!own) return null;

  const hostiles = snapshot.actors
    .filter((actor) => actor.kind === "patrol" && actor.alive && actor.faction !== own.faction)
    .filter((actor) => Object.hasOwn(SHIPS, actor.shipId))
    .map((actor) => ({
      actor,
      distanceMeters: Math.hypot(
        actor.position.x - own.position.x,
        actor.position.y - own.position.y,
        actor.position.z - own.position.z,
      ),
    }))
    .filter((contact) => Number.isFinite(contact.distanceMeters) &&
      contact.distanceMeters <= PATROL_SENSOR_RANGE_METERS)
    .sort((left, right) =>
      left.distanceMeters - right.distanceMeters ||
      left.actor.actorId.localeCompare(right.actor.actorId),
    );
  const nearest = hostiles[0];
  if (!nearest) return null;

  return {
    callsign: nearest.actor.callsign,
    faction: nearest.actor.faction,
    shipId: nearest.actor.shipId as ShipId,
    shipCount: hostiles.length,
    distanceMeters: nearest.distanceMeters,
    shield: nearest.actor.shield,
    shieldMax: nearest.actor.shieldMax,
    hull: nearest.actor.hull,
    hullMax: nearest.actor.hullMax,
    source: "server-snapshot",
  };
}
