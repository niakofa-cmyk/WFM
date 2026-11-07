import assert from "node:assert/strict";
import test from "node:test";
import { advancePatrol, createSeededPatrols, PATROL_WAYPOINT_INTERVAL_MS } from "./universe-patrol-rules";

const network = {
  alpha: ["beta"],
  beta: ["alpha", "gamma"],
  gamma: ["beta"],
} as const;

test("strategic patrol seeds are deterministic, multi-ship, faction-specific, and use connected routes", () => {
  const seededAt = new Date("2026-11-07T12:00:00.000Z");
  const first = createSeededPatrols(network, seededAt);
  const second = createSeededPatrols(network, seededAt);

  assert.deepEqual(first, second);
  assert.equal(first.length, 6);
  assert.equal(new Set(first.map((patrol) => patrol.patrolId)).size, first.length);
  assert.deepEqual(new Set(first.map((patrol) => patrol.faction)), new Set(["ussf", "accord"]));
  for (const patrol of first) {
    assert.ok(patrol.shipRoster.length >= 2 && patrol.shipRoster.length <= 4);
    assert.equal(patrol.route[0], patrol.originLocationId);
    assert.equal(patrol.route.at(-1), patrol.route[1]);
    for (let index = 1; index < patrol.route.length; index++) {
      assert.ok(network[patrol.route[index - 1] as keyof typeof network].includes(patrol.route[index] as never));
    }
  }
});

test("patrol waypoints advance from persisted time, catch up deterministically, and do not advance early", () => {
  const patrol = createSeededPatrols(network, new Date("2026-11-07T12:00:00.000Z"))
    .find((entry) => entry.originLocationId === "alpha" && entry.faction === "ussf");
  assert.ok(patrol);

  const beforeDue = advancePatrol(patrol, new Date(patrol.lastMovedAt.getTime() + PATROL_WAYPOINT_INTERVAL_MS - 1));
  assert.equal(beforeDue.currentLocationId, "alpha");
  assert.equal(beforeDue.revision, 0);

  const oneStep = advancePatrol(patrol, new Date(patrol.lastMovedAt.getTime() + PATROL_WAYPOINT_INTERVAL_MS));
  assert.equal(oneStep.currentLocationId, "beta");
  assert.equal(oneStep.revision, 1);

  const catchUp = advancePatrol(patrol, new Date(patrol.lastMovedAt.getTime() + PATROL_WAYPOINT_INTERVAL_MS * 2));
  assert.equal(catchUp.currentLocationId, "alpha");
  assert.equal(catchUp.revision, 2);
});
