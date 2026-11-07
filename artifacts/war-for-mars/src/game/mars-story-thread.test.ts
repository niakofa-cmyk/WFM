import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SORTIES } from "./campaign";
import { MARS_ADVENTURES } from "./mars-adventure-network";
import { MARS_PARALLEL_STORY_OPERATIONS, MARS_STORY_THREAD } from "./mars-story-thread";

test("story thread preserves authored campaign IDs and maps them to Mars geography", () => {
  const campaignBeatIds = MARS_STORY_THREAD
    .filter((beat) => beat.campaignSortieId)
    .map((beat) => beat.campaignSortieId);
  assert.deepEqual(campaignBeatIds, ["contact", "beacon", "warden", "cage"]);
  assert.deepEqual(
    SORTIES.map((sortie) => sortie.id),
    campaignBeatIds,
  );

  const routeIds = new Set(MARS_ADVENTURES.map((adventure) => adventure.id));
  for (const beat of MARS_STORY_THREAD) {
    assert.ok(routeIds.has(beat.routeId), `missing route for story beat ${beat.id}`);
    assert.ok(beat.purpose.length > 0 && beat.connection.length > 0);
  }
});

test("Mars Approach is connective geography rather than a new campaign unlock", () => {
  const approach = MARS_STORY_THREAD.find((beat) => beat.id === "mars-approach");
  assert.equal(approach?.role, "travel-bridge");
  assert.equal(approach?.campaignSortieId, undefined);
  assert.match(approach?.connection ?? "", /not a new campaign progression gate/i);
});

test("Iron Eclipse stays a separate operation until its story chronology is reconciled", () => {
  const ironEclipse = MARS_PARALLEL_STORY_OPERATIONS.find((operation) => operation.id === "iron-eclipse");
  assert.equal(ironEclipse?.routeId, "iron-eclipse");
  assert.equal(ironEclipse?.chronologyStatus, "unresolved");
  assert.ok(MARS_ADVENTURES.some(({ id }) => id === ironEclipse?.routeId));
});

test("atlas presents narrative context without creating operation or reward authority", () => {
  const component = readFileSync(new URL("./MarsAdventureAtlas.tsx", import.meta.url), "utf8");
  assert.match(component, /CONNECTED STORY THREAD/);
  assert.match(component, /STORY CONTEXT · NOT A LIVE OPERATION LIST/);
  assert.match(component, /Navigation context only/);
  assert.doesNotMatch(component, /fetch\(|new WebSocket|onClick=/);
});
