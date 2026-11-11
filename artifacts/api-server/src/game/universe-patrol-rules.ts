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

/** Create new, durable reserve formations without reusing casualty identities. */
export function createPopulationReservePatrols(
  network: PatrolSectorNetwork,
  faction: PatrolFaction,
  epoch: number,
  hullCount: number,
  now: Date,
): GeneratedPatrol[] {
  if (!Number.isSafeInteger(epoch) || epoch < 1 ||
      !Number.isSafeInteger(hullCount) || hullCount < 2 || hullCount > 128 ||
      hullCount % 2 !== 0 || !Number.isFinite(now.getTime()) ||
      (faction !== "ussf" && faction !== "accord")) {
    throw new Error("Invalid population reserve formation request.");
  }
  const locations = Object.keys(network).sort();
  const eligible = locations.filter((locationId) =>
    (network[locationId] ?? []).some((neighbor) =>
      neighbor !== locationId && locations.includes(neighbor)));
  if (!eligible.length) throw new Error("Population reserve route network is empty.");

  const fleets: GeneratedPatrol[] = [];
  let remaining = hullCount;
  let fleetIndex = 0;
  while (remaining > 0) {
    fleetIndex += 1;
    const count = Math.min(4, remaining);
    const patrolId = `population-reserve-v1:${faction}:${epoch}:${fleetIndex}`;
    const seed = stableHash(patrolId);
    const originLocationId = eligible[seed % eligible.length]!;
    const neighbors = [...new Set(network[originLocationId] ?? [])]
      .filter((locationId) => locationId !== originLocationId && locations.includes(locationId))
      .sort();
    if (!neighbors.length) throw new Error("Population reserve has no connected route.");
    const destination = neighbors[stableHash(`${patrolId}:route`) % neighbors.length]!;
    const hulls = HULLS[faction];
    const shipRoster = Array.from({ length: count }, (_, index) => {
      const hull = hulls[stableHash(`${patrolId}:hull:${index}`) % hulls.length]!;
      return {
        id: `${patrolId}:ship:${index + 1}`,
        hullId: hull.id,
        name: hull.name,
        callsign: `${faction === "ussf" ? "U" : "A"}-R${(stableHash(`${patrolId}:callsign:${index}`) % 900) + 100}`,
      };
    });
    fleets.push({
      patrolId,
      originLocationId,
      currentLocationId: originLocationId,
      faction,
      objective: "route-security",
      callsign: `${faction === "ussf" ? "USSF" : "ACCORD"}-RESERVE-${epoch}-${fleetIndex}`,
      shipRoster,
      route: [originLocationId, destination],
      routeIndex: 0,
      lastMovedAt: timeBucket(now),
      revision: 0,
      updatedAt: now,
    });
    remaining -= count;
  }
  return fleets;
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

export type PatrolTrafficCoordinates = Readonly<Record<string, { x: number; y: number }>>;
export type PatrolTrafficContact = {
  contactId: string;
  faction: PatrolFaction;
  hullId: PersistentPatrolShip["hullId"];
  locationId: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  yaw: number;
};
export type PatrolTrafficSource = Pick<
  GeneratedPatrol,
  "patrolId" | "currentLocationId" | "faction" | "shipRoster" | "route" | "routeIndex" | "lastMovedAt"
>;

/**
 * Project a persisted strategic route into a small, anonymous local 3D scene.
 * Pose is derived from server route timestamps, so polling clients observe the
 * same moving fleet without adding another simulation or storing client poses.
 */
export function projectPatrolTraffic(
  patrol: PatrolTrafficSource,
  anchorLocationId: string,
  coordinates: PatrolTrafficCoordinates,
  now: Date,
): PatrolTrafficContact[] {
  if (patrol.route.length < 2 || patrol.shipRoster.length === 0) return [];
  const start = coordinates[patrol.currentLocationId];
  const anchor = coordinates[anchorLocationId];
  const nextLocationId = patrol.route[(patrol.routeIndex + 1) % patrol.route.length];
  const destination = nextLocationId ? coordinates[nextLocationId] : undefined;
  if (!start || !anchor || !destination ||
      ![start.x, start.y, anchor.x, anchor.y, destination.x, destination.y].every(Number.isFinite)) return [];

  const elapsed = Math.max(0, now.getTime() - patrol.lastMovedAt.getTime());
  const progress = Math.max(0, Math.min(1, elapsed / PATROL_WAYPOINT_INTERVAL_MS));
  const dx = destination.x - start.x;
  const dz = destination.y - start.y;
  const length = Math.hypot(dx, dz) || 1;
  const forwardX = dx / length;
  const forwardZ = dz / length;
  const rightX = forwardZ;
  const rightZ = -forwardX;
  const scale = 0.52;
  const fleetX = (start.x + dx * progress - anchor.x) * scale;
  const fleetZ = (start.y + dz * progress - anchor.y) * scale;
  const intervalSeconds = PATROL_WAYPOINT_INTERVAL_MS / 1000;
  const velocity = {
    x: dx * scale / intervalSeconds,
    y: 0,
    z: dz * scale / intervalSeconds,
  };
  const yaw = Math.atan2(-forwardX, -forwardZ);

  return patrol.shipRoster.slice(0, 4).map((ship, index) => {
    const side = (index % 2 === 0 ? -1 : 1) * 2.3;
    const aft = Math.floor(index / 2) * 2.8;
    return {
      contactId: `${patrol.patrolId}:contact:${index + 1}`,
      faction: patrol.faction,
      hullId: ship.hullId,
      locationId: patrol.currentLocationId,
      position: {
        x: fleetX + rightX * side - forwardX * aft,
        y: 1.8 + Math.floor(index / 2) * 0.8,
        z: fleetZ + rightZ * side - forwardZ * aft,
      },
      velocity,
      yaw,
    };
  });
}
