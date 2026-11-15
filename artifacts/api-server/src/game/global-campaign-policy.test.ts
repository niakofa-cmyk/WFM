import test from "node:test";
import assert from "node:assert/strict";
import { campaignPhase, FINALE_POLICY } from "./global-campaign-policy";
test("all joining and returning pilots read the same shared progress, including conclusion", () => {
  assert.equal(campaignPhase(30,100).progressPercent,30);
  assert.equal(campaignPhase(50,100).phase,"WARDEN_INTERCEPT");
  assert.equal(campaignPhase(70,100).progressPercent,70);
  assert.equal(campaignPhase(75,100).phase,"CAGE_CLIMAX");
  assert.deepEqual(campaignPhase(100,100),{completedOperations:100,targetOperations:100,
    progressPercent:100,phase:"SYSTEM_VICTORY",concluded:true});
  for (const [done,target] of [[-1,100],[101,100],[0,0],[NaN,100],[0,Infinity]]) {
    assert.throws(() => campaignPhase(done!,target!));
  }
  assert.ok(FINALE_POLICY.credits > 0);
});
