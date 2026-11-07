import assert from "node:assert/strict";
import test from "node:test";
import {
  NARRATIVE_CHAPTERS,
  NARRATIVE_EVIDENCE,
  NARRATIVE_OPERATIONS,
  WORLD_CONSEQUENCES,
} from "./narrative-campaign";

test("narrative catalog IDs are unique", () => {
  const unique = (ids: readonly string[]) => assert.equal(new Set(ids).size, ids.length);
  unique(NARRATIVE_CHAPTERS.map((item) => item.id));
  unique(NARRATIVE_OPERATIONS.map((item) => item.id));
  unique(NARRATIVE_EVIDENCE.map((item) => item.id));
  unique(WORLD_CONSEQUENCES.map((item) => item.id));
});

test("every chapter operation and evidence reference resolves", () => {
  const operationIds = new Set(NARRATIVE_OPERATIONS.map((item) => item.id));
  const evidenceIds = new Set(NARRATIVE_EVIDENCE.map((item) => item.id));
  for (const chapter of NARRATIVE_CHAPTERS) {
    for (const id of chapter.operations) assert.ok(operationIds.has(id), chapter.id + " -> " + id);
    for (const id of chapter.evidence) assert.ok(evidenceIds.has(id), chapter.id + " -> " + id);
  }
});

test("all evidence prerequisites resolve and contain no self-dependency", () => {
  const evidenceIds = new Set(NARRATIVE_EVIDENCE.map((item) => item.id));
  for (const evidence of NARRATIVE_EVIDENCE) {
    assert.ok(!evidence.requires.includes(evidence.id), evidence.id);
    for (const prerequisite of evidence.requires) {
      assert.ok(evidenceIds.has(prerequisite), evidence.id + " requires " + prerequisite);
    }
  }
});

test("every operation consequence resolves", () => {
  const consequenceIds = new Set(WORLD_CONSEQUENCES.map((item) => item.id));
  for (const operation of NARRATIVE_OPERATIONS) {
    for (const id of operation.consequenceIds) {
      assert.ok(consequenceIds.has(id), operation.id + " -> " + id);
    }
  }
});

test("Cage preserves capture continuity and both faction perspectives", () => {
  const cage = NARRATIVE_OPERATIONS.find((item) => item.id === "cage");
  assert.ok(cage);
  assert.equal(cage.factionAccess, "both");
  assert.match(cage.primaryObjective, /USSF: intercept/i);
  assert.match(cage.primaryObjective, /Accord: protect/i);
  assert.ok(cage.successEvidenceIds.includes("prisoner-transfer-manifest"));
  assert.ok(cage.successEvidenceIds.includes("cage-recorder-signal"));
  assert.equal(
    NARRATIVE_EVIDENCE.find((item) => item.id === "prisoner-transfer-manifest")?.establishes.includes(
      "Dusk was captured after the expedition was destroyed",
    ),
    true,
  );
});

test("the emergency packet, pre-war beacon, Warden, Cage, and Witness clues form a resolvable chain", () => {
  const byId = new Map(NARRATIVE_EVIDENCE.map((item) => [item.id, item]));
  assert.ok(byId.get("last-transmission-fragment")?.requires.includes("dusk-flight-recorder"));
  assert.ok(byId.get("pale-beacon-record")?.requires.includes("last-transmission-fragment"));
  assert.ok(byId.get("warden-erasure-order")?.requires.includes("pale-beacon-record"));
  assert.ok(byId.get("cage-recorder-signal")?.requires.includes("prisoner-transfer-manifest"));
  assert.ok(byId.get("buried-memory-archive")?.requires.includes("cage-recorder-signal"));
});
