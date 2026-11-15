import assert from "node:assert/strict";
import test from "node:test";
import { campaignBriefing } from "./command-briefing";
import { SORTIES } from "./campaign";
import { nextMenu } from "./menu";

test("command briefing uses actual campaign missions and server-backed completion", () => {
  for (let completed = 0; completed < SORTIES.length; completed++) {
    const briefing = campaignBriefing(completed);
    assert.equal(briefing.sortie, SORTIES[completed]);
    assert.equal(briefing.completed, completed);
    assert.equal(briefing.complete, false);
    assert.equal(briefing.label, "NEXT SORTIE");
  }
});

test("completed campaigns offer replay rather than inventing an additional mission", () => {
  for (const completed of [SORTIES.length, SORTIES.length + 100]) {
    const briefing = campaignBriefing(completed);
    assert.equal(briefing.complete, true);
    assert.equal(briefing.sortie, SORTIES.at(-1));
    assert.equal(briefing.completed, SORTIES.length);
    assert.equal(briefing.label, "CAMPAIGN REPLAY");
  }
});

test("invalid presentation progress cannot expose nonexistent sorties", () => {
  for (const completed of [-10, NaN, Infinity, -Infinity, 0.9]) {
    assert.equal(campaignBriefing(completed).sortie, SORTIES[0]);
    assert.equal(campaignBriefing(completed).completed, 0);
  }
});

test("opening flow and command destinations preserve the existing menu contract", () => {
  assert.equal(nextMenu("BOOT", "BOOT_DONE"), "TITLE");
  assert.equal(nextMenu("TITLE", "START"), "MAIN_MENU");
  assert.equal(nextMenu("MAIN_MENU", "DEPLOY"), "HANGAR");
  assert.equal(nextMenu("MAIN_MENU", "ARCADE"), "HANGAR");
  assert.equal(nextMenu("MAIN_MENU", "ARMORY"), "ARMORY");
  assert.equal(nextMenu("MAIN_MENU", "SETTINGS"), "SETTINGS");
  assert.equal(nextMenu("ARMORY", "BACK"), "MAIN_MENU");
  assert.equal(nextMenu("SETTINGS", "BACK"), "MAIN_MENU");
});

test("visual navigation cannot skip the launch state machine", () => {
  assert.equal(nextMenu("TITLE", "LAUNCH"), "TITLE");
  assert.equal(nextMenu("MAIN_MENU", "LOADED"), "MAIN_MENU");
  assert.equal(nextMenu("HANGAR", "LAUNCH"), "LOADING");
  assert.equal(nextMenu("LOADING", "LOADED"), "GAMEPLAY");
});
