import assert from "node:assert/strict";
import test from "node:test";
import { playerWingOutcome, wingRewardCredits } from "./wing-reward-policy";

test("wing reward policy gives a smaller participation reward for a loss", () => {
  assert.equal(wingRewardCredits("win"), 100);
  assert.equal(wingRewardCredits("draw"), 50);
  assert.equal(wingRewardCredits("loss"), 25);
  assert.ok(wingRewardCredits("loss") < wingRewardCredits("draw"));
  assert.ok(wingRewardCredits("draw") < wingRewardCredits("win"));
});

test("wing outcomes map the server-authoritative match result to each team", () => {
  assert.equal(playerWingOutcome("win", 0), "win");
  assert.equal(playerWingOutcome("win", 1), "loss");
  assert.equal(playerWingOutcome("loss", 0), "loss");
  assert.equal(playerWingOutcome("loss", 1), "win");
  assert.equal(playerWingOutcome("draw", 0), "draw");
  assert.equal(playerWingOutcome("draw", 1), "draw");
});
