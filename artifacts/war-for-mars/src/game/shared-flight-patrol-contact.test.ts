import assert from "node:assert/strict";
import test from "node:test";
import {
  ORBITAL_RULES_VERSION,
  FREE_FLIGHT_PROTOCOL_V1,
  type FreeFlightActorV1,
  type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import { sameSharedPatrolContact, sharedFlightPatrolContact } from "./shared-flight-patrol-contact";

function actor(
  actorId: string,
  kind: FreeFlightActorV1["kind"],
  faction: FreeFlightActorV1["faction"],
  x: number,
  own = false,
  alive = true,
): FreeFlightActorV1 {
  return {
    actorId, kind, faction, shipId: faction === "ussf" ? "duskbreaker" : "mandjet",
    callsign: actorId, position: { x, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, yaw: 0, pitch: 0, speed: 0,
    hull: alive ? 100 : 0, hullMax: 100, shield: 100, shieldMax: 100, alive, own,
  };
}

function snapshot(ownFaction: "ussf" | "accord", enemyDistance: number): FreeFlightSnapshotV1 {
  const own = actor("pilot:own", "pilot", ownFaction, 0, true);
  const enemy = actor("patrol:enemy", "patrol", ownFaction === "ussf" ? "accord" : "ussf", enemyDistance);
  return {
    protocol: FREE_FLIGHT_PROTOCOL_V1,
    rulesVersion: ORBITAL_RULES_VERSION,
    sessionInstanceId: "7cfd8601-2c4f-4e47-8837-f80e5f5f3a16",
    tick: 10,
    serverTime: 1000,
    ownActorId: own.actorId,
    actors: [own, enemy],
  };
}

test("stationary contact updates retain changed actor identity and hull/shield state", () => {
  const contact = sharedFlightPatrolContact(snapshot("ussf", 150))!;
  assert.equal(sameSharedPatrolContact(contact, { ...contact }), true);
  assert.equal(sameSharedPatrolContact(contact, { ...contact, actorId: "patrol-ship:replacement" }), false);
  assert.equal(sameSharedPatrolContact(contact, { ...contact, shield: 90 }), false);
  assert.equal(sameSharedPatrolContact(contact, { ...contact, hull: 80 }), false);
  assert.equal(sameSharedPatrolContact(contact, null), false);
});

test("server snapshot proximity creates a hostile contact for either faction", () => {
  for (const faction of ["ussf", "accord"] as const) {
    const contact = sharedFlightPatrolContact(snapshot(faction, 120));
    assert.ok(contact);
    assert.equal(contact.source, "server-snapshot");
    assert.equal(contact.distanceMeters, 120);
    assert.equal(contact.faction, faction === "ussf" ? "accord" : "ussf");
    assert.equal(contact.shipId, faction === "ussf" ? "mandjet" : "duskbreaker");
    assert.equal(contact.shield, 100);
    assert.equal(contact.shieldMax, 100);
    assert.equal(contact.hull, 100);
    assert.equal(contact.hullMax, 100);
  }
});

test("distant, friendly, and destroyed patrol actors do not open an approach prompt", () => {
  assert.equal(sharedFlightPatrolContact(snapshot("ussf", 600)), null);
  const friendly = snapshot("ussf", 120);
  friendly.actors[1] = actor("patrol:friendly", "patrol", "ussf", 120);
  assert.equal(sharedFlightPatrolContact(friendly), null);
  const destroyed = snapshot("ussf", 120);
  destroyed.actors[1] = actor("patrol:destroyed", "patrol", "accord", 120, false, false);
  assert.equal(sharedFlightPatrolContact(destroyed), null);
});
