import assert from "node:assert/strict";
import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { buildPublishableKey } from "@clerk/shared/keys";
import type { OperationDirectoryResponse } from "@workspace/api-zod";
import { apiClerkOptions } from "../middlewares/clerk-auth-options";
import { createWorldOperationsRouter } from "./world-operations";

test("public directory and SSE publish read-only snapshots; registration requires Clerk and is server-authorized", async () => {
  const frontendApi = "clerk.operation-fixture.example";
  const publishableKey = buildPublishableKey(frontendApi);
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = new Date("2026-11-04T12:00:00.000Z");
  const instanceId = randomUUID();
  let registerCalls = 0;
  const directory: OperationDirectoryResponse = {
    generatedAt: now,
    locations: [{
      id: "cinder-ring", worldLocationId: "cinder-asteroid", name: "Cinder Ring",
      kind: "asteroid", sectorId: "rust-disc-belt", position: { x: 0, y: 18, z: -260 },
    }],
    operations: [{
      id: "cinder-asteroid-circuit", title: "Cinder Asteroid Circuit",
      description: "Solo training.",
      locationId: "cinder-ring", experience: "flight-simulation", runtimeId: "flight-sector-v1",
      rulesetId: "rust-disc-flight-v1", teamSize: 1, capacity: 1, visibility: "public",
      lifecycle: "on-demand", access: "local-training", rewardPolicy: "none",
    }],
    instances: [],
    events: [],
  };
  const coordinator: Parameters<typeof createWorldOperationsRouter>[0] = {
    getDirectory: async () => directory,
    register: async () => {
      registerCalls++;
      return {
        created: true,
        result: {
          instance: {
            id: instanceId, operationId: "cinder-asteroid-circuit", locationId: "cinder-ring",
            phase: "active", currentPlayers: 1, capacity: 1, runtimeId: "flight-sector-v1",
            rulesetId: "rust-disc-flight-v1", visibility: "public",
            registeredAt: now, expiresAt: new Date(now.getTime() + 60000),
          },
          authorization: {
            allowed: true, reason: "authorized",
            assignment: {
              assignmentId: instanceId, operationInstanceId: instanceId, runtimeId: "flight-sector-v1",
              rulesetId: "rust-disc-flight-v1", seat: 0, expiresAt: new Date(now.getTime() + 60000),
            },
          },
        },
      };
    },
    leave: async () => undefined,
    syncCooperativeRoom: async () => undefined,
    syncCompetitiveMatch: async () => undefined,
    isAtCinderRing: async () => true,
  };
  const app = express();
  app.use(clerkMiddleware({
    ...apiClerkOptions(publishableKey),
    jwtKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  }));
  app.use(express.json());
  app.use("/api", createWorldOperationsRouter(coordinator, 60_000));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/world/operations`;

  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: `https://${frontendApi}`, sub: "synthetic_operation_user", sid: "synthetic_session",
    azp: "https://game.example", iat: nowSeconds - 5, nbf: nowSeconds - 5, exp: nowSeconds + 60,
  })}`;
  const token = `${payload}.${createSign("RSA-SHA256").update(payload).sign(privateKey, "base64url")}`;

  try {
    const publicResponse = await fetch(baseUrl);
    assert.equal(publicResponse.status, 200);
    assert.match(publicResponse.headers.get("cache-control") ?? "", /max-age=5/);
    assert.deepEqual((await publicResponse.json() as OperationDirectoryResponse).instances, []);

    const anonymous = await fetch(`${baseUrl}/cinder-asteroid-circuit/instances`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: randomUUID(), visibility: "unlisted" }),
    });
    assert.equal(anonymous.status, 401);
    assert.equal(registerCalls, 0);

    const controller = new AbortController();
    const stream = await fetch(`${baseUrl}/events`, { signal: controller.signal });
    assert.match(stream.headers.get("content-type") ?? "", /^text\/event-stream/);
    const reader = stream.body?.getReader();
    assert.ok(reader);
    const firstEvent = await reader.read();
    assert.match(new TextDecoder().decode(firstEvent.value), /event: operations\.snapshot/);
    await reader.cancel();
    controller.abort();

    const authenticated = await fetch(`${baseUrl}/cinder-asteroid-circuit/instances`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: randomUUID(), visibility: "unlisted" }),
    });
    assert.equal(authenticated.status, 201);
    const body = await authenticated.json() as { authorization: { allowed: boolean; assignment: { seat: number } } };
    assert.equal(body.authorization.allowed, true);
    assert.equal(body.authorization.assignment.seat, 0);
    assert.equal(registerCalls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("database failure returns a generic unavailable response without query details", async () => {
  const coordinator: Parameters<typeof createWorldOperationsRouter>[0] = {
    getDirectory: async () => { throw new Error("relation operation_instances does not exist"); },
    register: async () => { throw new Error("database query detail"); },
    leave: async () => { throw new Error("database query detail"); },
    syncCooperativeRoom: async () => undefined,
    syncCompetitiveMatch: async () => undefined,
    isAtCinderRing: async () => false,
  };
  const app = express().use(createWorldOperationsRouter(coordinator));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/world/operations`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "operation_service_unavailable" });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
