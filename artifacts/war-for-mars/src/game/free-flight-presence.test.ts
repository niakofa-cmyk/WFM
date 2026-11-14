import assert from "node:assert/strict";
import test from "node:test";
import type { FreeFlightSnapshotV1 } from "@workspace/orbital-sim";
import { flightPresence } from "./free-flight-presence";

test("presence uses only received actors and preserves HUMAN versus AI identity and faction", () => {
  const own = { actorId: "pilot:own", own: true, kind: "pilot", faction: "ussf",
    callsign: "YOU", alive: true, position: { x: 0, y: 0, z: 0 } };
  const snapshot = { ownActorId: own.actorId, actors: [
    own,
    { ...own, actorId: "pilot:ally", own: false, callsign: "WING PILOT", position: { x: 0, y: 30, z: 40 } },
    { ...own, actorId: "patrol:escort:ussf:1", own: false, kind: "patrol", callsign: "AI WING", position: { x: 100, y: 0, z: 0 } },
    { ...own, actorId: "patrol:enemy:1", own: false, kind: "patrol", faction: "accord", position: { x: 200, y: 0, z: 0 } },
  ] } as FreeFlightSnapshotV1;
  const entries = flightPresence(snapshot);
  assert.equal(entries.length, 3);
  assert.equal(entries[0]?.kind, "pilot");
  assert.equal(entries[0]?.distanceMeters, 50);
  assert.equal(entries[1]?.kind, "patrol");
  assert.equal(entries[1]?.friendly, true);
  assert.equal(entries[2]?.friendly, false);
  assert.deepEqual(flightPresence({ ...snapshot, ownActorId: "absent" }), []);
});
