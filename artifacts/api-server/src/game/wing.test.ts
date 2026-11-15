import assert from "node:assert/strict";
import test from "node:test";
import {
  createWing,
  isMeaningfulWingInput,
  MAX_PLAYERS,
  wingBattlefieldForSeed,
  type WingInput,
} from "./wing";

const input = (seq: number, throttle = 1, lock = false): WingInput => ({
  seq,
  throttle,
  yaw: 0,
  strafe: 0,
  pitch: 0,
  fire: false,
  ult: false,
  lock,
  evade: 0,
  preset: null,
});

test("one room assigns pilots to balanced five-seat teams", () => {
  const wing = createWing(11);
  const joined = Array.from({ length: MAX_PLAYERS }, (_, index) =>
    wing.join(`player-${index}`, `Pilot ${index}`, null, 1_000),
  );

  assert.equal(joined.every((result) => result.ok), true);
  if (joined.every((result) => result.ok)) {
    assert.deepEqual(joined.map((result) => result.team), [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  }
  assert.deepEqual(wing.join("eleventh", "Late pilot", null, 1_000), {
    ok: false,
    reason: "full",
  });
});

test("server seed rotates through every supported 5v5 battlefield deterministically", () => {
  const expected = ["rust", "beacon", "night", "dust"];
  assert.deepEqual(expected.map((_, index) => wingBattlefieldForSeed(index)), expected);
  assert.equal(wingBattlefieldForSeed(8), "rust");
  assert.equal(wingBattlefieldForSeed(9), "beacon");

  for (let seed = 0; seed < expected.length; seed += 1) {
    const first = createWing(seed).snapshot(1_000).match.disc;
    const second = createWing(seed).snapshot(1_000).match.disc;
    assert.equal(first, expected[seed]);
    assert.equal(second, first);
  }
});

test("sequenced input is acknowledged in the authoritative snapshot", () => {
  const wing = createWing(12);
  const joined = wing.join("pilot", "Pilot", null, 1_000);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  assert.equal(wing.input(joined.slotId, input(2), 1_001), true);
  assert.equal(wing.input(joined.slotId, input(1, -1), 1_002), false);
  wing.tick(1_034);

  const snapshot = wing.snapshot(1_034);
  assert.equal(snapshot.players[joined.slotId].lastSeq, 2);
  assert.equal(snapshot.match.player.ai, false);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test("only non-neutral controls count toward participation", () => {
  const neutral = input(1, 0);
  const movement = input(2, 0.1);
  const firing = { ...input(3, 0), fire: true };

  assert.equal(isMeaningfulWingInput(neutral), false);
  assert.equal(isMeaningfulWingInput(movement), true);
  assert.equal(isMeaningfulWingInput(firing), true);
});

test("lock inputs from all ten seats target hostiles independently", () => {
  const wing = createWing(121);
  const joined = Array.from({ length: MAX_PLAYERS }, (_, index) =>
    wing.join(`lock-player-${index}`, `Pilot ${index}`, null, 1_000),
  );
  assert.equal(joined.every((result) => result.ok), true);
  for (const result of joined) {
    if (result.ok) wing.input(result.slotId, input(1, 0, true), 1_001);
  }

  wing.tick(1_034);
  const match = wing.snapshot(1_034).match;
  const craftFor = (slotId: number) =>
    slotId === 0 ? match.player : slotId < 5 ? match.allies[slotId - 1] : match.enemies[slotId - 5];
  for (const result of joined) {
    if (!result.ok) continue;
    const pilot = craftFor(result.slotId);
    const hostiles = result.slotId < 5 ? match.enemies : [match.player, ...match.allies];
    assert.equal(pilot.ai, false, `connected slot ${result.slotId} should not be treated as an AI pilot`);
    assert.ok(pilot.lockTargetId != null, `slot ${result.slotId} should have a lock`);
    assert.ok(hostiles.some((hostile) => hostile.id === pilot.lockTargetId), `slot ${result.slotId} should lock the other team`);
  }
  assert.equal(match.lockId, match.player.lockTargetId, "legacy match lock stays scoped to pilot zero");
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

  const rejoined = wing.join("pilot", "Pilot", joined.reconnectToken, 2_500);
  assert.equal(rejoined.ok, true);
  if (rejoined.ok) assert.equal(rejoined.slotId, joined.slotId);
});

test("disconnect reservations expire without advancing a lobby match", () => {
  const wing = createWing(14);
  const joined = wing.join("pilot", "Pilot", null, 1_000);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  wing.disconnect(joined.slotId, 1_010);
  wing.expireDisconnected(6_011);
  assert.equal(wing.canReconnect(joined.reconnectToken), false);
  assert.equal(wing.tickCount, 0);

  const replacement = wing.join("replacement", "Replacement", null, 6_012);
  assert.equal(replacement.ok, true);
  if (replacement.ok) {
    assert.equal(replacement.slotId, joined.slotId);
    assert.notEqual(replacement.reconnectToken, joined.reconnectToken);
  }
});
