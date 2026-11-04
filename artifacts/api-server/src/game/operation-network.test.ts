import assert from "node:assert/strict";
import test from "node:test";
import {
  GetWorldOperationsResponse,
  RegisterWorldOperationInstanceResponse,
} from "@workspace/api-zod";
import {
  createOperationCoordinator,
  OperationError,
  type OperationStore,
} from "./operation-network";
import type { OperationInstanceRecord } from "@workspace/db";

function memoryStore(): OperationStore {
  const rows: OperationInstanceRecord[] = [];
  return {
    async listPublicActive(now) {
      return rows.filter((row) => row.status === "active" && row.visibility === "public" && row.expiresAt > now);
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
        updatedAt: input.registeredAt,
      };
      rows.push(row);
      return row;
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
