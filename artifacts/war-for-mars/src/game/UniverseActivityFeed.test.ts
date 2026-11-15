import assert from "node:assert/strict";
import test from "node:test";
import type { OperationDirectoryResponse, WorldLocation } from "@workspace/api-client-react";
import { buildUniverseActivityView } from "./UniverseActivityFeed";

const directory = {
  generatedAt: "2026-11-06T12:00:00.000Z",
  locations: [{
    id: "cinder-ring",
    worldLocationId: "cinder-asteroid",
    name: "Cinder Ring",
    kind: "asteroid",
    sectorId: "rust-disc-belt",
    position: { x: 0, y: 18, z: -260 },
  }],
  operations: [{
    id: "wing-arena",
    title: "Wing Relay Arena",
    description: "Competitive match.",
    locationId: "cinder-ring",
    experience: "competitive",
    runtimeId: "wing-relay-v1",
    rulesetId: "wing-competitive-5v5-v1",
    teamSize: 5,
    capacity: 10,
    visibility: "public",
    lifecycle: "continuous",
    access: "competitive",
    rewardPolicy: "existing-authority",
  }],
  instances: [{
    id: "match-public-id",
    operationId: "wing-arena",
    locationId: "cinder-ring",
    phase: "active",
    currentPlayers: 8,
    capacity: 10,
    runtimeId: "wing-relay-v1",
    rulesetId: "wing-competitive-5v5-v1",
    visibility: "public",
    registeredAt: "2026-11-06T11:55:00.000Z",
    expiresAt: "2026-11-06T12:40:00.000Z",
  }],
  events: [{
    id: "event-1",
    kind: "match-started",
    locationId: "cinder-ring",
    operationInstanceId: "match-public-id",
    status: "active",
    title: "Wing Relay Arena is active",
  }],
  presence: [
    { locationId: "cinder-asteroid", activePilots: 8 },
    { locationId: "locked-location", activePilots: 4 },
  ],
  presenceStatus: "available",
} as unknown as OperationDirectoryResponse;

const locations = [
  { id: "cinder-asteroid", name: "Cinder Ring", unlocked: true },
  { id: "locked-location", name: "Uncharted Relay", unlocked: false },
] as WorldLocation[];

test("universe activity shows live runtime and anonymous counts at unlocked destinations only", () => {
  const view = buildUniverseActivityView(directory, locations, "cinder-asteroid");
  assert.deepEqual(view.locations, [{
    id: "cinder-asteroid",
    name: "Cinder Ring",
    activePilots: 8,
    isCurrent: true,
  }]);
  assert.deepEqual(view.events, [{
    id: "event-1",
    title: "Wing Relay Arena is active",
    locationName: "Cinder Ring",
    runtimeId: "wing-relay-v1",
    experience: "competitive",
    currentPlayers: 8,
    capacity: 10,
    isCurrent: true,
  }]);
  assert.equal(JSON.stringify(view).includes("locked-location"), false);
  assert.equal(JSON.stringify(view).includes("match-public-id"), false);
});
