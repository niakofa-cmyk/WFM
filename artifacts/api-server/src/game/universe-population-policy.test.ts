import assert from "node:assert/strict";
import test from "node:test";
import {
  countFreshActivePilots,
  desiredAiFactionMixFromActivePilots,
  encounterThreatEnvelope,
  shouldApplyAiMix,
} from "./universe-population-policy";

function pilot(
  userId: string,
  faction: "ussf" | "accord",
  observedAt = 30_000,
  extra: Partial<Parameters<typeof countFreshActivePilots>[0][number]> = {},
) {
  return {
    userId, faction, authenticated: true, connected: true, observedAt, ...extra,
  } as const;
}

test("active flight population counts fresh authenticated accounts once and ignores stale or absent seats", () => {
  const counts = countFreshActivePilots([
    pilot("accord-1", "accord"),
    pilot("accord-1", "accord", 29_500), // Reconnect overlap is still one account.
    pilot("accord-2", "accord"),
    pilot("ussf-1", "ussf"),
    pilot("stale", "ussf", 1_000),
    pilot("offline", "accord", 29_900, { connected: false }),
    pilot("guest", "accord", 29_900, { authenticated: false }),
    pilot("spectator", "ussf", 29_900, { spectator: true }),
  ], 30_000);
  assert.deepEqual(counts, { ussf: 1, accord: 2, total: 3 });
});

test("same-account conflicting faction samples fail closed until a newer seat resolves them", () => {
  const conflict = countFreshActivePilots([
    pilot("pilot", "ussf", 10_000),
    pilot("pilot", "accord", 10_000),
  ], 10_000);
  assert.deepEqual(conflict, { ussf: 0, accord: 0, total: 0 });
  const resolved = countFreshActivePilots([
    pilot("pilot", "ussf", 10_000),
    pilot("pilot", "accord", 10_001),
  ], 10_001);
  assert.deepEqual(resolved, { ussf: 0, accord: 1, total: 1 });
});

test("requested AI mix is neutral when empty, 80/20 for six Accord pilots, and mirrored for six USSF pilots", () => {
  assert.deepEqual(desiredAiFactionMixFromActivePilots({ ussf: 0, accord: 0, total: 0 }),
    { ussf: 0.5, accord: 0.5 });
  assert.deepEqual(desiredAiFactionMixFromActivePilots({ ussf: 5, accord: 5, total: 10 }),
    { ussf: 0.5, accord: 0.5 });
  assert.deepEqual(desiredAiFactionMixFromActivePilots({ ussf: 4, accord: 6, total: 10 }),
    { ussf: 0.8, accord: 0.2 });
  assert.deepEqual(desiredAiFactionMixFromActivePilots({ ussf: 6, accord: 4, total: 10 }),
    { ussf: 0.2, accord: 0.8 });
  assert.deepEqual(desiredAiFactionMixFromActivePilots({ ussf: 0, accord: 10, total: 10 }),
    { ussf: 0.8, accord: 0.2 });
  assert.deepEqual(desiredAiFactionMixFromActivePilots({ ussf: 10, accord: 0, total: 10 }),
    { ussf: 0.2, accord: 0.8 });
  assert.throws(() => desiredAiFactionMixFromActivePilots({ ussf: 1, accord: 1, total: 3 }),
    /Invalid active-pilot faction counts/);
});

test("regional threat envelopes distinguish quiet routes, contested space and rare deep-space pressure", () => {
  assert.deepEqual(encounterThreatEnvelope("safe-core", 100),
    { minimum: 50, typical: 65, maximum: 80, rareMaximum: 80 });
  assert.deepEqual(encounterThreatEnvelope("established-route", 100),
    { minimum: 80, typical: 90, maximum: 100, rareMaximum: 100 });
  assert.deepEqual(encounterThreatEnvelope("contested-frontier", 100),
    { minimum: 100, typical: 125, maximum: 150, rareMaximum: 150 });
  assert.deepEqual(encounterThreatEnvelope("deep-space", 100),
    { minimum: 100, typical: 125, maximum: 150, rareMaximum: 250 });
  assert.throws(() => encounterThreatEnvelope("deep-space", -1), /Invalid human threat budget/);
});

test("mix changes require a bounded cadence and meaningful hysteresis", () => {
  const previous = { ussf: 0.5, accord: 0.5, appliedAt: 10_000 };
  assert.equal(shouldApplyAiMix(previous, { ussf: 0.8, accord: 0.2 }, 70_000), true);
  assert.equal(shouldApplyAiMix(previous, { ussf: 0.8, accord: 0.2 }, 69_999), false);
  assert.equal(shouldApplyAiMix(previous, { ussf: 0.55, accord: 0.45 }, 70_000), false);
  assert.equal(shouldApplyAiMix(null, { ussf: 0.5, accord: 0.5 }, 0), true);
  assert.throws(() => shouldApplyAiMix(previous, { ussf: 0.7, accord: 0.7 }, 70_000),
    /Invalid AI population mix/);
});
