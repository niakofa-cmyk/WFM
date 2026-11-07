import assert from "node:assert/strict";
import test from "node:test";
import { advancePatrol, projectPatrolTraffic, type GeneratedPatrol } from "./universe-patrol-rules";

const origin = new Date("2026-11-07T00:00:00.000Z");
const coordinates = {
  a: { x: 10, y: 20 },
  b: { x: 30, y: 20 },
};
const patrol: GeneratedPatrol = {
  patrolId: "strategic-patrol-v1:a:ussf:0",
  originLocationId: "a",
  currentLocationId: "a",
  faction: "ussf",
  objective: "recon",
  callsign: "USSF-1234",
  shipRoster: [
    { id: "patrol-a-1", hullId: "glide", name: "Glide Knife", callsign: "U-101" },
    { id: "patrol-a-2", hullId: "splitter", name: "Splitter Ring", callsign: "U-102" },
    { id: "patrol-a-3", hullId: "sentinel", name: "Sentinel-G", callsign: "U-103" },
    { id: "patrol-a-4", hullId: "duskbreaker", name: "Duskbreaker", callsign: "U-104" },
  ],
  route: ["a", "b"],
  routeIndex: 0,
  lastMovedAt: origin,
  revision: 0,
  updatedAt: origin,
};

test("patrol traffic interpolates a server-timed route into a local 3D formation", () => {
  const contacts = projectPatrolTraffic(
    patrol,
    "a",
    coordinates,
    new Date(origin.getTime() + 60_000),
  );
  assert.equal(contacts.length, 4);
  assert.ok(Math.abs(contacts[0]!.position.x - 5.2) < 0.0001);
  assert.equal(contacts[0]!.locationId, "a");
  assert.equal(contacts[0]!.hullId, "glide");
  assert.equal(contacts[0]!.faction, "ussf");
  assert.notDeepEqual(contacts[0]!.position, contacts[1]!.position);
  assert.ok(contacts.every((contact) =>
    Number.isFinite(contact.position.x) &&
    Number.isFinite(contact.position.y) &&
    Number.isFinite(contact.position.z) &&
    Number.isFinite(contact.yaw) &&
    !("playerId" in contact) &&
    !("callsign" in contact),
  ));
});

test("traffic is continuous across strategic waypoint advancement and anchor regions", () => {
  const before = projectPatrolTraffic(
    patrol,
    "a",
    coordinates,
    new Date(origin.getTime() + 119_999),
  )[0]!;
  const advanced = advancePatrol(patrol, new Date(origin.getTime() + 120_000));
  const after = projectPatrolTraffic(
    advanced,
    "a",
    coordinates,
    new Date(origin.getTime() + 120_000),
  )[0]!;
  assert.ok(Math.abs(before.position.x - after.position.x) < 0.001);

  const viewedFromB = projectPatrolTraffic(patrol, "b", coordinates, origin)[0]!;
  assert.ok(Math.abs(viewedFromB.position.x + 10.4) < 0.0001);
});

test("traffic projection fails closed for missing route coordinates or roster entries", () => {
  assert.deepEqual(projectPatrolTraffic(patrol, "unknown", coordinates, origin), []);
  assert.deepEqual(projectPatrolTraffic({ ...patrol, route: ["a"] }, "a", coordinates, origin), []);
  assert.deepEqual(projectPatrolTraffic({ ...patrol, shipRoster: [] }, "a", coordinates, origin), []);
});
