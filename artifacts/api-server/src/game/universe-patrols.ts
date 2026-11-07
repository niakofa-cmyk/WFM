import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  playerWorldStateTable,
  universePatrolsTable,
} from "@workspace/db";
import type { WorldPatrolDirectory } from "@workspace/api-zod";
import { advancePatrol, createSeededPatrols } from "./universe-patrol-rules";
import { WORLD_PATROL_SECTOR_NETWORK } from "./world";

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
    .filter((patrol) => patrol.currentLocationId === world.currentLocation)
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

  return {
    generatedAt: now,
    currentLocationId: world.currentLocation,
    simulationLayer: "strategic",
    patrols,
  };
}
