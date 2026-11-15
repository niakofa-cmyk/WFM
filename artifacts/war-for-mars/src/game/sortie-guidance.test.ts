import assert from "node:assert/strict";
import test from "node:test";
import { winConditionFor } from "./sortie-guidance";

test("deployment guidance explains each campaign win condition", () => {
  assert.match(winConditionFor("disc"), /two relays/);
  assert.match(winConditionFor("disc"), /tie is a draw/);

  assert.match(winConditionFor("beacons"), /two of three beacons/);
  assert.match(winConditionFor("beacons"), /time expires/);

  assert.match(winConditionFor("ace"), /marked Warden/);
  assert.match(winConditionFor("ace"), /Other kills will not end/);

  assert.match(winConditionFor("extract"), /opposing cage/);
  assert.match(winConditionFor("extract"), /extraction line/);
});
