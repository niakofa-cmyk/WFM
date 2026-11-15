import assert from "node:assert/strict";
import test from "node:test";
import {
  GetWorldOperationsResponse,
  RegisterWorldOperationInstanceResponse,
} from "@workspace/api-zod";
import {
  CINDER_RING_WING_ARENA,
  CINDER_COOPERATIVE_EXPEDITION,
  createOperationCoordinator,
  OperationError,
  type OperationStore,
} from "./operation-network";
import type { OperationInstanceRecord } from "@workspace/db";

function memoryStore(): OperationStore {
  const rows: OperationInstanceRecord[] = [];
  const presenceRows = new Map<string, {
    locationId: string;
    lastSeenAt: Date;
    expiresAt: Date;
  }>();
  return {
    async listPublicActive(now) {
      return rows.filter((row) => row.status === "active" && row.visibility === "public" && row.expiresAt > now);
    },
    async listUniversePresence(now) {
      const counts = new Map<string, number>();
      for (const row of presenceRows.values()) {
        if (row.expiresAt > now) counts.set(row.locationId, (counts.get(row.locationId) ?? 0) + 1);
      }
      return [...counts].map(([locationId, activePilots]) => ({ locationId, activePilots }));
    },
    async heartbeatPresence(input) {
      presenceRows.set(input.userId, {
        locationId: input.locationId,
        lastSeenAt: input.lastSeenAt,
        expiresAt: input.expiresAt,
      });
    },
    async findByOwnerAndKey(ownerUserId, idempotencyKey) {
      return rows.find((row) => row.ownerUserId === ownerUserId && row.idempotencyKey === idempotencyKey);
    },
    async register(input) {
      const replay = rows.find((row) => row.ownerUserId === input.ownerUserId && row.idempotencyKey === input.idempotencyKey);
      if (replay) return replay;
      for (const row of rows) {
        if (row.ownerUserId === input.ownerUserId && row.status === "active" && row.expiresAt <= input.registeredAt) {
          row.status = "closed";
          row.updatedAt = input.registeredAt;
        }
      }
      if (rows.some((row) => row.ownerUserId === input.ownerUserId && row.status === "active")) {
        throw new OperationError("You already have an active operation seat.", 409);
      }
      const row: OperationInstanceRecord = {
        id: crypto.randomUUID(),
        ...input,
        status: "active",
        phase: "active",
        currentPlayers: 1,
        capacity: 1,
        updatedAt: input.registeredAt,
      };
      rows.push(row);
      return row;
    },
    async syncCooperativeRoom(input) {
      const row = rows.find((candidate) => candidate.ownerUserId === input.ownerUserId && candidate.idempotencyKey === input.idempotencyKey);
      if (row) {
        Object.assign(row, {
          phase: input.phase,
          currentPlayers: input.currentPlayers,
          capacity: CINDER_COOPERATIVE_EXPEDITION.capacity,
          visibility: input.visibility,
          status: input.phase === "closed" || input.phase === "complete" ? "closed" : "active",
          updatedAt: input.registeredAt,
          expiresAt: input.expiresAt,
        });
        return row;
      }
      const created: OperationInstanceRecord = {
        id: crypto.randomUUID(),
        ownerUserId: input.ownerUserId,
        operationId: CINDER_COOPERATIVE_EXPEDITION.id,
        locationId: CINDER_COOPERATIVE_EXPEDITION.locationId,
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
      };
      rows.push(created);
      return created;
    },
    async syncCompetitiveMatch(input) {
      const ownerUserId = `system:wing:${input.matchId}`;
      const row = rows.find((candidate) => candidate.ownerUserId === ownerUserId && candidate.idempotencyKey === input.matchId);
      if (row) {
        Object.assign(row, {
          phase: input.phase,
          currentPlayers: input.currentPlayers,
          status: input.phase === "closed" ? "closed" : "active",
          updatedAt: input.registeredAt,
          expiresAt: input.expiresAt,
        });
        return row;
      }
      const created: OperationInstanceRecord = {
        id: input.matchId,
        ownerUserId,
        operationId: CINDER_RING_WING_ARENA.id,
        locationId: CINDER_RING_WING_ARENA.locationId,
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
      };
      rows.push(created);
      return created;
    },
    async closeOwned(ownerUserId, instanceId, now) {
      const row = rows.find((candidate) => candidate.id === instanceId && candidate.ownerUserId === ownerUserId && candidate.status === "active");
      if (!row) return false;
      row.status = "closed";
      row.updatedAt = now;
      return true;
    },
  };
}

test("cooperative operation directory exposes safe occupancy and removes terminal rooms", async () => {
  const coordinator = createOperationCoordinator(memoryStore());
  const roomId = crypto.randomUUID();
  await coordinator.syncCooperativeRoom({
    instanceId: roomId,
    ownerUserId: "private-owner-id",
    phase: "assembling",
    currentPlayers: 3,
    visibility: "public",
  });
  const active = await coordinator.getDirectory();
  const operation = active.operations.find((entry) => entry.id === CINDER_COOPERATIVE_EXPEDITION.id);
  assert.equal(operation?.experience, "cooperative");
  assert.deepEqual(
    active.instances.map(({ operationId, phase, currentPlayers, capacity }) => ({ operationId, phase, currentPlayers, capacity })),
    [{ operationId: CINDER_COOPERATIVE_EXPEDITION.id, phase: "assembling", currentPlayers: 3, capacity: 8 }],
  );
  assert.equal(JSON.stringify(active).includes("private-owner-id"), false);

  await coordinator.syncCooperativeRoom({
    instanceId: roomId,
    ownerUserId: "private-owner-id",
    phase: "closed",
    currentPlayers: 0,
    visibility: "public",
  });
  assert.deepEqual((await coordinator.getDirectory()).instances, []);
});

test("only server-registered 5v5 Relay matches appear as anonymous live arena instances", async () => {
  const store = memoryStore();
  const coordinator = createOperationCoordinator(store);
  const matchId = crypto.randomUUID();
  await coordinator.syncCompetitiveMatch({
    matchId,
    phase: "active",
    currentPlayers: 10,
  });

  const directory = await coordinator.getDirectory();
  const arena = directory.operations.find((operation) => operation.id === CINDER_RING_WING_ARENA.id);
  assert.equal(arena?.experience, "competitive");
  assert.equal(arena?.runtimeId, "wing-relay-v1");
  assert.deepEqual(
    directory.instances.map(({ id, operationId, phase, currentPlayers, capacity }) => ({
      id, operationId, phase, currentPlayers, capacity,
    })),
    [{ id: matchId, operationId: CINDER_RING_WING_ARENA.id, phase: "active", currentPlayers: 10, capacity: 10 }],
  );
  assert.equal(JSON.stringify(directory).includes("system:wing"), false);

  await coordinator.syncCompetitiveMatch({
    matchId,
    phase: "closed",
    currentPlayers: 0,
  });
  assert.deepEqual((await coordinator.getDirectory()).instances, []);
  await assert.rejects(
    coordinator.syncCompetitiveMatch({ matchId: "not-a-uuid", phase: "active", currentPlayers: 1 }),
    /identity is invalid/,
  );
  await assert.rejects(
    coordinator.syncCompetitiveMatch({ matchId: crypto.randomUUID(), phase: "active", currentPlayers: 11 }),
    /occupancy is out of bounds/,
  );
});

test("universe presence uses server-owned locations and publishes only expiring destination counts", async () => {
  let timestamp = new Date("2026-11-06T12:00:00.000Z");
  const store = memoryStore();
  const coordinator = createOperationCoordinator(
    store,
    async (userId) => userId === "pilot-one" ? "cinder-asteroid" : "mars-orbit",
    () => timestamp,
  );
  await coordinator.heartbeatPresence("pilot-one");
  await coordinator.heartbeatPresence("pilot-two");

  const directory = await coordinator.getDirectory();
  assert.equal(directory.presenceStatus, "available");
  assert.deepEqual(
    (directory.presence ?? []).sort((left, right) => left.locationId.localeCompare(right.locationId)),
    [
      { locationId: "cinder-asteroid", activePilots: 1 },
      { locationId: "mars-orbit", activePilots: 1 },
    ],
  );
  assert.equal(JSON.stringify(directory).includes("pilot-one"), false);
  assert.equal(JSON.stringify(directory).includes("pilot-two"), false);

  timestamp = new Date(timestamp.getTime() + 61_000);
  assert.deepEqual((await coordinator.getDirectory()).presence ?? [], []);
});

test("operation activity stays readable while the additive presence schema is not installed", async () => {
  const store = memoryStore();
  const coordinator = createOperationCoordinator({
    ...store,
    async listUniversePresence() {
      throw new Error("presence query failed", {
        cause: Object.assign(new Error("missing table details"), { code: "42P01" }),
      });
    },
  });
  const directory = await coordinator.getDirectory();
  assert.equal(directory.presenceStatus, "unavailable");
  assert.deepEqual(directory.presence ?? [], []);
  assert.ok(directory.operations.length > 0);
});

test("operation entry requires arrival at the server-owned asteroid location", async () => {
  const coordinator = createOperationCoordinator(memoryStore(), async () => "rust-disc");
  await assert.rejects(
    coordinator.register("player-one", "cinder-asteroid-circuit", {
      idempotencyKey: crypto.randomUUID(),
      visibility: "unlisted",
    }),
    (error: unknown) => error instanceof OperationError && error.status === 403,
  );
});

test("registration is idempotent, single-seat, explicitly public, and owner-scoped", async () => {
  let now = new Date("2026-11-04T12:00:00.000Z");
  const store = memoryStore();
  const coordinator = createOperationCoordinator(store, async () => "cinder-asteroid", () => now);
  const idempotencyKey = crypto.randomUUID();
  const request = { idempotencyKey, visibility: "public" as const };

  const first = await coordinator.register("private-player-id", "cinder-asteroid-circuit", request);
  assert.equal(first.created, true);
  const parsed = RegisterWorldOperationInstanceResponse.parse(first.result);
  assert.equal(parsed.authorization.allowed, true);
  assert.equal(parsed.authorization.assignment?.seat, 0);
  assert.equal(parsed.instance.currentPlayers, 1);

  const replay = await coordinator.register("private-player-id", "cinder-asteroid-circuit", request);
  assert.equal(replay.created, false);
  assert.equal(replay.result.instance.id, first.result.instance.id);
  await assert.rejects(
    coordinator.register("private-player-id", "cinder-asteroid-circuit", {
      idempotencyKey: crypto.randomUUID(),
      visibility: "unlisted",
    }),
    (error: unknown) => error instanceof OperationError && error.status === 409,
  );

  const directory = GetWorldOperationsResponse.parse(await coordinator.getDirectory());
  assert.equal(directory.instances.length, 1);
  assert.equal(directory.events[0]?.kind, "operation-opened");
  assert.equal(JSON.stringify(directory).includes("private-player-id"), false);

  await assert.rejects(
    coordinator.leave("another-player", first.result.instance.id),
    (error: unknown) => error instanceof OperationError && error.status === 404,
  );
  await coordinator.leave("private-player-id", first.result.instance.id);
  assert.equal((await coordinator.getDirectory()).instances.length, 0);

  now = new Date(now.getTime() + 46 * 60 * 1000);
  const expired = await coordinator.register("other-player", "cinder-asteroid-circuit", {
    idempotencyKey: crypto.randomUUID(),
    visibility: "unlisted",
  });
  assert.equal(expired.result.instance.visibility, "unlisted");
  const publicDirectory = await coordinator.getDirectory();
  assert.equal(publicDirectory.instances.length, 0);
  assert.equal(publicDirectory.events.length, 0);
});

test("unknown operation identifiers are rejected, not mapped to a default mode", async () => {
  const coordinator = createOperationCoordinator(memoryStore(), async () => "cinder-asteroid");
  await assert.rejects(
    coordinator.register("player-one", "unsupported", {
      idempotencyKey: crypto.randomUUID(),
      visibility: "public",
    }),
    (error: unknown) => error instanceof OperationError && error.status === 409,
  );
});
