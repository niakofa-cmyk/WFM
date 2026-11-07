import type {
  PatrolFaction,
  PatrolObjective,
  PersistentPatrolShip,
} from "@workspace/db";

export const PATROL_WAYPOINT_INTERVAL_MS = 120_000;

export type PatrolSectorNetwork = Readonly<Record<string, readonly string[]>>;

export type GeneratedPatrol = {
  patrolId: string;
  originLocationId: string;
  currentLocationId: string;
  faction: PatrolFaction;
  objective: PatrolObjective;
  callsign: string;
  shipRoster: PersistentPatrolShip[];
  route: string[];
  routeIndex: number;
  lastMovedAt: Date;
  revision: number;
  updatedAt: Date;
};

const HULLS: Record<PatrolFaction, readonly { id: PersistentPatrolShip["hullId"]; name: string }[]> = {
  accord: [
    { id: "mandjet", name: "Mandjet" },
    { id: "shakuna", name: "Shakuna" },
    { id: "sundara", name: "Sundara" },
    { id: "tripura", name: "Tripura" },
  ],
  ussf: [
    { id: "duskbreaker", name: "Duskbreaker" },
    { id: "sentinel", name: "Sentinel-G" },
    { id: "splitter", name: "Splitter Ring" },
    { id: "glide", name: "Glide Knife" },
  ],
};

const OBJECTIVES: readonly PatrolObjective[] = [
  "recon",
  "route-security",
  "escort",
  "supply-screen",
];

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function timeBucket(date: Date): Date {
  return new Date(Math.floor(date.getTime() / PATROL_WAYPOINT_INTERVAL_MS) * PATROL_WAYPOINT_INTERVAL_MS);
}

export function createSeededPatrols(
  network: PatrolSectorNetwork,
  now: Date,
): GeneratedPatrol[] {
  const seededAt = timeBucket(now);
  const locationIds = Object.keys(network).sort();
  const patrols: GeneratedPatrol[] = [];

  for (const originLocationId of locationIds) {
    const neighbors = [...new Set(network[originLocationId] ?? [])]
      .filter((id) => id !== originLocationId && locationIds.includes(id))
      .sort();
    if (neighbors.length === 0) continue;

    for (const faction of ["ussf", "accord"] as const) {
      const patrolId = `strategic-patrol-v1:${originLocationId}:${faction}:0`;
      const seed = stableHash(patrolId);
      const destination = neighbors[stableHash(`${patrolId}:route`) % neighbors.length];
      const shipCount = 2 + stableHash(`${patrolId}:size`) % 3;
      const hulls = HULLS[faction];
      const shipRoster = Array.from({ length: shipCount }, (_, index) => {
        const hull = hulls[stableHash(`${patrolId}:hull:${index}`) % hulls.length];
        const suffix = (stableHash(`${patrolId}:callsign:${index}`) % 900) + 100;
        return {
          id: `${patrolId}:ship:${index + 1}`,
          hullId: hull.id,
          name: hull.name,
          callsign: `${faction === "ussf" ? "U" : "A"}-${suffix}`,
        };
      });
      patrols.push({
        patrolId,
        originLocationId,
        currentLocationId: originLocationId,
        faction,
        objective: OBJECTIVES[stableHash(`${patrolId}:objective`) % OBJECTIVES.length],
        callsign: `${faction === "ussf" ? "USSF" : "ACCORD"}-${(seed % 0x10000).toString(16).padStart(4, "0").toUpperCase()}`,
        shipRoster,
        route: [originLocationId, destination],
        routeIndex: 0,
        lastMovedAt: seededAt,
        revision: 0,
        updatedAt: seededAt,
      });
    }
  }

  return patrols;
}

export type PatrolMovementState = Pick<
  GeneratedPatrol,
  "route" | "routeIndex" | "currentLocationId" | "lastMovedAt" | "revision" | "updatedAt"
>;

export function advancePatrol<T extends PatrolMovementState>(
  patrol: T,
  now: Date,
): T {
  if (patrol.route.length < 2 || patrol.routeIndex >= patrol.route.length) return patrol;
  const elapsed = now.getTime() - patrol.lastMovedAt.getTime();
  const steps = Math.floor(elapsed / PATROL_WAYPOINT_INTERVAL_MS);
  if (steps <= 0) return patrol;

  const routeIndex = (patrol.routeIndex + steps) % patrol.route.length;
  return {
    ...patrol,
    routeIndex,
    currentLocationId: patrol.route[routeIndex],
    lastMovedAt: new Date(patrol.lastMovedAt.getTime() + steps * PATROL_WAYPOINT_INTERVAL_MS),
    revision: patrol.revision + steps,
    updatedAt: now,
  };
}
