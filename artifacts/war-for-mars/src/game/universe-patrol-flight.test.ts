import assert from "node:assert/strict";
import test from "node:test";
import type { WorldPatrolDirectory } from "@workspace/api-client-react";
import { projectUniversePatrolTraffic } from "./universe-patrol-flight";

const directory: WorldPatrolDirectory = {
  generatedAt: "2026-11-08T00:00:00.000Z",
  currentLocationId: "cinder-asteroid",
  simulationLayer: "strategic",
  patrols: [{
    id: "patrol-a",
    callsign: "ACCORD-0101",
    faction: "accord",
    objective: "recon",
    currentLocationId: "cinder-asteroid",
    route: ["cinder-asteroid", "phobos-yard"],
    ships: [
      { id: "ship-a", name: "Mandjet", hullId: "mandjet", callsign: "A-101" },
      { id: "ship-b", name: "Shakuna", hullId: "shakuna", callsign: "A-102" },
    ],
    lastMovedAt: "2026-11-08T00:00:00.000Z",
  }],
  traffic: [{
    contactId: "patrol-a:contact:1",
    faction: "accord",
    hullId: "mandjet",
    locationId: "cinder-asteroid",
    position: { x: 10, y: 2, z: -20 },
    velocity: { x: 2, y: 0, z: 1 },
    yaw: 0.4,
  }],
};

test("server patrol traffic projects into free-flight with bounded timestamp interpolation", () => {
  const projection = projectUniversePatrolTraffic(
    directory,
    "ussf",
    { x: 100, y: 0, z: 200 },
    { x: 100, y: 0, z: 200 },
    Date.parse(directory.generatedAt) + 2_000,
  );
  assert.equal(projection.contacts.length, 1);
  assert.deepEqual(projection.contacts[0]?.position, { x: 114, y: 2, z: 182 });
  assert.equal(projection.nearestOpposing?.callsign, "ACCORD-0101");
  assert.equal(projection.nearestOpposing?.shipCount, 2);
  assert.equal(projection.nearestOpposing?.faction, "accord");
});

test("stale traffic and friendly-only traffic never create an opposing intercept", () => {
  const stale = projectUniversePatrolTraffic(
    directory, "ussf", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    Date.parse(directory.generatedAt) + 16_000,
  );
  assert.deepEqual(stale, { contacts: [], nearestOpposing: null });

  const friendly = projectUniversePatrolTraffic(
    { ...directory, patrols: directory.patrols.map((patrol) => ({ ...patrol, faction: "ussf" as const })),
      traffic: directory.traffic.map((contact) => ({ ...contact, faction: "ussf" as const })) },
    "ussf",
    { x: -10, y: -2, z: 20 },
    { x: -10, y: -2, z: 20 },
    Date.parse(directory.generatedAt),
  );
  assert.equal(friendly.nearestOpposing, null);
});
