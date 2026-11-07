import assert from "node:assert/strict";
import test from "node:test";
import { isOperationDirectoryFresh, operationEventsUrl, parseOperationDirectorySnapshot, selectCinderLiveOperations } from "./world-operation-events";

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

test("Cinder live activity includes only active public server-backed instances at Cinder Ring", () => {
  const directory = parseOperationDirectorySnapshot(JSON.stringify(snapshot));
  assert.ok(directory);
  assert.deepEqual(selectCinderLiveOperations(directory), [{
    id: "match-1",
    title: "Frontier Signal",
    experience: "competitive",
    runtimeId: "surface-v1",
    currentPlayers: 10,
    capacity: 10,
  }]);
  assert.deepEqual(selectCinderLiveOperations(undefined), []);
});

test("live operation snapshots expire rather than showing stale battles as current", () => {
  const directory = parseOperationDirectorySnapshot(JSON.stringify(snapshot));
  assert.ok(directory);
  const now = Date.parse(directory.generatedAt) + 119_000;
  assert.equal(isOperationDirectoryFresh(directory, now), true);
  assert.equal(isOperationDirectoryFresh(directory, now + 2_000), false);
  assert.equal(isOperationDirectoryFresh(directory, Date.parse(directory.generatedAt) - 20_000), false);
});

test("Cinder live activity hides inactive, private, and other-location instances", () => {
  const directory = parseOperationDirectorySnapshot(JSON.stringify({
    ...snapshot,
    operations: [{ ...snapshot.operations[0], visibility: "unlisted" }],
    events: [{ ...snapshot.events[0], locationId: "mars-orbit" }],
  }));
  assert.ok(directory);
  assert.deepEqual(selectCinderLiveOperations(directory), []);
  const inactive = parseOperationDirectorySnapshot(JSON.stringify({
    ...snapshot,
    instances: [{ ...snapshot.instances[0], phase: "closed" }],
  }));
  assert.ok(inactive);
  assert.deepEqual(selectCinderLiveOperations(inactive), []);
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
