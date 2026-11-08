import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { OperationDirectoryResponse, OperationInstance, WorldLocation, WorldState } from "@workspace/api-client-react";
import { connectedDestinations, operationControlTarget } from "./orbital-navigation";

const now = Date.parse("2026-11-06T20:00:00Z");
const location = (id: string, unlocked = true): WorldLocation => ({
  id, name: id, kind: "asteroid", x: 35, y: 60, unlockAfter: 0,
  unlocked, explored: false, description: `Server location ${id}`, services: [],
});
const world: Pick<WorldState, "currentLocation" | "locations" | "routes"> = {
  currentLocation: "yard",
  locations: [location("yard"), location("cinder"), location("locked", false)],
  routes: [
    { destinationId: "cinder", costCredits: 10, available: true },
    { destinationId: "locked", costCredits: 0, available: true },
  ],
};
const session: OperationInstance = {
  id: "public-session", operationId: "wing", locationId: "cinder-site",
  phase: "active", currentPlayers: 8, capacity: 10, runtimeId: "wing-relay-v1",
  rulesetId: "existing-rules", visibility: "public",
  registeredAt: "2026-11-06T19:59:00Z", expiresAt: "2026-11-06T20:01:00Z",
};
const directory: OperationDirectoryResponse = {
  generatedAt: "2026-11-06T20:00:00Z",
  locations: [{
    id: "cinder-site", name: "Cinder Ring", worldLocationId: "cinder",
    kind: "asteroid", sectorId: "belt", position: { x: 0, y: 0, z: 0 },
  }],
  operations: [{
    id: "wing", title: "Wing", description: "Verified catalog",
    locationId: "cinder-site", experience: "competitive", runtimeId: "wing-relay-v1",
    rulesetId: "existing-rules", capacity: 10, teamSize: 5, visibility: "public",
    lifecycle: "continuous", access: "matchmaking", rewardPolicy: "existing-authority",
  }],
  instances: [session], events: [], presence: [], presenceStatus: "available",
};

test("connected chart uses server locations and keeps selection distinct from confirmed position", () => {
  const nodes = connectedDestinations(world, directory, 20, false, now);
  assert.deepEqual(nodes.map((entry) => entry.id), ["yard", "cinder", "locked"]);
  assert.equal(nodes[0].status, "current");
  assert.equal(nodes[0].canOpen, true);
  assert.equal(nodes[1].canOpen, false);
  assert.equal(nodes[1].canTravel, true);
  assert.equal(world.currentLocation, "yard");
  const moved = connectedDestinations({ ...world, currentLocation: "cinder" }, directory, 10, false, now);
  assert.equal(moved[1].status, "current");
  assert.equal(moved[1].canOpen, true);
  assert.equal(moved[1].canTravel, false);
});

test("route travel rejects stale, locked, unaffordable, current and unavailable routes", () => {
  assert.equal(connectedDestinations(world, directory, 9, false, now)[1].canTravel, false);
  assert.ok(connectedDestinations(world, directory, 20, true, now).every((entry) => !entry.canTravel && !entry.canOpen));
  assert.equal(connectedDestinations(world, directory, 20, false, now)[2].canTravel, false);
  assert.equal(connectedDestinations(world, directory, 20, false, now)[0].canTravel, false);
  assert.equal(connectedDestinations({ ...world, routes: [] }, directory, 20, false, now)[1].canTravel, false);
});

test("directory projection exposes only accessible public catalog operations at their actual sites", () => {
  const hidden = {
    ...directory,
    operations: [
      ...directory.operations,
      { ...directory.operations[0], id: "private", visibility: "private" as const },
      { ...directory.operations[0], id: "unknown", locationId: "unknown-site" },
    ],
  };
  assert.deepEqual(connectedDestinations(world, hidden, 20, false, now)[1].operations.map((entry) => entry.id), ["wing"]);
  const lockedWorld = { ...world, locations: world.locations.map((entry) => ({ ...entry, unlocked: false })) };
  assert.ok(connectedDestinations(lockedWorld, hidden, 20, false, now).every((entry) => entry.operations.length === 0));
});

test("session counts exclude expired, closed, unlisted and mismatched sites without exposing session identifiers", () => {
  const mixed = {
    ...directory,
    instances: [
      session,
      { ...session, id: "old", expiresAt: "2026-11-06T19:59:00Z" },
      { ...session, id: "private", visibility: "unlisted" as const },
      { ...session, id: "closed", phase: "closed" as const },
      { ...session, id: "wrong-site", locationId: "other-site" },
    ],
  };
  const operations = connectedDestinations(world, mixed, 20, false, now)[1].operations;
  assert.equal(operations[0].publicSessions, 1);
  assert.equal(operations[0].activePlayers, 8);
  assert.equal(JSON.stringify(operations).includes("public-session"), false);
});

test("missing directory never invents operations or sessions", () => {
  assert.ok(connectedDestinations(world, undefined, 20, false, now).every((entry) => entry.operations.length === 0));
  const noSessions = connectedDestinations(world, { ...directory, instances: [] }, 20, false, now)[1].operations[0];
  assert.equal(noSessions.publicSessions, 0);
  assert.equal(noSessions.activePlayers, 0);
});

test("operation handoffs retain the competitive docking gate and existing specialist controls", () => {
  assert.equal(operationControlTarget("competitive", "wing", "approach-entry"), "panel-cinder-ring-approach-entry");
  assert.equal(operationControlTarget("competitive", "wing", "docked-hub"), "screen-asteroid-arena-hub");
  assert.equal(operationControlTarget("cooperative", "coop", "approach-entry"), "card-operation-coop");
  assert.equal(operationControlTarget("flight-simulation", "solo", "entry"), "card-operation-solo");
});

test("connected entry stays within authenticated account shell while offline flight stays independent", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const lab = readFileSync(new URL("./OrbitalBoot.tsx", import.meta.url), "utf8");
  const warApp = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  const galaxy = readFileSync(new URL("./GalaxyScreen.tsx", import.meta.url), "utf8");
  assert.match(app, /path="\/universe"><AccountGameEntry universe/);
  assert.match(app, /isLoaded && isSignedIn/);
  assert.match(app, /key=\{`\$\{userId\}:\$\{universe\}:\$\{orbital\}`\}/);
  assert.match(lab, /const HUB = `\$\{BASE\}\/universe`/);
  assert.doesNotMatch(lab, /ClerkProvider|fetch\(/);
  assert.match(lab, /useGetWorldPatrols/);
  assert.match(lab, /Boolean\(userId && !standalone && \(mode === "entry" \|\| mode === "universe"\)/);
  assert.match(warApp, /useGetWorldPatrols/);
  assert.match(warApp, /patrolDirectory: universePatrolDirectory/);
  assert.doesNotMatch(warApp, /onInterceptPatrol|canInterceptPatrol/);
  assert.match(galaxy, /navigationDestinations.find[\s\S]*?\.canTravel/);
  assert.match(galaxy, /if \(!current\?\.canOpen \|\| !operation \|\| directoryUnavailable\) return/);
});

test("regional patrol traffic refreshes by location and pauses safely in background", () => {
  const galaxy = readFileSync(new URL("./GalaxyScreen.tsx", import.meta.url), "utf8");
  assert.match(galaxy, /refetchInterval: 5_000/);
  assert.match(galaxy, /refetchIntervalInBackground: false/);
  assert.match(galaxy, /queryKey: \[\.\.\.getGetWorldPatrolsQueryKey\(\), world\?\.currentLocation\]/);
});

test("patrol intercept overlay pauses and resumes the same mounted universe flight", () => {
  const warApp = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.match(warApp, /className=\{`fixed inset-0 \$\{universeServicesOpen \? "invisible pointer-events-none" : ""\}`\}/);
  assert.match(warApp, /universeExpeditionMission \? \([\s\S]*?<SectorExpedition/);
  assert.match(warApp, /onReturnToUniverse=\{\(\) => \{[\s\S]*?setUniverseExpeditionMission\(null\);[\s\S]*?setUniverseServicesOpen\(false\)/);
  assert.match(arena, /localUniverse\.servicesOpen[\s\S]*?clearInput\(busRef\.current\);[\s\S]*?setPaused\(true\)/);
});
