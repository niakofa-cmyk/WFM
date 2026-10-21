import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  playerProgressTable,
  playerInventoryTable,
  playerQuestsTable,
  playerWorldStateTable,
  progressionEventsTable,
  worldDiscoveriesTable,
} from "@workspace/db";
import type {
  ExploreLocationResult,
  WorldQuestActionInput,
  WorldQuestActionResult,
  WorldState,
  WorldTravelResult,
} from "@workspace/api-zod";
import { ensureCurrentWorldEvent, type DbTransaction } from "./market";
import { buildActivities } from "./world-activities";
import { clampStanding, gateReason, requirements, routeFare, returnLane } from "./world-rules";
import { adjustedFare, cargoCapacity, cargoUsed, installedUpgrades } from "./economy-rules";
import { recentRejections } from "./economy-audit";
import { worldEventRules } from "./world-event-rules";

type LocationDefinition = WorldState["locations"][number];
type QuestDefinition = Omit<WorldState["quests"][number], "status">;
type RouteDefinition = { destinationId: string; costCredits: number };

const LOCATIONS: Omit<LocationDefinition, "unlocked" | "explored">[] = [
  {
    id: "outer-fringe", name: "Outer Fringe Anchorage", kind: "station", x: 28, y: 12, unlockAfter: 1,
    description: "A frontier salvage exchange beyond the old convoy lanes. Better surveyed wrecks supply the faction fleets.",
    services: ["Market", "Salvage", "Faction contracts"],
  },
  {
    id: "deep-nebula", name: "Deep Nebula Observatory", kind: "station", x: 10, y: 84, unlockAfter: 3,
    description: "A restricted research port. Trusted pilots can study the signal or trade contraband at a lasting diplomatic cost.",
    services: ["Research", "Black market", "Faction contracts"],
  },
  {
    id: "phobos-yard",
    name: "Phobos Yard",
    kind: "station",
    x: 18,
    y: 52,
    unlockAfter: 0,
    description: "A crowded repair yard built into Phobos's shadow. The market and dispatch boards are always open.",
    services: ["Market", "Refinery", "Material refits", "Hyperdrive", "Contracts"],
  },
  {
    id: "rust-disc",
    name: "Rust Disc",
    kind: "relay",
    x: 38,
    y: 70,
    unlockAfter: 0,
    description: "A dead communications relay, still carrying a faint recording from the first Mars convoy.",
    services: ["Discovery", "Salvage"],
  },
  {
    id: "pale-beacons",
    name: "Pale Beacons",
    kind: "relay",
    x: 53,
    y: 28,
    unlockAfter: 1,
    description: "A chain of navigation beacons that has started transmitting the same impossible heading.",
    services: ["Discovery", "Beacon service"],
  },
  {
    id: "night-side",
    name: "Night-side Station",
    kind: "station",
    x: 70,
    y: 66,
    unlockAfter: 2,
    description: "An uncrewed station on the dark side of Mars. Its sealed black box is still warm.",
    services: ["Discovery", "Wreck access"],
  },
  {
    id: "dust-lane",
    name: "Dust Lane",
    kind: "ruins",
    x: 82,
    y: 38,
    unlockAfter: 3,
    description: "A debris field where salvage crews report seeing a fleet move without drive signatures.",
    services: ["Discovery", "Salvage"],
  },
  {
    id: "mars-signal",
    name: "Below the Signal",
    kind: "ruins",
    x: 92,
    y: 78,
    unlockAfter: 4,
    description: "The source of the convoy's final transmission, now visible on every long-range scope.",
    services: ["Discovery", "Campaign lead"],
  },
];

const ROUTES: Record<string, RouteDefinition[]> = {
  "phobos-yard": [{ destinationId: "rust-disc", costCredits: 8 }, { destinationId: "outer-fringe", costCredits: 20 }],
  "outer-fringe": [{ destinationId: "phobos-yard", costCredits: 20 }, { destinationId: "deep-nebula", costCredits: 35 }],
  "deep-nebula": [{ destinationId: "outer-fringe", costCredits: 35 }],
  "rust-disc": [
    { destinationId: "phobos-yard", costCredits: 8 },
    { destinationId: "pale-beacons", costCredits: 12 },
  ],
  "pale-beacons": [
    { destinationId: "rust-disc", costCredits: 12 },
    { destinationId: "night-side", costCredits: 16 },
  ],
  "night-side": [
    { destinationId: "pale-beacons", costCredits: 16 },
    { destinationId: "dust-lane", costCredits: 20 },
  ],
  "dust-lane": [
    { destinationId: "night-side", costCredits: 20 },
    { destinationId: "mars-signal", costCredits: 26 },
  ],
  "mars-signal": [{ destinationId: "dust-lane", costCredits: 26 }],
};

const QUESTS: QuestDefinition[] = [
  {
    id: "rust-recording",
    title: "The Rust Recording",
    description: "Recover the relay's last clean transmission from the Rust Disc.",
    requiredClear: 0,
    requiredLocation: "rust-disc",
    rewardCredits: 45,
    reputationReward: 2,
  },
  {
    id: "beacon-keepers",
    title: "Beacon Keepers",
    description: "Inspect the Pale Beacons after your first successful Strike.",
    requiredClear: 1,
    requiredLocation: "pale-beacons",
    rewardCredits: 70,
    reputationReward: 3,
  },
  {
    id: "warden-blackbox",
    title: "Warden Black Box",
    description: "Open the Night-side Station's recorder after three cleared sorties.",
    requiredClear: 3,
    requiredLocation: "night-side",
    rewardCredits: 120,
    reputationReward: 5,
  },
  {
    id: "signal-below",
    title: "Below the Signal",
    description: "Follow the campaign to the source of the Mars transmission.",
    requiredClear: 4,
    requiredLocation: "mars-signal",
    rewardCredits: 180,
    reputationReward: 8,
  },
];

const MAX_CREDITS = 2_000_000_000;

export class WorldError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorldError";
  }
}

function eventResponse(event: Awaited<ReturnType<typeof ensureCurrentWorldEvent>>) {
  return {
    eventId: event.eventId,
    title: event.title,
    description: `${event.description} ${worldEventRules(event.eventId).summary}`,
    cycleDate: new Date(`${event.cycleDate}T00:00:00.000Z`),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  };
}

async function ensurePlayerRows(tx: DbTransaction, userId: string) {
  await tx.insert(playerProgressTable).values({ userId }).onConflictDoNothing();
  await tx.insert(playerWorldStateTable).values({ userId }).onConflictDoNothing();
}

export async function worldSnapshotInTransaction(tx: DbTransaction, userId: string): Promise<WorldState> {
  await ensurePlayerRows(tx, userId);
  const [profile] = await tx.select().from(playerProgressTable).where(eq(playerProgressTable.userId, userId));
  const [world] = await tx.select().from(playerWorldStateTable).where(eq(playerWorldStateTable.userId, userId));
  if (!profile || !world) throw new Error("Player world state could not be loaded.");
  const event = await ensureCurrentWorldEvent(tx);
  const discoveries = await tx
    .select()
    .from(worldDiscoveriesTable)
    .where(eq(worldDiscoveriesTable.userId, userId));
  const playerQuests = await tx
    .select()
    .from(playerQuestsTable)
    .where(eq(playerQuestsTable.userId, userId));
  const discoveredIds = new Set(discoveries.map((item) => item.locationId));
  const questRows = new Map(playerQuests.map((item) => [item.questId, item]));
  const locations: LocationDefinition[] = LOCATIONS.map((location) => ({
    ...location,
    ...requirements(location.id),
    lockReason: gateReason(location, profile.cleared, world.hyperdriveTier, profile.faction === "ussf" ? world.ussfReputation : world.accordReputation),
    unlocked: !gateReason(location, profile.cleared, world.hyperdriveTier, profile.faction === "ussf" ? world.ussfReputation : world.accordReputation),
    explored: discoveredIds.has(location.id),
  }));
  if (!LOCATIONS.some((location) => location.id === world.currentLocation)) {
    throw new Error("Stored player location is not part of the current theater.");
  }
  const routes: WorldState["routes"] = (ROUTES[world.currentLocation] ?? []).map((route) => {
    const destination = LOCATIONS.find((location) => location.id === route.destinationId);
    if (!destination) throw new Error(`World route points to unknown location ${route.destinationId}.`);
    return {
      ...route,
      costCredits: adjustedFare(routeFare(destination.id, route.costCredits, event.eventId), profile.driveEfficiency),
      available: !gateReason(destination, profile.cleared, world.hyperdriveTier, returnLane(world.currentLocation, destination.id) ? 100 : profile.faction === "ussf" ? world.ussfReputation : world.accordReputation),
    };
  });
  const quests = QUESTS.map((quest) => {
    const row = questRows.get(quest.id);
    const unlocked =
      profile.cleared >= quest.requiredClear &&
      profile.cleared >= (LOCATIONS.find((location) => location.id === quest.requiredLocation)?.unlockAfter ?? 99);
    const explored = discoveredIds.has(quest.requiredLocation);
    const status: WorldState["quests"][number]["status"] = row?.status === "claimed"
      ? "claimed"
      : row?.status === "accepted"
        ? explored && world.currentLocation === quest.requiredLocation ? "ready" : "accepted"
        : unlocked ? "available" : "locked";
    return { ...quest, status };
  });
  const inventory = await tx.select().from(playerInventoryTable).where(eq(playerInventoryTable.userId, userId));
  const completedRows = await tx.select().from(progressionEventsTable).where(and(
    eq(progressionEventsTable.userId, userId), eq(progressionEventsTable.kind, "world_service"),
    sql`${progressionEventsTable.result}->>'cycleDate' = ${event.cycleDate}`,
    sql`${progressionEventsTable.result}->>'locationId' = ${world.currentLocation}`,
  ));
  const history = await tx.select().from(progressionEventsTable)
    .where(and(eq(progressionEventsTable.userId, userId), eq(progressionEventsTable.kind, "world_service")))
    .orderBy(desc(progressionEventsTable.createdAt)).limit(20);
  return {
    hyperdriveTier: world.hyperdriveTier,
    cargoUsed: cargoUsed(inventory), cargoCapacity: cargoCapacity(profile), installedUpgrades: installedUpgrades(profile),
    rejections: await recentRejections(tx, userId),
    inventory: inventory.map(({ goodId, quantity }) => ({ goodId: goodId as "salt" | "iron" | "dust" | "resin", quantity })),
    activities: buildActivities({
      locationId: world.currentLocation, eventId: event.eventId, refit: profile.refit, tier: world.hyperdriveTier,
      standing: profile.faction === "ussf" ? world.ussfReputation : world.accordReputation, credits: profile.credits,
      inventory, completed: new Set(completedRows.map((row) => String(row.result.serviceId))),
      explored: discoveredIds.has(world.currentLocation),
      upgrades: profile, cleared: profile.cleared,
    }),
    history: history.map((row) => ({ id: row.id, title: String(row.result.title ?? "World activity"), creditsDelta: row.amount, createdAt: row.createdAt })),
    event: eventResponse(event),
    reputation: {
      accord: world.accordReputation,
      ussf: world.ussfReputation,
    },
    currentLocation: world.currentLocation,
    routes,
    locations,
    discoveries: [...discoveredIds],
    quests,
  };
}

export async function getWorldSnapshot(userId: string) {
  return db.transaction((tx) => worldSnapshotInTransaction(tx, userId));
}

export async function lockedPlayerRows(tx: DbTransaction, userId: string) {
  await ensurePlayerRows(tx, userId);
  const [profile] = await tx
    .select()
    .from(playerProgressTable)
    .where(eq(playerProgressTable.userId, userId))
    .for("update");
  const [world] = await tx
    .select()
    .from(playerWorldStateTable)
    .where(eq(playerWorldStateTable.userId, userId))
    .for("update");
  if (!profile || !world) throw new Error("Player world state could not be locked.");
  return { profile, world };
}

export async function findActionEvent(tx: DbTransaction, userId: string, key: string, action: string, targetId: string) {
  const [event] = await tx
    .select()
    .from(progressionEventsTable)
    .where(and(
      eq(progressionEventsTable.userId, userId),
      eq(progressionEventsTable.idempotencyKey, key),
    ));
  if (!event) return null;
  const previousResult = event.result as { action?: string; targetId?: string };
  if (previousResult.action !== action || previousResult.targetId !== targetId) {
    throw new WorldError("This request key was already used for a different world action.", 409);
  }
  return event;
}

export async function travelToWorldLocation(
  userId: string,
  destinationId: string,
  idempotencyKey: string,
  maxCost?: number,
): Promise<WorldTravelResult> {
  const destination = LOCATIONS.find((location) => location.id === destinationId);
  if (!destination) throw new WorldError("That location does not exist.", 404);
  return db.transaction(async (tx) => {
    const { profile, world } = await lockedPlayerRows(tx, userId);
    const previous = await findActionEvent(tx, userId, idempotencyKey, "travel", destinationId);
    if (previous) {
      return {
        world: await worldSnapshotInTransaction(tx, userId),
        credits: profile.credits,
        travelCost: Math.max(0, -previous.amount),
        replayed: true,
      };
    }
    const route = (ROUTES[world.currentLocation] ?? []).find(
      (candidate) => candidate.destinationId === destinationId,
    );
    if (!route) throw new WorldError("That location is not connected to your current route.", 400);
    const event = await ensureCurrentWorldEvent(tx);
    const reason = gateReason(destination, profile.cleared, world.hyperdriveTier, returnLane(world.currentLocation, destination.id) ? 100 : profile.faction === "ussf" ? world.ussfReputation : world.accordReputation);
    if (reason) throw new WorldError(reason, 400);
    const fare = adjustedFare(routeFare(destinationId, route.costCredits, event.eventId), profile.driveEfficiency);
    if (maxCost !== undefined && fare > maxCost) throw new WorldError("The route fare changed. Review the current fare before travelling.", 409);
    if (profile.credits < fare) {
      throw new WorldError("You do not have enough credits to pay the route fare.", 400);
    }

    const creditsAfter = profile.credits - fare;
    await tx
      .update(playerProgressTable)
      .set({
        credits: creditsAfter,
        revision: profile.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerProgressTable.userId, userId));
    await tx
      .update(playerWorldStateTable)
      .set({
        currentLocation: destinationId,
        revision: world.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerWorldStateTable.userId, userId));
    await tx.insert(progressionEventsTable).values({
      userId,
      idempotencyKey,
      kind: "world_travel",
      amount: -fare,
      balanceBefore: profile.credits,
      balanceAfter: creditsAfter,
      result: {
        action: "travel",
        targetId: destinationId,
        fromLocation: world.currentLocation,
        toLocation: destinationId,
      },
    });
    return {
      world: await worldSnapshotInTransaction(tx, userId),
      credits: creditsAfter,
      travelCost: fare,
      replayed: false,
    };
  });
}

export async function exploreWorldLocation(
  userId: string,
  locationId: string,
  idempotencyKey: string,
): Promise<ExploreLocationResult> {
  const location = LOCATIONS.find((candidate) => candidate.id === locationId);
  if (!location) throw new WorldError("That location does not exist.", 404);
  return db.transaction(async (tx) => {
    const { profile, world } = await lockedPlayerRows(tx, userId);
    const previous = await findActionEvent(tx, userId, idempotencyKey, "explore", locationId);
    if (previous) {
      return {
        world: await worldSnapshotInTransaction(tx, userId),
        newlyExplored: false,
        reputationGain: 0,
      };
    }
    const reason = gateReason(location, profile.cleared, world.hyperdriveTier, profile.faction === "ussf" ? world.ussfReputation : world.accordReputation);
    if (reason) throw new WorldError(reason, 400);
    if (world.currentLocation !== locationId) {
      throw new WorldError("Travel to this location before exploring it.", 400);
    }
    const [discovery] = await tx
      .select()
      .from(worldDiscoveriesTable)
      .where(and(
        eq(worldDiscoveriesTable.userId, userId),
        eq(worldDiscoveriesTable.locationId, locationId),
      ))
      .for("update");
    const newlyExplored = !discovery;
    const reputationGain = newlyExplored ? 1 : 0;
    if (newlyExplored) {
      await tx.insert(worldDiscoveriesTable).values({
        id: randomUUID(),
        userId,
        locationId,
      });
      const faction = profile.faction === "ussf" ? "ussfReputation" : "accordReputation";
      await tx
        .update(playerWorldStateTable)
        .set({
          [faction]: clampStanding(world[faction] + reputationGain),
          revision: world.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(playerWorldStateTable.userId, userId));
      await tx
        .update(playerProgressTable)
        .set({ revision: profile.revision + 1, updatedAt: new Date() })
        .where(eq(playerProgressTable.userId, userId));
    }
    await tx.insert(progressionEventsTable).values({
      userId,
      idempotencyKey,
      kind: "world_exploration",
      amount: 0,
      balanceBefore: profile.credits,
      balanceAfter: profile.credits,
      result: { action: "explore", targetId: locationId, reputationGain },
    });
    return {
      world: await worldSnapshotInTransaction(tx, userId),
      newlyExplored,
      reputationGain,
    };
  });
}

export async function actOnWorldQuest(
  userId: string,
  questId: string,
  input: WorldQuestActionInput,
): Promise<WorldQuestActionResult> {
  const quest = QUESTS.find((candidate) => candidate.id === questId);
  if (!quest) throw new WorldError("That contract does not exist.", 404);
  return db.transaction(async (tx) => {
    const { profile, world } = await lockedPlayerRows(tx, userId);
    const previous = await findActionEvent(tx, userId, input.idempotencyKey, input.action, questId);
    if (previous) {
      return {
        world: await worldSnapshotInTransaction(tx, userId),
        credits: profile.credits,
        rewardCredits: input.action === "claim" ? previous.amount : 0,
        replayed: true,
      };
    }
    const location = LOCATIONS.find((candidate) => candidate.id === quest.requiredLocation);
    const isUnlocked =
      profile.cleared >= quest.requiredClear &&
      profile.cleared >= (location?.unlockAfter ?? 99);
    if (!isUnlocked) throw new WorldError("That contract is still locked by campaign progress.", 400);
    if (input.action === "accept" && world.currentLocation !== "phobos-yard") {
      throw new WorldError("Return to Phobos Yard to accept contracts from dispatch.", 400);
    }
    if (input.action === "claim" && world.currentLocation !== quest.requiredLocation) {
      throw new WorldError("Return to the contract location before claiming its reward.", 400);
    }
    const [questRow] = await tx
      .select()
      .from(playerQuestsTable)
      .where(and(
        eq(playerQuestsTable.userId, userId),
        eq(playerQuestsTable.questId, questId),
      ))
      .for("update");
    if (input.action === "accept") {
      if (!questRow) {
        await tx.insert(playerQuestsTable).values({ userId, questId, status: "accepted" });
      }
      await tx.insert(progressionEventsTable).values({
        userId,
        idempotencyKey: input.idempotencyKey,
        kind: "quest_accept",
        amount: 0,
        balanceBefore: profile.credits,
        balanceAfter: profile.credits,
        result: { action: "accept", targetId: questId },
      });
      return {
        world: await worldSnapshotInTransaction(tx, userId),
        credits: profile.credits,
        rewardCredits: 0,
        replayed: Boolean(questRow),
      };
    }
    if (questRow?.status === "claimed") {
      await tx.insert(progressionEventsTable).values({
        userId,
        idempotencyKey: input.idempotencyKey,
        kind: "quest_reward",
        amount: 0,
        balanceBefore: profile.credits,
        balanceAfter: profile.credits,
        result: { action: "claim", targetId: questId, alreadyClaimed: true },
      });
      return {
        world: await worldSnapshotInTransaction(tx, userId),
        credits: profile.credits,
        rewardCredits: 0,
        replayed: true,
      };
    }
    if (!questRow) throw new WorldError("Accept the contract before claiming its reward.", 400);
    const [discovery] = await tx
      .select()
      .from(worldDiscoveriesTable)
      .where(and(
        eq(worldDiscoveriesTable.userId, userId),
        eq(worldDiscoveriesTable.locationId, quest.requiredLocation),
      ));
    if (!discovery) throw new WorldError("Explore the contract location before claiming its reward.", 400);
    if (profile.credits + quest.rewardCredits > MAX_CREDITS) {
      throw new WorldError("That reward would exceed the credit balance limit.", 400);
    }

    const creditsAfter = profile.credits + quest.rewardCredits;
    await tx
      .update(playerProgressTable)
      .set({
        credits: creditsAfter,
        revision: profile.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerProgressTable.userId, userId));
    const faction = profile.faction === "ussf" ? "ussfReputation" : "accordReputation";
    await tx
      .update(playerWorldStateTable)
      .set({
        [faction]: clampStanding(world[faction] + quest.reputationReward),
        revision: world.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerWorldStateTable.userId, userId));
    await tx
      .update(playerQuestsTable)
      .set({ status: "claimed", claimedAt: new Date() })
      .where(and(
        eq(playerQuestsTable.userId, userId),
        eq(playerQuestsTable.questId, questId),
      ));
    await tx.insert(progressionEventsTable).values({
      userId,
      idempotencyKey: input.idempotencyKey,
      kind: "quest_reward",
      amount: quest.rewardCredits,
      balanceBefore: profile.credits,
      balanceAfter: creditsAfter,
      result: { action: "claim", targetId: questId, reputationReward: quest.reputationReward },
    });
    return {
      world: await worldSnapshotInTransaction(tx, userId),
      credits: creditsAfter,
      rewardCredits: quest.rewardCredits,
      replayed: false,
    };
  });
}
