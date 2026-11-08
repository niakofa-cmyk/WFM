import assert from "node:assert/strict";
import test from "node:test";
import {
  isUniverseFrameSnapshotV1,
  UNIVERSE_SYNC_MAX_CONTACTS,
  UNIVERSE_SYNC_PROTOCOL_VERSION,
  type UniverseFrameSnapshotV1,
} from "@workspace/orbital-sim";

const validFrame: UniverseFrameSnapshotV1 = {
  protocolVersion: UNIVERSE_SYNC_PROTOCOL_VERSION,
  serverTick: 42,
  sector: { x: -4, y: 0, z: 1024 },
  traffic: [{
    actorId: "pilot-session:ephemeral-1",
    shipId: "glide",
    faction: "ussf",
    kind: "human_pilot",
    localPosition: { x: 0, y: 512, z: 4095.75 },
    velocity: { x: 12.5, y: 0, z: -9.25 },
    yawRadians: 0.25,
    hullFraction: 0.8,
  }],
};

test("universe sync v1 accepts bounded, server-shaped traffic snapshots", () => {
  assert.equal(isUniverseFrameSnapshotV1(validFrame), true);
  assert.equal(isUniverseFrameSnapshotV1({ ...validFrame, traffic: [] }), true);
});

test("universe sync v1 rejects client authority fields, duplicate actors, and malformed coordinates", () => {
  assert.equal(isUniverseFrameSnapshotV1({ ...validFrame, credits: 45 }), false);
  assert.equal(isUniverseFrameSnapshotV1({
    ...validFrame,
    traffic: [{ ...validFrame.traffic[0], actorId: "user-account-42" }],
  }), false);
  assert.equal(isUniverseFrameSnapshotV1({
    ...validFrame,
    traffic: [validFrame.traffic[0], validFrame.traffic[0]],
  }), false);
  assert.equal(isUniverseFrameSnapshotV1({
    ...validFrame,
    traffic: [{ ...validFrame.traffic[0], localPosition: { x: 4096.1, y: 0, z: 0 } }],
  }), false);
  assert.equal(isUniverseFrameSnapshotV1({
    ...validFrame,
    traffic: [{ ...validFrame.traffic[0], hullFraction: 2 }],
  }), false);
  assert.equal(isUniverseFrameSnapshotV1({
    ...validFrame,
    traffic: Array.from({ length: UNIVERSE_SYNC_MAX_CONTACTS + 1 }, (_, index) => ({
      ...validFrame.traffic[0],
      actorId: `actor-${index}`,
    })),
  }), false);
});
