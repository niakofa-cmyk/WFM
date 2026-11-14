import assert from "node:assert/strict";
import test from "node:test";
import { acceptFlightSettlement, readFlightSettlement, settlementTallyAfter } from "./free-flight-settlement-tally";

const packet = { type: "freeflight_combat_result", status: "settled",
  encounterId: "11111111-1111-4111-8111-111111111111", kills: 1, assists: 1, creditsAwarded: 3 };

test("duplicate battle receipts cannot double the visible kill, assist or reward tally", () => {
  const seen = new Set<string>();
  const receipt = readFlightSettlement(packet)!;
  assert.equal(acceptFlightSettlement(seen, receipt), true);
  const after = settlementTallyAfter({ kills: 0, assists: 0, credits: 0 }, receipt);
  assert.deepEqual(after, { kills: 1, assists: 1, credits: 3 });
  assert.equal(acceptFlightSettlement(seen, receipt), false);
  assert.deepEqual(settlementTallyAfter({ kills: 0, assists: 0, credits: 0 }, receipt), after,
    "the pure state updater is repeatable under React StrictMode");
});

test("cumulative authority survives reconnect and an older settlement cannot reduce tallies", () => {
  const receipt = readFlightSettlement({ ...packet, totals: { kills: 4, assists: 2, creditsAwarded: 12 } })!;
  assert.deepEqual(settlementTallyAfter({ kills: 1, assists: 0, credits: 3 }, receipt),
    { kills: 4, assists: 2, credits: 12 });
  assert.deepEqual(settlementTallyAfter({ kills: 5, assists: 3, credits: 15 }, receipt),
    { kills: 5, assists: 3, credits: 15 });
});

test("invalid or unsettled reward messages are not accepted", () => {
  for (const value of [null, { ...packet, kills: -1 }, { ...packet, creditsAwarded: NaN },
    { ...packet, status: "pending" }, { ...packet, encounterId: "bad" },
    { ...packet, totals: { kills: 2, assists: 0, creditsAwarded: -2 } }]) {
    assert.equal(readFlightSettlement(value), null);
  }
});
