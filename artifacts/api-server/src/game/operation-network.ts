import { and, count, eq, gt, lte } from "drizzle-orm";
import {
  db,
  operationInstancesTable,
  universePresenceTable,
  type OperationInstancePhase,
  type OperationInstanceRecord,
} from "@workspace/db";
import type {
  OperationDirectoryResponse,
  OperationRegistrationResponse,
} from "@workspace/api-zod";
import { getWorldSnapshot } from "./world";

const LOCATION = {
  id: "cinder-ring",
  worldLocationId: "cinder-asteroid",
  name: "Cinder Ring",
  kind: "asteroid" as const,
  sectorId: "rust-disc-belt",
  position: { x: 0, y: 18, z: -260 },
};
const UNIVERSE_LOCATIONS: OperationDirectoryResponse["locations"] = [LOCATION];

export const CINDER_CIRCUIT = {
  id: "cinder-asteroid-circuit",
  title: "Cinder Asteroid Circuit",
  description: "A no-reward Rust Disc flight-simulation sortie at Cinder Ring. A registered session is a solo local flight, not a live multiplayer match.",
  locationId: LOCATION.id,
  experience: "flight-simulation" as const,
  runtimeId: "flight-sector-v1",
  rulesetId: "rust-disc-flight-v1",
  teamSize: 1,
  capacity: 1,
  visibility: "public" as const,
  lifecycle: "on-demand" as const,
  access: "local-training" as const,
  rewardPolicy: "none" as const,
};

export const CINDER_RING_WING_ARENA = {
  id: "cinder-ring-wing-relay-5v5",
  title: "Cinder Ring · 5v5 Wing Relay Arena",
  description: "Server-authoritative USSF versus Accord Relay combat. Only active matches created by the ten-human competitive queue are listed; private and AI-fill rooms never appear.",
  locationId: LOCATION.id,
  experience: "competitive" as const,
  runtimeId: "wing-relay-v1",
  rulesetId: "wing-competitive-5v5-v1",
  teamSize: 5,
  capacity: 10,
  visibility: "public" as const,
  lifecycle: "queued" as const,
  access: "matchmaking" as const,
  rewardPolicy: "existing-authority" as const,
};

export const CINDER_COOPERATIVE_EXPEDITION = {
  id: "cinder-ring-rust-disc-coop",
  title: "Cinder Ring · Rust Disc Expedition",
  description: "A server-run cooperative Rust Disc operation at Cinder Ring. Public room status is shared only when its creator opts in; invitation codes and pilot identities stay private.",
  locationId: LOCATION.id,
  experience: "cooperative" as const,
  runtimeId: "rust-disc-expedition-v1",
  rulesetId: "rust-disc-coop-v1",
  teamSize: 8,
  capacity: 8,
  visibility: "public" as const,
  lifecycle: "on-demand" as const,
  access: "invitation" as const,
  rewardPolicy: "none" as const,
};

const OPERATION_DEFINITIONS: OperationDirectoryResponse["operations"] = [
  CINDER_RING_WING_ARENA,
  CINDER_CIRCUIT,
  CINDER_COOPERATIVE_EXPEDITION,
];
const ACTIVE_TTL_MS = 45 * 60 * 1000;
const COMPETITIVE_MATCH_TTL_MS = 45_000;
const UNIVERSE_PRESENCE_TTL_MS = 60_000;
const UNIVERSE_PRESENCE_MIN_HEARTBEAT_MS = 10_000;
const UNIVERSE_PRESENCE_CLEANUP_MS = 5 * 60_000;
let lastUniversePresenceCleanupAt = 0;
type UniversePresenceSummary = NonNullable<OperationDirectoryResponse["presence"]>[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OperationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OperationError";
  }
}

export interface OperationStore {
  listPublicActive(now: Date): Promise<OperationInstanceRecord[]>;
  listUniversePresence(now: Date): Promise<UniversePresenceSummary[]>;
  heartbeatPresence(input: {
    userId: string;
    locationId: string;
    lastSeenAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findByOwnerAndKey(ownerUserId: string, idempotencyKey: string): Promise<OperationInstanceRecord | undefined>;
  register(input: {
    ownerUserId: string;
    operationId: string;
    locationId: string;
    idempotencyKey: string;
    runtimeId: string;
    rulesetId: string;
    visibility: "public" | "unlisted";
    registeredAt: Date;
    expiresAt: Date;
  }): Promise<OperationInstanceRecord>;
  syncCooperativeRoom?(input: {
    ownerUserId: string;
    idempotencyKey: string;
    phase: OperationInstancePhase;
    currentPlayers: number;
    visibility: "public" | "unlisted";
    registeredAt: Date;
    expiresAt: Date;
  }): Promise<OperationInstanceRecord>;
  syncCompetitiveMatch?(input: {
    matchId: string;
    phase: "active" | "closed";
    currentPlayers: number;
    registeredAt: Date;
    expiresAt: Date;
  }): Promise<OperationInstanceRecord>;
  closeOwned(ownerUserId: string, instanceId: string, now: Date): Promise<boolean>;
}

const databaseStore: OperationStore = {
  async listPublicActive(now) {
    return db.select().from(operationInstancesTable).where(and(
      eq(operationInstancesTable.status, "active"),
      eq(operationInstancesTable.visibility, "public"),
      gt(operationInstancesTable.expiresAt, now),
    ));
  },
  async listUniversePresence(now) {
    if (now.getTime() - lastUniversePresenceCleanupAt >= UNIVERSE_PRESENCE_CLEANUP_MS) {
      await db.delete(universePresenceTable).where(lte(universePresenceTable.expiresAt, now));
      lastUniversePresenceCleanupAt = now.getTime();
    }
    return db.select({
      locationId: universePresenceTable.locationId,
      activePilots: count(),
    })
      .from(universePresenceTable)
      .where(gt(universePresenceTable.expiresAt, now))
      .groupBy(universePresenceTable.locationId);
  },
  async heartbeatPresence(input) {
    const [existing] = await db.select({
      locationId: universePresenceTable.locationId,
      lastSeenAt: universePresenceTable.lastSeenAt,
    })
      .from(universePresenceTable)
      .where(eq(universePresenceTable.userId, input.userId))
      .limit(1);
    if (
      existing?.locationId === input.locationId &&
      input.lastSeenAt.getTime() - existing.lastSeenAt.getTime() < UNIVERSE_PRESENCE_MIN_HEARTBEAT_MS
    ) return;

    await db.insert(universePresenceTable).values(input).onConflictDoUpdate({
      target: universePresenceTable.userId,
      set: {
        locationId: input.locationId,
        lastSeenAt: input.lastSeenAt,
        expiresAt: input.expiresAt,
      },
    });
  },
  async findByOwnerAndKey(ownerUserId, idempotencyKey) {
    const [record] = await db.select().from(operationInstancesTable).where(and(
      eq(operationInstancesTable.ownerUserId, ownerUserId),
      eq(operationInstancesTable.idempotencyKey, idempotencyKey),
    )).limit(1);
    return record;
  },
  async register(input) {
    try {
      return await db.transaction(async (tx) => {
        const [replay] = await tx.select().from(operationInstancesTable).where(and(
          eq(operationInstancesTable.ownerUserId, input.ownerUserId),
          eq(operationInstancesTable.idempotencyKey, input.idempotencyKey),
        )).limit(1);
        if (replay) return replay;

        await tx.update(operationInstancesTable).set({
          status: "closed",
          updatedAt: input.registeredAt,
        }).where(and(
          eq(operationInstancesTable.ownerUserId, input.ownerUserId),
          eq(operationInstancesTable.status, "active"),
          lte(operationInstancesTable.expiresAt, input.registeredAt),
        ));
        const [active] = await tx.select({ id: operationInstancesTable.id })
          .from(operationInstancesTable)
          .where(and(
            eq(operationInstancesTable.ownerUserId, input.ownerUserId),
            eq(operationInstancesTable.status, "active"),
          )).limit(1);
        if (active) throw new OperationError("You already have an active operation seat.", 409);
        const [record] = await tx.insert(operationInstancesTable).values({
          ...input,
          status: "active",
          phase: "active",
          currentPlayers: 1,
          capacity: 1,
        }).returning();
        if (!record) throw new Error("Operation registration returned no record.");
        return record;
      });
    } catch (error) {
      if (error instanceof OperationError) throw error;
      const replay = await this.findByOwnerAndKey(input.ownerUserId, input.idempotencyKey);
      if (replay) return replay;
      // The partial unique index is the final guard against concurrent seats.
      if (isUniqueViolation(error)) throw new OperationError("You already have an active operation seat.", 409);
      throw error;
    }
  },
  async syncCooperativeRoom(input) {
    const [record] = await db.insert(operationInstancesTable).values({
      ownerUserId: input.ownerUserId,
      operationId: CINDER_COOPERATIVE_EXPEDITION.id,
      locationId: LOCATION.id,
      idempotencyKey: input.idempotencyKey,
      runtimeId: CINDER_COOPERATIVE_EXPEDITION.runtimeId,
      rulesetId: CINDER_COOPERATIVE_EXPEDITION.rulesetId,
      status: input.phase === "closed" || input.phase === "complete" ? "closed" : "active",
      visibility: input.visibility,
      phase: input.phase,
      currentPlayers: input.currentPlayers,
      capacity: CINDER_COOPERATIVE_EXPEDITION.capacity,
      registeredAt: input.registeredAt,
      updatedAt: input.registeredAt,
      expiresAt: input.expiresAt,
    }).onConflictDoUpdate({
      target: [operationInstancesTable.ownerUserId, operationInstancesTable.idempotencyKey],
      set: {
        status: input.phase === "closed" || input.phase === "complete" ? "closed" : "active",
        visibility: input.visibility,
        phase: input.phase,
        currentPlayers: input.currentPlayers,
        updatedAt: input.registeredAt,
        expiresAt: input.expiresAt,
      },
    }).returning();
    if (!record) throw new Error("Cooperative operation sync returned no record.");
    return record;
  },
  async syncCompetitiveMatch(input) {
    const ownerUserId = `system:wing:${input.matchId}`;
    const [record] = await db.insert(operationInstancesTable).values({
      id: input.matchId,
      ownerUserId,
      operationId: CINDER_RING_WING_ARENA.id,
      locationId: LOCATION.id,
      idempotencyKey: input.matchId,
      runtimeId: CINDER_RING_WING_ARENA.runtimeId,
      rulesetId: CINDER_RING_WING_ARENA.rulesetId,
      status: input.phase === "closed" ? "closed" : "active",
      visibility: "public",
      phase: input.phase,
      currentPlayers: input.currentPlayers,
      capacity: CINDER_RING_WING_ARENA.capacity,
      registeredAt: input.registeredAt,
      updatedAt: input.registeredAt,
      expiresAt: input.expiresAt,
    }).onConflictDoUpdate({
      target: [operationInstancesTable.ownerUserId, operationInstancesTable.idempotencyKey],
      set: {
        status: input.phase === "closed" ? "closed" : "active",
        phase: input.phase,
        currentPlayers: input.currentPlayers,
        updatedAt: input.registeredAt,
        expiresAt: input.expiresAt,
      },
    }).returning();
    if (!record) throw new Error("Competitive operation sync returned no record.");
    return record;
  },
  async closeOwned(ownerUserId, instanceId, now) {
    const [record] = await db.update(operationInstancesTable).set({
      status: "closed",
      updatedAt: now,
    }).where(and(
      eq(operationInstancesTable.id, instanceId),
      eq(operationInstancesTable.ownerUserId, ownerUserId),
      eq(operationInstancesTable.status, "active"),
    )).returning({ id: operationInstancesTable.id });
    return !!record;
  },
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

function toInstance(record: OperationInstanceRecord, now: Date): OperationDirectoryResponse["instances"][number] {
  const isActive = record.status === "active" && record.expiresAt > now;
  const operationLocationId = OPERATION_DEFINITIONS.find((operation) =>
    operation.id === record.operationId,
  )?.locationId ?? record.locationId;
  return {
    id: record.id,
    operationId: record.operationId,
    locationId: operationLocationId,
    phase: isActive ? record.phase : "closed",
    currentPlayers: isActive ? record.currentPlayers : 0,
    capacity: record.capacity,
    runtimeId: record.runtimeId,
    rulesetId: record.rulesetId,
    visibility: record.visibility,
    registeredAt: record.registeredAt,
    expiresAt: record.expiresAt,
  };
}

export function buildOperationDirectory(
  now: Date,
  publicInstances: OperationInstanceRecord[],
  presence: UniversePresenceSummary[] = [],
  presenceStatus: OperationDirectoryResponse["presenceStatus"] = "available",
): OperationDirectoryResponse {
  const definitions = new Map(OPERATION_DEFINITIONS.map((operation) => [operation.id, operation]));
  const active = publicInstances.filter((record) => {
    const definition = definitions.get(record.operationId);
    if (!definition) return false;
    const operationLocation = UNIVERSE_LOCATIONS.find((location) => location.id === definition.locationId);
    if (!operationLocation) return false;
    return record.status === "active" &&
      record.visibility === "public" &&
      record.expiresAt > now &&
      (operationLocation?.worldLocationId === record.locationId || operationLocation?.id === record.locationId) &&
      definition.runtimeId === record.runtimeId &&
      definition.rulesetId === record.rulesetId;
  });
  return {
    generatedAt: now,
    locations: UNIVERSE_LOCATIONS,
    operations: OPERATION_DEFINITIONS,
    instances: active.map((record) => toInstance(record, now)),
    events: active.map((record) => ({
      id: `operation-opened-${record.id}`,
      kind: record.phase === "active" && definitions.get(record.operationId)?.experience === "competitive"
        ? "match-started" as const
        : "operation-opened" as const,
      locationId: definitions.get(record.operationId)?.locationId ?? record.locationId,
      operationInstanceId: record.id,
      status: "active" as const,
      title: `${definitions.get(record.operationId)?.title ?? "Universe operation"} is active`,
    })),
    presence,
    presenceStatus,
  };
}

function isMissingUniversePresenceTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "42P01";
}

export function createOperationCoordinator(
  store: OperationStore = databaseStore,
  currentLocation: (ownerUserId: string) => Promise<string> = async (ownerUserId) =>
    (await getWorldSnapshot(ownerUserId)).currentLocation,
  now: () => Date = () => new Date(),
) {
  return {
    async getDirectory(): Promise<OperationDirectoryResponse> {
      const timestamp = now();
      const publicInstances = await store.listPublicActive(timestamp);
      try {
        return buildOperationDirectory(
          timestamp,
          publicInstances,
          await store.listUniversePresence(timestamp),
          "available",
        );
      } catch (error) {
        if (!isMissingUniversePresenceTable(error)) throw error;
        return buildOperationDirectory(timestamp, publicInstances, [], "unavailable");
      }
    },
    async heartbeatPresence(userId: string): Promise<void> {
      const locationId = await currentLocation(userId);
      if (typeof locationId !== "string" || locationId.length === 0 || locationId.length > 80) {
        throw new Error("Current universe location is unavailable.");
      }
      const lastSeenAt = now();
      await store.heartbeatPresence({
        userId,
        locationId,
        lastSeenAt,
        expiresAt: new Date(lastSeenAt.getTime() + UNIVERSE_PRESENCE_TTL_MS),
      });
    },
    async register(
      ownerUserId: string,
      operationId: string,
      request: { idempotencyKey: string; visibility: "public" | "unlisted" },
    ): Promise<{ result: OperationRegistrationResponse; created: boolean }> {
      if (operationId !== CINDER_CIRCUIT.id) throw new OperationError("Unsupported operation.", 409);

      const replay = await store.findByOwnerAndKey(ownerUserId, request.idempotencyKey);
      if (replay) {
        const active = replay.status === "active" && replay.expiresAt > now();
        return { result: registrationResponse(replay, active, now()), created: false };
      }

      if (await currentLocation(ownerUserId) !== LOCATION.worldLocationId) {
        throw new OperationError("Travel to Cinder Ring before entering this operation.", 403);
      }

      const registeredAt = now();
      const record = await store.register({
        ownerUserId,
        operationId,
        locationId: CINDER_CIRCUIT.locationId,
        idempotencyKey: request.idempotencyKey,
        runtimeId: CINDER_CIRCUIT.runtimeId,
        rulesetId: CINDER_CIRCUIT.rulesetId,
        visibility: request.visibility,
        registeredAt,
        expiresAt: new Date(registeredAt.getTime() + ACTIVE_TTL_MS),
      });
      const active = record.status === "active" && record.expiresAt > registeredAt;
      return { result: registrationResponse(record, active, registeredAt), created: true };
    },
    async leave(ownerUserId: string, instanceId: string): Promise<void> {
      if (!await store.closeOwned(ownerUserId, instanceId, now())) {
        throw new OperationError("Operation seat not found.", 404);
      }
    },
    async isAtCinderRing(userId: string): Promise<boolean> {
      const world = await getWorldSnapshot(userId);
      return world.currentLocation === LOCATION.worldLocationId;
    },
    async syncCooperativeRoom(input: {
      instanceId: string;
      ownerUserId: string;
      phase: OperationInstancePhase;
      currentPlayers: number;
      visibility: "public" | "unlisted";
    }): Promise<void> {
      if (!store.syncCooperativeRoom) throw new Error("Cooperative operation storage is unavailable.");
      const currentTime = now();
      if (!Number.isInteger(input.currentPlayers) || input.currentPlayers < 0 || input.currentPlayers > CINDER_COOPERATIVE_EXPEDITION.capacity) {
        throw new Error("Cooperative operation occupancy is out of bounds.");
      }
      await store.syncCooperativeRoom({
        ownerUserId: input.ownerUserId,
        idempotencyKey: input.instanceId,
        phase: input.phase,
        currentPlayers: input.currentPlayers,
        visibility: input.visibility,
        registeredAt: currentTime,
        expiresAt: new Date(currentTime.getTime() + ACTIVE_TTL_MS),
      });
    },
    async syncCompetitiveMatch(input: {
      matchId: string;
      phase: "active" | "closed";
      currentPlayers: number;
    }): Promise<void> {
      if (!store.syncCompetitiveMatch) throw new Error("Competitive operation storage is unavailable.");
      if (!UUID.test(input.matchId)) throw new Error("Competitive match identity is invalid.");
      if (!Number.isInteger(input.currentPlayers) || input.currentPlayers < 0 || input.currentPlayers > CINDER_RING_WING_ARENA.capacity) {
        throw new Error("Competitive match occupancy is out of bounds.");
      }
      const registeredAt = now();
      await store.syncCompetitiveMatch({
        matchId: input.matchId,
        phase: input.phase,
        currentPlayers: input.currentPlayers,
        registeredAt,
        expiresAt: new Date(registeredAt.getTime() + COMPETITIVE_MATCH_TTL_MS),
      });
    },
  };
}

function registrationResponse(record: OperationInstanceRecord, allowed: boolean, now: Date): OperationRegistrationResponse {
  const instance = toInstance(record, now);
  return {
    instance,
    authorization: {
      allowed,
      reason: allowed ? "authorized" : "operation-closed",
      assignment: allowed ? {
        assignmentId: record.id,
        operationInstanceId: record.id,
        runtimeId: record.runtimeId,
        rulesetId: record.rulesetId,
        seat: 0,
        expiresAt: record.expiresAt,
      } : null,
    },
  };
}

export const operationCoordinator = createOperationCoordinator();
