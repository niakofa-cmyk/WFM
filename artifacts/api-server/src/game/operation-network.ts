import { and, eq, gt, lte } from "drizzle-orm";
import {
  db,
  operationInstancesTable,
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

const OPERATION_DEFINITIONS: OperationDirectoryResponse["operations"] = [CINDER_CIRCUIT, CINDER_COOPERATIVE_EXPEDITION];
const ACTIVE_TTL_MS = 45 * 60 * 1000;

export class OperationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OperationError";
  }
}

export interface OperationStore {
  listPublicActive(now: Date): Promise<OperationInstanceRecord[]>;
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
  return {
    id: record.id,
    operationId: record.operationId,
    locationId: CINDER_CIRCUIT.locationId,
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
): OperationDirectoryResponse {
  const active = publicInstances.filter((record) => record.status === "active" && record.expiresAt > now);
  return {
    generatedAt: now,
    locations: [LOCATION],
    operations: OPERATION_DEFINITIONS,
    instances: active.map((record) => toInstance(record, now)),
    events: active.map((record) => ({
      id: `operation-opened-${record.id}`,
      kind: "operation-opened" as const,
      locationId: CINDER_CIRCUIT.locationId,
      operationInstanceId: record.id,
      status: "active" as const,
      title: `${OPERATION_DEFINITIONS.find((operation) => operation.id === record.operationId)?.title ?? "Cinder operation"} is active`,
    })),
  };
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
      return buildOperationDirectory(timestamp, await store.listPublicActive(timestamp));
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
        locationId: LOCATION.worldLocationId,
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
