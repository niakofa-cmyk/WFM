import assert from "node:assert/strict";
import test from "node:test";
import { operationEventsUrl, parseOperationDirectorySnapshot } from "./world-operation-events";

const snapshot = {
  generatedAt: "2026-11-05T12:00:00.000Z",
  locations: [{
    id: "cinder-ring",
    name: "Cinder Ring",
    worldLocationId: "cinder-asteroid",
    kind: "asteroid",
    sectorId: "rust-disc-belt",
    position: { x: 0, y: 18, z: -260 },
  }],
  operations: [{
    id: "wing-5v5",
    title: "5v5 Warfront",
    description: "Faction combat",
    locationId: "cinder-ring",
    experience: "competitive",
    runtimeId: "surface-v1",
    rulesetId: "wing-competitive-5v5-v1",
    teamSize: 5,
    capacity: 10,
    visibility: "public",
    lifecycle: "queued",
    access: "competitive",
    rewardPolicy: "existing-authority",
  }],
  instances: [{
    id: "match-1",
    operationId: "wing-5v5",
    locationId: "cinder-ring",
    phase: "active",
    currentPlayers: 10,
    capacity: 10,
    runtimeId: "surface-v1",
    rulesetId: "wing-competitive-5v5-v1",
    visibility: "public",
    registeredAt: "2026-11-05T12:00:00.000Z",
    expiresAt: "2026-11-05T13:00:00.000Z",
  }],
  events: [{
    id: "frontier",
    kind: "match-started",
    locationId: "cinder-ring",
    title: "Frontier Signal",
    status: "active",
    operationInstanceId: "match-1",
  }],
  presence: [{ locationId: "cinder-asteroid", activePilots: 2 }],
  presenceStatus: "available",
};

test("public universe operation event snapshots parse the documented read-only directory payload", () => {
  assert.deepEqual(parseOperationDirectorySnapshot(JSON.stringify(snapshot)), snapshot);
});

test("new clients tolerate an older server snapshot that predates destination presence", () => {
  const { presence: _presence, presenceStatus: _presenceStatus, ...legacySnapshot } = snapshot;
  const parsed = parseOperationDirectorySnapshot(JSON.stringify(legacySnapshot));
  assert.ok(parsed);
  assert.equal(parsed.presence, undefined);
  assert.equal(parsed.presenceStatus, undefined);
});

test("invalid snapshots are rejected without replacing cached directory state", () => {
  assert.equal(parseOperationDirectorySnapshot("{"), null);
  assert.equal(parseOperationDirectorySnapshot(JSON.stringify({ ...snapshot, instances: "hidden" })), null);
  assert.equal(parseOperationDirectorySnapshot(JSON.stringify({
    ...snapshot,
    instances: [{ id: "match-1", operationId: "wing-5v5", phase: "active", currentPlayers: "ten", capacity: 10 }],
  })), null);
  assert.equal(parseOperationDirectorySnapshot(JSON.stringify({
    ...snapshot,
    presence: [{ locationId: "cinder-asteroid", activePilots: -1 }],
  })), null);
});

test("operation event URLs use the configured API origin or app origin", () => {
  assert.equal(
    operationEventsUrl("https://api.example.test", "https://game.example.test"),
    "https://api.example.test/api/world/operations/events",
  );
  assert.equal(
    operationEventsUrl(null, "https://game.example.test"),
    "https://game.example.test/api/world/operations/events",
  );
});
