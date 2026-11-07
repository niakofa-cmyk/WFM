import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SORTIES } from "./campaign";
import { MARS_ADVENTURES } from "./mars-adventure-network";
import { SECTOR_MISSIONS } from "./sector-missions";
import { MARS_STORY_THREAD } from "./mars-story-thread";

test("story thread preserves authored campaign IDs and maps them to Mars geography", () => {
  assert.deepEqual(
    MARS_STORY_THREAD.map((beat) => beat.id),
    ["contact", "mars-approach", "beacon", "warden", "cage", "iron-eclipse", "beyond-signal"],
  );
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
  assert.equal(approach?.sequenceLabel, "CHAPTER II · TRAVEL INTERLUDE");

  const cooperativeChain = SECTOR_MISSIONS
    .filter((mission) => mission.id !== "iron-eclipse")
    .map((mission) => mission.id);
  assert.deepEqual(cooperativeChain, ["rust-disc", "mars-approach", "pale-beacons"]);
  assert.notEqual(
    MARS_STORY_THREAD.find((beat) => beat.id === "beacon")?.campaignSortieId,
    SECTOR_MISSIONS.find((mission) => mission.id === "pale-beacons")?.id,
  );
});

test("Iron Eclipse has a proposed Chapter VI placement without changing standalone access", () => {
  const ironEclipse = MARS_STORY_THREAD.find((beat) => beat.id === "iron-eclipse");
  assert.equal(ironEclipse?.routeId, "iron-eclipse");
  assert.equal(ironEclipse?.role, "proposed-operation");
  assert.equal(ironEclipse?.sequenceLabel, "CHAPTER VI · FLEET OPERATION");
  assert.equal(ironEclipse?.campaignSortieId, undefined);
  assert.match(ironEclipse?.connection ?? "", /proposed strategic bridge/i);
  assert.ok(SECTOR_MISSIONS.find((mission) => mission.id === "iron-eclipse")?.prerequisite === null);
  assert.ok(MARS_ADVENTURES.some(({ id }) => id === ironEclipse?.routeId));
});

test("atlas presents narrative context without creating operation or reward authority", () => {
  const component = readFileSync(new URL("./MarsAdventureAtlas.tsx", import.meta.url), "utf8");
  assert.match(component, /CONNECTED STORY THREAD/);
  assert.match(component, /WORKING STORY ORDER · NOT A LIVE OPERATION LIST/);
  assert.match(component, /Iron Eclipse is a proposed story placement, not a campaign unlock/);
  assert.match(component, /Navigation context only/);
  assert.doesNotMatch(component, /fetch\(|new WebSocket|onClick=/);
});
