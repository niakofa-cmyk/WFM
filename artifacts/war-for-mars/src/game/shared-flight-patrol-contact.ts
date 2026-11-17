import type { FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import {
  PATROL_SENSOR_RANGE_METERS,
} from "./universe-patrol-flight";
import type { UniversePatrolEncounterNotice } from "./UniversePatrolEncounterPrompt";
import { SHIPS, type ShipId } from "./ships";

/** Shared flight must never fall back to local preview traffic. */
export function displayedPatrolContact(
  sharedFlightEnabled: boolean,
  sharedContact: UniversePatrolEncounterNotice | null,
  localContact: UniversePatrolEncounterNotice | null,
): UniversePatrolEncounterNotice | null {
  return sharedFlightEnabled
    ? sharedContact?.source === "server-snapshot" ? sharedContact : null
    : localContact;
}

/** Keep the render optimization, but never retain a stale target or integrity. */
export function sameSharedPatrolContact(
  previous: UniversePatrolEncounterNotice | null,
  next: UniversePatrolEncounterNotice | null,
): boolean {
  if (!previous || !next) return previous === next;
  return previous.actorId === next.actorId && previous.engageable === next.engageable &&
    previous.callsign === next.callsign && previous.faction === next.faction &&
    previous.shipId === next.shipId && previous.shipCount === next.shipCount &&
    previous.shield === next.shield && previous.shieldMax === next.shieldMax &&
    previous.hull === next.hull && previous.hullMax === next.hullMax &&
    previous.source === next.source &&
    Math.round(previous.distanceMeters) === Math.round(next.distanceMeters);
}

/** Retain a nearby approach target through small range changes, never stale actors. */
export function sharedFlightPatrolContact(
  snapshot: FreeFlightSnapshotV1,
  preferredActorId?: string,
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
  const closest = hostiles[0];
  const preferred = hostiles.find((entry) => entry.actor.actorId === preferredActorId);
  const nearest = closest && preferred &&
    // A contact already inside interception range must not be hidden by a lock.
    !(closest.distanceMeters <= 180 && preferred.distanceMeters > 180) &&
    preferred.distanceMeters <= closest.distanceMeters * 1.25
      ? preferred : closest;
  if (!nearest) return null;

  return {
    actorId: nearest.actor.actorId,
    engageable: nearest.actor.actorId.startsWith("patrol-ship:"),
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
