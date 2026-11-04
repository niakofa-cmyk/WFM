import assert from "node:assert/strict";
import test from "node:test";
import { nextStorySectorMission, parseExpeditionMission } from "./sector-navigation";

test("universe navigation offers Rust Disc first, then advances through the story route", () => {
  assert.equal(nextStorySectorMission([])?.id, "rust-disc");
  assert.equal(nextStorySectorMission(["flight:rust-disc"])?.id, "mars-approach");
  assert.equal(nextStorySectorMission(["flight:rust-disc", "flight:mars-approach"])?.id, "pale-beacons");
  assert.equal(nextStorySectorMission(["flight:rust-disc", "flight:mars-approach", "flight:pale-beacons"]), null);
});

test("only exact flight discoveries count and unrelated missions do not interrupt story order", () => {
  assert.equal(nextStorySectorMission(["rust-disc", "flight:unknown", "sector:iron-eclipse"])?.id, "rust-disc");
  assert.equal(nextStorySectorMission(["flight:rust-disc", "flight:unknown"])?.id, "mars-approach");
});

test("expedition deep links accept known mission IDs without granting unlocks", () => {
  assert.equal(parseExpeditionMission("?mission=mars-approach"), "mars-approach");
  assert.equal(parseExpeditionMission("?mission=iron-eclipse"), "iron-eclipse");
  assert.equal(parseExpeditionMission("?mission=unknown"), null);
  assert.equal(parseExpeditionMission("?mission=constructor"), null);
  assert.equal(parseExpeditionMission(""), null);
});
