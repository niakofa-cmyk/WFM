import assert from "node:assert/strict";
import test from "node:test";
import { adjudicateStrike } from "./rewards";
import { firstDivergence, syntheticInputs, traceReplay, type TraceConfig } from "./sim-trace";

const config: TraceConfig = {
  shipId: "mandjet",
  faction: "accord",
  refit: 0,
  pace: "strike",
  setup: { seed: 101, goal: "disc", disc: "rust" },
};

test("a pinned replay produces the same full-state checksums on every server runtime", () => {
  // These checksums were recorded identically in Node 24 and Chromium 152/156.
  // If a Node or browser upgrade changes them, the reward server can no longer
  // reproduce what players see; run the cross-runtime gate before accepting it.
  const trace = traceReplay(config, syntheticInputs(9001, 360 * 60));
  assert.equal(trace.checksums[1], 1779763836);
  assert.equal(trace.checksums[600], 1623770399);
  assert.equal(trace.checksums.at(-1), 2739749283);
  assert.equal(trace.terminalFrame, 14569);
  assert.equal(trace.outcome, "loss");
});

test("replaying the same inputs twice is bit-identical, with no state leaking between matches", () => {
  const inputs = syntheticInputs(77, 3_000);
  const first = traceReplay(config, inputs);
  // Interleave an unrelated match to catch module-level state leaks.
  traceReplay({ ...config, shipId: "glide", faction: "ussf", setup: { seed: 5, goal: "ace" } }, syntheticInputs(5, 900));
  const second = traceReplay(config, inputs);
  assert.equal(firstDivergence(first.checksums, second.checksums), -1);
});

test("the reward server adjudicates a replay to the same terminal result the trace reports", () => {
  const inputs = syntheticInputs(9001, 360 * 60);
  const trace = traceReplay(config, inputs);
  const grant = adjudicateStrike({
    inputs: inputs.slice(0, trace.framesApplied),
    shipId: config.shipId,
    faction: config.faction,
    refit: config.refit,
    pace: config.pace,
    seed: 101,
    goal: "disc",
    disc: "rust",
    allyCount: 4,
    foeCount: 5,
    tech: null,
    shieldMk2: false,
    mission: "skirmish",
    cleared: 0,
    hold: null,
    paid: 0,
    prices: {},
  });
  assert.equal(grant.outcome, trace.outcome);
  assert.equal(grant.kills, trace.kills);
});

test("checksum comparison reports the first divergent frame", () => {
  assert.equal(firstDivergence([1, 2, 3], [1, 2, 3]), -1);
  assert.equal(firstDivergence([1, 2, 3], [1, 9, 3]), 1);
  assert.equal(firstDivergence([1, 2], [1, 2, 3]), 2);
});
