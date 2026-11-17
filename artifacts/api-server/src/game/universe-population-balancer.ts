import { and, eq } from "drizzle-orm";
import {
  db,
  universePatrolsTable,
  universePopulationEpochsTable,
  universePopulationStateTable,
} from "@workspace/db";
import {
  createPopulationReservePatrols,
  createSeededPatrols,
} from "./universe-patrol-rules";
import {
  desiredAiFactionMixFromActivePilots,
  planAiHullReinforcements,
  type PilotFactionCounts,
  type PersistentAiHullCounts,
  type UniverseFaction,
} from "./universe-population-policy";
import { WORLD_PATROL_SECTOR_NETWORK } from "./world";

export type GlobalActivePilotCensus = Readonly<{
  capturedAt: number;
  /** Local receipt timestamp; unlike capturedAt, shares the socket's clock. */
  observedAt?: number;
  activePilotsByFaction: Readonly<{ ussf: number; accord: number }>;
  total: number;
}>;

export type UniversePopulationEpochResult =
  | { status: "stale-census" | "empty-census" | "cadence" | "balanced" | "capacity" }
  | {
      status: "applied";
      epoch: number;
      faction: UniverseFaction;
      addedHullCount: number;
      patrolCount: number;
      actualBefore: PersistentAiHullCounts;
      actualAfter: PersistentAiHullCounts;
      target: Readonly<{ ussf: number; accord: number }>;
    };

const CENSUS_MAX_AGE_MS = 15_000;
const MIN_EPOCH_INTERVAL_MS = 5 * 60_000;
const MAX_ADDED_HULLS_PER_EPOCH = 8;
const MAX_ADDITIONAL_HULLS_WORLDWIDE = 128;
const MIN_ACTUAL_SHARE_GAP = 0.08;

export async function assertUniversePopulationSchemaReady(): Promise<void> {
  await Promise.all([
    db.select({ controllerId: universePopulationStateTable.controllerId })
      .from(universePopulationStateTable).limit(1),
    db.select({ epoch: universePopulationEpochsTable.epoch })
      .from(universePopulationEpochsTable).limit(1),
  ]);
}

export function maximumHostileAiShareFromEnvironment(value: string | undefined): number {
  if (value === undefined || value === "") return 0.8;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 0.9) {
    throw new Error("ORBITAL_FREE_FLIGHT_MAX_HOSTILE_SHARE must be between 0.5 and 0.9.");
  }
  return parsed;
}

function pilotCounts(census: GlobalActivePilotCensus): PilotFactionCounts {
  const { ussf, accord } = census.activePilotsByFaction;
  if (![census.capturedAt, census.observedAt ?? census.capturedAt,
    census.total, ussf, accord].every(Number.isSafeInteger) ||
      census.total !== ussf + accord || ussf < 0 || accord < 0) {
    throw new Error("Invalid shared active-pilot census.");
  }
  return { ussf, accord, total: census.total };
}

function countPatrolHulls(rows: readonly {
  faction: string;
  shipRoster: readonly unknown[];
}[]): PersistentAiHullCounts {
  let ussf = 0;
  let accord = 0;
  for (const row of rows) {
    if (row.faction !== "ussf" && row.faction !== "accord") {
      throw new Error("Stored universe patrol has an invalid faction.");
    }
    if (!Array.isArray(row.shipRoster)) {
      throw new Error("Stored universe patrol has an invalid ship roster.");
    }
    if (row.faction === "ussf") ussf += row.shipRoster.length;
    else accord += row.shipRoster.length;
  }
  if (!Number.isSafeInteger(ussf) || !Number.isSafeInteger(accord)) {
    throw new Error("Stored universe hull count exceeds the safe integer range.");
  }
  return { ussf, accord };
}

/**
 * One Postgres row lock serializes all socket replicas. Base fleets are
 * materialized idempotently, and each balance epoch inserts new reserve patrols
 * in the same transaction as its monotonic epoch receipt. Existing patrols and
 * confirmed casualties are never rewritten.
 */
export async function applyUniversePopulationEpoch(
  census: GlobalActivePilotCensus,
  options: {
    now?: Date;
    maximumHostileShare?: number;
  } = {},
): Promise<UniversePopulationEpochResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const counts = pilotCounts(census);
  const observedAt = census.observedAt ?? census.capturedAt;
  if (!Number.isFinite(nowMs)) throw new Error("Invalid population epoch time.");
  // Redis applies freshness using its own clock while pruning leases. Validate
  // only the elapsed time since this socket received the read; comparing Redis
  // absolute time with each replica's wall clock can reject a fresh census
  // when their clocks differ.
  if (nowMs < observedAt || nowMs - observedAt > CENSUS_MAX_AGE_MS) {
    return { status: "stale-census" };
  }
  if (counts.total === 0) return { status: "empty-census" };

  const target = desiredAiFactionMixFromActivePilots(
    counts,
    options.maximumHostileShare ?? 0.8,
  );
  const baseline = createSeededPatrols(WORLD_PATROL_SECTOR_NETWORK, now);
  const baselineHullCount = baseline.reduce((sum, patrol) => sum + patrol.shipRoster.length, 0);
  const maximumTotalHulls = baselineHullCount + MAX_ADDITIONAL_HULLS_WORLDWIDE;

  return db.transaction(async (tx) => {
    await tx.insert(universePopulationStateTable)
      .values({ controllerId: "global" })
      .onConflictDoNothing();
    const [state] = await tx.select().from(universePopulationStateTable)
      .where(eq(universePopulationStateTable.controllerId, "global"))
      .for("update");
    if (!state) throw new Error("Universe population controller row is unavailable.");
    if (state.lastAppliedAt &&
        nowMs - state.lastAppliedAt.getTime() < MIN_EPOCH_INTERVAL_MS) {
      return { status: "cadence" } as const;
    }

    await tx.insert(universePatrolsTable).values(baseline).onConflictDoNothing();
    const rosterRows = await tx.select({
      faction: universePatrolsTable.faction,
      shipRoster: universePatrolsTable.shipRoster,
    }).from(universePatrolsTable);
    const actualBefore = countPatrolHulls(rosterRows);
    const plan = planAiHullReinforcements(
      actualBefore,
      target,
      maximumTotalHulls,
      MAX_ADDED_HULLS_PER_EPOCH,
      MIN_ACTUAL_SHARE_GAP,
    );
    const targetUssfShareBps = Math.round(target.ussf * 10_000);
    const censusState = {
      lastEvaluatedAt: now,
      lastCensusAt: new Date(census.capturedAt),
      activeUssfPilots: counts.ussf,
      activeAccordPilots: counts.accord,
      targetUssfShareBps,
      actualUssfHullCount: actualBefore.ussf,
      actualAccordHullCount: actualBefore.accord,
      updatedAt: now,
    };

    if (!plan.faction || plan.hullCount === 0) {
      await tx.update(universePopulationStateTable)
        .set(censusState)
        .where(eq(universePopulationStateTable.controllerId, "global"));
      return {
        status: actualBefore.ussf + actualBefore.accord >= maximumTotalHulls
          ? "capacity"
          : "balanced",
      } as const;
    }

    const nextEpoch = state.epoch + 1;
    if (!Number.isSafeInteger(nextEpoch) || nextEpoch <= state.epoch) {
      throw new Error("Universe population epoch overflow.");
    }
    const reserveFleets = createPopulationReservePatrols(
      WORLD_PATROL_SECTOR_NETWORK,
      plan.faction,
      nextEpoch,
      plan.hullCount,
      now,
    );
    const inserted = await tx.insert(universePatrolsTable)
      .values(reserveFleets)
      .onConflictDoNothing()
      .returning({ patrolId: universePatrolsTable.patrolId });
    if (inserted.length !== reserveFleets.length) {
      throw new Error("Universe population epoch collided with an existing reserve identity.");
    }

    const actualAfter = {
      ...actualBefore,
      [plan.faction]: actualBefore[plan.faction] + plan.hullCount,
    };
    const patrolIds = inserted.map((row) => row.patrolId);
    await tx.insert(universePopulationEpochsTable).values({
      epoch: nextEpoch,
      censusCapturedAt: new Date(census.capturedAt),
      activeUssfPilots: counts.ussf,
      activeAccordPilots: counts.accord,
      targetUssfShareBps,
      ussfHullsBefore: actualBefore.ussf,
      accordHullsBefore: actualBefore.accord,
      addedFaction: plan.faction,
      addedHullCount: plan.hullCount,
      patrolIds,
      createdAt: now,
    });
    const stateUpdated = await tx.update(universePopulationStateTable).set({
      ...censusState,
      epoch: nextEpoch,
      lastAppliedAt: now,
      actualUssfHullCount: actualAfter.ussf,
      actualAccordHullCount: actualAfter.accord,
      lastAddedPatrolIds: patrolIds,
    }).where(and(
      eq(universePopulationStateTable.controllerId, "global"),
      eq(universePopulationStateTable.epoch, state.epoch),
    )).returning({ epoch: universePopulationStateTable.epoch });
    if (stateUpdated.length !== 1 || stateUpdated[0]?.epoch !== nextEpoch) {
      throw new Error("Universe population epoch lost its controller revision.");
    }
    return {
      status: "applied",
      epoch: nextEpoch,
      faction: plan.faction,
      addedHullCount: plan.hullCount,
      patrolCount: reserveFleets.length,
      actualBefore,
      actualAfter,
      target,
    } as const;
  });
}

/** Low-rate, private operational event; never includes pilot IDs or positions. */
export function populationEpochLogFields(result: UniversePopulationEpochResult) {
  if (result.status !== "applied") return { status: result.status };
  return {
    status: result.status,
    epoch: result.epoch,
    faction: result.faction,
    addedHullCount: result.addedHullCount,
    patrolCount: result.patrolCount,
    actualBefore: result.actualBefore,
    actualAfter: result.actualAfter,
    target: result.target,
  };
}
