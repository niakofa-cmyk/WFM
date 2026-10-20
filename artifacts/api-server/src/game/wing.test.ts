import assert from "node:assert/strict";
import test from "node:test";
import { createWing, MAX_PLAYERS, type WingInput } from "./wing";

const input = (seq: number, throttle = 1): WingInput => ({
  seq,
  throttle,
  yaw: 0,
  strafe: 0,
  pitch: 0,
  fire: false,
  ult: false,
  lock: false,
  evade: 0,
  preset: null,
});

test("one room admits ten pilots across two five-seat teams", () => {
  const wing = createWing(11);
  const joined = Array.from({ length: MAX_PLAYERS }, (_, index) =>
    wing.join(`player-${index}`, `Pilot ${index}`, null, 1_000),
  );

  assert.equal(joined.every((result) => result.ok), true);
  if (joined.every((result) => result.ok)) {
    assert.equal(joined[0].team, 0);
    assert.equal(joined[4].team, 0);
    assert.equal(joined[5].team, 1);
    assert.equal(joined[9].team, 1);
  }
  assert.deepEqual(wing.join("eleventh", "Late pilot", null, 1_000), {
    ok: false,
    reason: "full",
  });
});

test("sequenced input is acknowledged in the authoritative snapshot", () => {
  const wing = createWing(12);
  const joined = wing.join("pilot", "Pilot", null, 1_000);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  wing.input(joined.slotId, input(2), 1_001);
  wing.input(joined.slotId, input(1, -1), 1_002);
  wing.tick(1_034);

  const snapshot = wing.snapshot(1_034);
  assert.equal(snapshot.players[joined.slotId].lastSeq, 2);
  assert.equal(snapshot.match.player.ai, false);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test("empty slot zero is AI-controlled and reconnect reclaims its seat", () => {
  const wing = createWing(13);
  const before = wing.snapshot(1_000).match.player;
  wing.tick(1_034);
  const after = wing.snapshot(1_034).match.player;
  assert.equal(after.ai, true);
  assert.notDeepEqual({ x: after.x, z: after.z }, { x: before.x, z: before.z });

  const joined = wing.join("pilot", "Pilot", null, 2_000);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  wing.disconnect(joined.slotId, 2_010);

  const rejoined = wing.join("new-connection", "Pilot", joined.reconnectToken, 2_500);
  assert.equal(rejoined.ok, true);
  if (rejoined.ok) assert.equal(rejoined.slotId, joined.slotId);
});
