import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetGlobalCampaignQueryKey } from "@workspace/api-client-react";
import { GlobalCampaignStatus } from "./GlobalCampaignStatus";

function render(state: Record<string,unknown>) {
  const client = new QueryClient();
  client.setQueryData(getGetGlobalCampaignQueryKey(), {
    enabled:true,campaignId:"test-only",completedOperations:50,targetOperations:100,
    progressPercent:50,phase:"WARDEN_INTERCEPT",concluded:false,
    finaleEligible:false,finaleClaimed:false,...state,
  });
  return renderToStaticMarkup(createElement(QueryClientProvider,{client},
    createElement(GlobalCampaignStatus)));
}
test("shared campaign UI uses the server percent and never creates a private timeline", () => {
  const html = render({});
  assert.match(html,/SHARED CAMPAIGN/);
  assert.match(html,/50/);
  assert.doesNotMatch(html,/CAMPAIGN COMPLETE/);
  assert.equal(render({enabled:false}),"");
});
test("the shared finale distinguishes returning participants from post-finale newcomers", () => {
  const ended = {concluded:true,progressPercent:100,completedOperations:100,phase:"SYSTEM_VICTORY"};
  const participant = render({...ended,finaleEligible:true});
  assert.match(participant,/CAMPAIGN COMPLETE/);
  assert.match(participant,/CLAIM FINALE REWARD/);
  const newcomer = render({...ended,finaleEligible:false});
  assert.doesNotMatch(newcomer,/CLAIM FINALE REWARD/);
  assert.match(newcomer,/new participation is closed/);
  const previouslyClaimed = render({...ended,finaleEligible:true,finaleClaimed:true});
  assert.doesNotMatch(previouslyClaimed,/CLAIM FINALE REWARD/);
  assert.match(previouslyClaimed,/already recorded/);
});
