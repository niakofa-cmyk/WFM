import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  playerWorldStateTable,
  universePatrolsTable,
} from "@workspace/db";
import type { WorldPatrolDirectory } from "@workspace/api-zod";
import type { PatrolFaction, PersistentPatrolShip } from "@workspace/db";
import { advancePatrol, createSeededPatrols, projectPatrolTraffic } from "./universe-patrol-rules";
import { WORLD_LOCATION_COORDINATES, WORLD_PATROL_SECTOR_NETWORK } from "./world";

const ENCOUNTER_LEASE_MS = 20 * 60_000;
const ACTOR_SHIP_PREFIX = "patrol-ship:";

/** Operational reasons only: never log account, encounter or fleet identities. */
function rejectedReservation(reason: string): null {
  process.stdout.write(`${JSON.stringify({
    event: "universe_patrol_reservation_rejected", reason,
  })}\n`);
  return null;
}

export type UniversePatrolEncounter = {
  patrolId: string;
  locationId: string;
  faction: PatrolFaction;
  callsign: string;
  route: string[];
  ships: PersistentPatrolShip[];
  revision: number;
};

export type UniversePatrolEncounterOutcome = {
  patrolId: string;
  encounterId: string;
  destroyedActorIds: readonly string[];
};

type UniversePatrolTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function opposingFaction(faction: PatrolFaction): PatrolFaction {
  return faction === "ussf" ? "accord" : "ussf";
}

export function patrolShipActorId(shipId: string): string {
  return `${ACTOR_SHIP_PREFIX}${shipId}`;
}

/**
 * Resolve only a server-reported opposing patrol at the pilot's saved location.
 * The client may not supply a region, faction, patrol roster, or ship health.
 */
export async function resolveUniversePatrolEncounter(
  userId: string,
  pilotFaction: PatrolFaction,
): Promise<UniversePatrolEncounter | null> {
  const directory = await getUniversePatrolDirectory(userId);
  const patrol = directory.patrols
    .filter((candidate) => candidate.faction === opposingFaction(pilotFaction) && candidate.ships.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!patrol) return null;
  return {
    patrolId: patrol.id,
    locationId: directory.currentLocationId,
    faction: patrol.faction,
    callsign: patrol.callsign,
    route: patrol.route,
    ships: patrol.ships,
    revision: 0,
  };
}

/** Resolve every live opposing patrol at the pilot's saved location for shared free flight. */
export async function resolveUniversePatrolEncounters(
  userId: string,
  pilotFaction: PatrolFaction,
): Promise<UniversePatrolEncounter[]> {
  const directory = await getUniversePatrolDirectory(userId);
  return directory.patrols
    .filter((patrol) => patrol.faction === opposingFaction(pilotFaction) && patrol.ships.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((patrol) => ({
      patrolId: patrol.id,
      locationId: directory.currentLocationId,
      faction: patrol.faction,
      callsign: patrol.callsign,
      route: patrol.route,
      ships: patrol.ships,
      revision: 0,
    }));
}

/**
 * Claim the persistent fleet at launch so two rooms cannot pay out for the same
 * ships concurrently. The player's location and the roster are rechecked under
 * row locks immediately before the mission starts.
 */
export async function reserveUniversePatrolEncounter(
  userIds: readonly string[],
  pilotFaction: PatrolFaction,
  contact: Pick<UniversePatrolEncounter, "patrolId" | "locationId" | "faction">,
  encounterId: string,
  now = new Date(),
): Promise<UniversePatrolEncounter | null> {
  if (!userIds.length || userIds.length > 8 || new Set(userIds).size !== userIds.length ||
      !/^[0-9a-f-]{36}$/i.test(encounterId)) throw new Error("Invalid patrol encounter identity.");
  return db.transaction(async (tx) => {
    const worlds = await tx.select({
      userId: playerWorldStateTable.userId,
      currentLocation: playerWorldStateTable.currentLocation,
    }).from(playerWorldStateTable).where(inArray(playerWorldStateTable.userId, [...userIds].sort()))
      .orderBy(playerWorldStateTable.userId).for("update");
    if (worlds.length !== userIds.length) return rejectedReservation("participant_world_missing");
    if (worlds.some((world) => world.currentLocation !== contact.locationId)) {
      return rejectedReservation("participant_location_changed");
    }
    if (contact.faction !== opposingFaction(pilotFaction)) return rejectedReservation("faction_mismatch");
    const [row] = await tx.select().from(universePatrolsTable)
      .where(eq(universePatrolsTable.patrolId, contact.patrolId)).for("update");
    if (!row) return rejectedReservation("patrol_missing");
    if (row.currentLocationId !== contact.locationId) return rejectedReservation("patrol_departed");
    if (row.faction !== contact.faction) return rejectedReservation("faction_mismatch");
    if (row.shipRoster.length === 0) return rejectedReservation("patrol_empty");
    if (row.activeEncounterId !== null && row.encounterLeaseExpiresAt !== null &&
        row.encounterLeaseExpiresAt > now) return rejectedReservation("patrol_already_reserved");
    const leaseExpiresAt = new Date(now.getTime() + ENCOUNTER_LEASE_MS);
    const [reserved] = await tx.update(universePatrolsTable).set({
      activeEncounterId: encounterId,
      encounterLeaseExpiresAt: leaseExpiresAt,
      revision: row.revision + 1,
      updatedAt: now,
    }).where(eq(universePatrolsTable.patrolId, row.patrolId)).returning();
    if (!reserved) return rejectedReservation("claim_not_applied");
    return {
      patrolId: reserved.patrolId,
      locationId: reserved.currentLocationId,
      faction: reserved.faction,
      callsign: reserved.callsign,
      route: reserved.route,
      ships: reserved.shipRoster,
      revision: reserved.revision,
    };
  });
}

/** Release a live-flight reservation when the socket runtime shuts down before settlement. */
export async function releaseUniversePatrolEncounter(
  patrolId: string,
  encounterId: string,
): Promise<void> {
  await db.update(universePatrolsTable).set({
    activeEncounterId: null,
    encounterLeaseExpiresAt: null,
    revision: sql`${universePatrolsTable.revision} + 1`,
    updatedAt: new Date(),
  }).where(and(
    eq(universePatrolsTable.patrolId, patrolId),
    eq(universePatrolsTable.activeEncounterId, encounterId),
  ));
}

/**
 * Apply only actor IDs produced by the server-issued exploration receipt.
 * Call inside the same transaction as result/reward persistence.
 */
export async function applyUniversePatrolOutcomeInTransaction(
  tx: UniversePatrolTransaction,
  outcome: UniversePatrolEncounterOutcome,
): Promise<void> {
  const [row] = await tx.select().from(universePatrolsTable)
    .where(eq(universePatrolsTable.patrolId, outcome.patrolId)).for("update");
  if (!row || row.activeEncounterId !== outcome.encounterId) {
    throw new Error("Universe patrol reservation was lost before settlement.");
  }
  const shipIds = outcome.destroyedActorIds.map((actorId) => {
    if (typeof actorId !== "string" || !actorId.startsWith(ACTOR_SHIP_PREFIX)) {
      throw new Error("Invalid universe patrol casualty identity.");
    }
    return actorId.slice(ACTOR_SHIP_PREFIX.length);
  });
  if (new Set(shipIds).size !== shipIds.length ||
      shipIds.some((shipId) => !row.shipRoster.some((ship) => ship.id === shipId))) {
    throw new Error("Universe patrol casualty roster does not match the reserved fleet.");
  }
  const destroyed = new Set(shipIds);
  await tx.update(universePatrolsTable).set({
    shipRoster: row.shipRoster.filter((ship) => !destroyed.has(ship.id)),
    activeEncounterId: null,
    encounterLeaseExpiresAt: null,
    revision: row.revision + 1,
    updatedAt: new Date(),
  }).where(eq(universePatrolsTable.patrolId, row.patrolId));
}

function neighboringLocations(locationId: string): string[] {
  const neighbors = WORLD_PATROL_SECTOR_NETWORK[locationId];
  if (!neighbors) throw new Error("Stored player location is outside the patrol sector network.");
  return [...new Set([locationId, ...neighbors])].sort();
}

/**
 * Materialize deterministic AI formations around the server-owned player
 * location, then advance their strategic routes from persisted timestamps.
 * No client-provided location or combat outcome enters this path.
 */
export async function getUniversePatrolDirectory(
  userId: string,
  now = new Date(),
): Promise<WorldPatrolDirectory> {
  await db.insert(playerWorldStateTable).values({ userId }).onConflictDoNothing();
  const [world] = await db
    .select({ currentLocation: playerWorldStateTable.currentLocation })
    .from(playerWorldStateTable)
    .where(eq(playerWorldStateTable.userId, userId));
  if (!world) throw new Error("Player world location could not be loaded.");

  const visibleLocations = neighboringLocations(world.currentLocation);
  const visibleSet = new Set(visibleLocations);
  const seeds = createSeededPatrols(WORLD_PATROL_SECTOR_NETWORK, now)
    .filter((patrol) => visibleSet.has(patrol.originLocationId));
  if (seeds.length > 0) {
    await db.insert(universePatrolsTable).values(seeds).onConflictDoNothing();
  }

  const candidates = await db
    .select()
    .from(universePatrolsTable)
    .where(inArray(universePatrolsTable.currentLocationId, visibleLocations));
  const currentRows = [];

  for (const candidate of candidates) {
    if (candidate.activeEncounterId &&
        candidate.encounterLeaseExpiresAt &&
        candidate.encounterLeaseExpiresAt > now) {
      currentRows.push(candidate);
      continue;
    }
    const advanced = advancePatrol(candidate, now);
    if (advanced.revision === candidate.revision) {
      currentRows.push(candidate);
      continue;
    }

    const [updated] = await db
      .update(universePatrolsTable)
      .set({
        currentLocationId: advanced.currentLocationId,
        routeIndex: advanced.routeIndex,
        lastMovedAt: advanced.lastMovedAt,
        revision: advanced.revision,
        updatedAt: now,
      })
      .where(and(
        eq(universePatrolsTable.patrolId, candidate.patrolId),
        eq(universePatrolsTable.revision, candidate.revision),
      ))
      .returning();
    if (updated) {
      currentRows.push(updated);
      continue;
    }

    // Another API worker won the compare-and-set. Read its durable result;
    // never guess or advance the same fleet twice in process-local memory.
    const [latest] = await db
      .select()
      .from(universePatrolsTable)
      .where(eq(universePatrolsTable.patrolId, candidate.patrolId));
    if (latest) currentRows.push(latest);
  }

  const patrols = currentRows
    .filter((patrol) => patrol.currentLocationId === world.currentLocation && patrol.shipRoster.length > 0)
    .map((patrol) => ({
      id: patrol.patrolId,
      callsign: patrol.callsign,
      faction: patrol.faction,
      objective: patrol.objective,
      locationId: patrol.currentLocationId,
      route: patrol.route,
      ships: patrol.shipRoster,
      lastMovedAt: patrol.lastMovedAt,
    }))
    .sort((left, right) =>
      left.faction.localeCompare(right.faction) || left.callsign.localeCompare(right.callsign),
    );
  const traffic = currentRows
    .filter((patrol) => visibleSet.has(patrol.currentLocationId) && patrol.shipRoster.length > 0)
    .sort((left, right) =>
      left.currentLocationId.localeCompare(right.currentLocationId) ||
      left.faction.localeCompare(right.faction) ||
      left.patrolId.localeCompare(right.patrolId),
    )
    .flatMap((patrol) => projectPatrolTraffic(
      patrol,
      world.currentLocation,
      WORLD_LOCATION_COORDINATES,
      now,
    ))
    .slice(0, 512);

  return {
    generatedAt: now,
    currentLocationId: world.currentLocation,
    simulationLayer: "strategic",
    patrols,
    traffic,
  };
}
