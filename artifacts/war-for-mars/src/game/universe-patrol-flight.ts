import type { WorldPatrolDirectory } from "@workspace/api-client-react";
import type { Faction, ShipId } from "./ships";

export const PATROL_SENSOR_RANGE_METERS = 520;
export const PATROL_INTERCEPT_RANGE_METERS = 180;
const MAX_TRAFFIC_AGE_MS = 15_000;
const MAX_VISIBLE_PATROL_SHIPS = 24;

export type PatrolFlightPoint = { x: number; y: number; z: number };
export type PatrolFlightContact = {
  contactId: string;
  patrolId: string;
  callsign: string;
  faction: Faction;
  shipId: ShipId;
  position: PatrolFlightPoint;
  yaw: number;
  distanceMeters: number;
};
export type PatrolFlightEncounter = {
  patrolId: string;
  callsign: string;
  faction: Faction;
  shipCount: number;
  distanceMeters: number;
};

export type PatrolFlightProjection = {
  contacts: PatrolFlightContact[];
  nearestOpposing: PatrolFlightEncounter | null;
};

/**
 * Projects only fresh server traffic into the local Orbital presentation.
 * It never produces combat damage, kill credit, or a reward decision.
 */
export function projectUniversePatrolTraffic(
  directory: WorldPatrolDirectory | null | undefined,
  pilotFaction: Faction,
  origin: PatrolFlightPoint,
  pilot: PatrolFlightPoint,
  nowMs = Date.now(),
): PatrolFlightProjection {
  if (!directory || ![origin.x, origin.y, origin.z, pilot.x, pilot.y, pilot.z].every(Number.isFinite)) {
    return { contacts: [], nearestOpposing: null };
  }
  const receivedAt = Date.parse(directory.generatedAt);
  if (!Number.isFinite(receivedAt) || nowMs - receivedAt > MAX_TRAFFIC_AGE_MS) {
    return { contacts: [], nearestOpposing: null };
  }
  const elapsed = Math.max(0, Math.min(5, (nowMs - receivedAt) / 1000));
  const patrols = new Map(directory.patrols.map((patrol) => [patrol.id, patrol]));
  const contacts: PatrolFlightContact[] = [];

  for (const traffic of directory.traffic) {
    const marker = ":contact:";
    const markerIndex = traffic.contactId.lastIndexOf(marker);
    if (markerIndex <= 0) continue;
    const patrolId = traffic.contactId.slice(0, markerIndex);
    const patrol = patrols.get(patrolId);
    if (!patrol || patrol.faction !== traffic.faction || patrol.ships.length === 0) continue;
    const position = {
      x: origin.x + traffic.position.x + traffic.velocity.x * elapsed,
      y: origin.y + traffic.position.y + traffic.velocity.y * elapsed,
      z: origin.z + traffic.position.z + traffic.velocity.z * elapsed,
    };
    const distanceMeters = Math.hypot(position.x - pilot.x, position.y - pilot.y, position.z - pilot.z);
    if (!Number.isFinite(distanceMeters) || distanceMeters > PATROL_SENSOR_RANGE_METERS) continue;
    contacts.push({
      contactId: traffic.contactId,
      patrolId,
      callsign: patrol.callsign,
      faction: traffic.faction,
      shipId: traffic.hullId,
      position,
      yaw: traffic.yaw,
      distanceMeters,
    });
  }

  contacts.sort((left, right) => left.distanceMeters - right.distanceMeters || left.contactId.localeCompare(right.contactId));
  const nearestShip = contacts.find((contact) => contact.faction !== pilotFaction);
  const visible = contacts.slice(0, MAX_VISIBLE_PATROL_SHIPS);
  if (nearestShip && !visible.some((contact) => contact.contactId === nearestShip.contactId)) {
    visible[visible.length - 1] = nearestShip;
    visible.sort((left, right) => left.distanceMeters - right.distanceMeters);
  }
  const nearestPatrol = nearestShip ? patrols.get(nearestShip.patrolId) : undefined;
  return {
    contacts: visible,
    nearestOpposing: nearestShip && nearestPatrol ? {
      patrolId: nearestShip.patrolId,
      callsign: nearestPatrol.callsign,
      faction: nearestPatrol.faction,
      shipCount: nearestPatrol.ships.length,
      distanceMeters: nearestShip.distanceMeters,
    } : null,
  };
}
