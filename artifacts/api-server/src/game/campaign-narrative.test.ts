import assert from "node:assert/strict";
import test from "node:test";
import {
  narrativeArchiveForDiscoveries,
  narrativeAwardsForClaim,
  narrativeDiscoveryId,
} from "./campaign-narrative";

test("campaign evidence is awarded only by a verified winning operation", () => {
  assert.deepEqual(
    narrativeAwardsForClaim("contact", "accord", "win", []),
    ["dusk-rise", "quiet-mandate", "unlisted-expedition", "mars-is-not-empty", "last-fleet-transmission"],
  );
  assert.deepEqual(narrativeAwardsForClaim("contact", "accord", "loss", []), []);
  assert.deepEqual(narrativeAwardsForClaim("beacon", "ussf", "win", []), [
    "pale-beacon-record",
    "earth-first-response",
  ]);
  assert.deepEqual(narrativeAwardsForClaim("warden", "accord", "draw", []), []);
  assert.deepEqual(narrativeAwardsForClaim("skirmish", "accord", "win", []), []);
});

test("Cage's later transfer records one immutable faction-and-outcome branch", () => {
  assert.deepEqual(narrativeAwardsForClaim("cage", "ussf", "win", []), [
    "cage-ussf-secures",
    "first-witness-trace",
  ]);
  assert.deepEqual(narrativeAwardsForClaim("cage", "accord", "win", []), [
    "cage-accord-transfers",
    "first-witness-trace",
  ]);
  assert.deepEqual(narrativeAwardsForClaim("cage", "ussf", "loss", []), [
    "cage-contested-escape",
  ]);
  assert.deepEqual(
    narrativeAwardsForClaim("cage", "accord", "win", [narrativeDiscoveryId("cage-contested-escape")]),
    [],
  );
});

test("the world archive returns only server-discovered story records in chronology order", () => {
  const discoveredAt = new Date("2026-11-07T18:00:00.000Z");
  const archive = narrativeArchiveForDiscoveries([
    { locationId: narrativeDiscoveryId("cage-ussf-secures"), createdAt: discoveredAt },
    { locationId: narrativeDiscoveryId("rust-disc-relay-record"), createdAt: discoveredAt },
    { locationId: "rust-disc", createdAt: discoveredAt },
    { locationId: narrativeDiscoveryId("dusk-rise"), createdAt: discoveredAt },
    { locationId: narrativeDiscoveryId("not-a-known-record"), createdAt: discoveredAt },
  ]);

  assert.deepEqual(archive.map((record) => record.id), ["dusk-rise", "rust-disc-relay-record", "cage-ussf-secures"]);
  const relayRecord = archive.find((record) => record.id === "rust-disc-relay-record");
  assert.equal(relayRecord?.missionId, "rust-disc");
  assert.match(relayRecord?.synopsis ?? "", /matches Earth's receipt/);
  assert.equal(archive[0]?.discoveredAt, discoveredAt);
  assert.ok(archive[0]?.transcript.length);
  assert.doesNotMatch(
    archive.map((record) => `${record.title} ${record.synopsis} ${record.transcript.map((line) => line.text).join(" ")}`).join(" "),
    /Dusk knew the cage was a trap|chose the route/i,
  );
});
