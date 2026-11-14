import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { EXPLORATION_CONTRACT, type ExplorationResult } from "./exploration-encounter";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";

test("database timeline deduplicates a shared win, commits its finale atomically and never repays a claim", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { db,pool } = await import("@workspace/db");
  const { recordGlobalCampaignClear,claimGlobalCampaignFinaleInTransaction,getGlobalCampaign } = await import("./global-campaign");
  const { GLOBAL_CAMPAIGN_ID,GLOBAL_CAMPAIGN_TARGET } = await import("./global-campaign-policy");
  const oldFlag = process.env.WFM_GLOBAL_CAMPAIGN_ENABLED;
  process.env.WFM_GLOBAL_CAMPAIGN_ENABLED = "true";
  const rollback = new Error("intentional_test_rollback");
  try {
    await assert.rejects(db.transaction(async tx => {
      // Session-local temporary tables shadow production-shaped names. Nothing
      // below reads or changes an actual player's balance or campaign progress.
      await tx.execute(sql`SET LOCAL search_path TO pg_temp`);
      await tx.execute(sql`CREATE TEMP TABLE universe_campaign (
        id text PRIMARY KEY,completed_operations integer NOT NULL DEFAULT 0,
        target_operations integer NOT NULL,concluded_at timestamptz,updated_at timestamptz DEFAULT now()
      ) ON COMMIT DROP`);
      await tx.execute(sql`CREATE TEMP TABLE universe_campaign_events (
        campaign_id text,encounter_id text,fingerprint text, PRIMARY KEY(campaign_id,encounter_id)
      ) ON COMMIT DROP`);
      await tx.execute(sql`CREATE TEMP TABLE universe_campaign_participants (
        campaign_id text,user_id text,PRIMARY KEY(campaign_id,user_id)
      ) ON COMMIT DROP`);
      await tx.execute(sql`CREATE TEMP TABLE player_progress (
        user_id text PRIMARY KEY,credits integer DEFAULT 90,revision integer DEFAULT 0,
        shield_mk2 boolean DEFAULT false,updated_at timestamptz DEFAULT now()
      ) ON COMMIT DROP`);
      // Drizzle's select(profile) reads every schema column: clone the actual
      // profile structure instead of relying on a partial fake profile.
      await tx.execute(sql`ALTER TABLE player_progress RENAME TO unused_minimal_profile`);
      await tx.execute(sql`CREATE TEMP TABLE player_progress (LIKE public.player_progress INCLUDING DEFAULTS) ON COMMIT DROP`);
      await tx.execute(sql`CREATE TEMP TABLE progression_events (LIKE public.progression_events INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP`);
      await tx.execute(sql`INSERT INTO player_progress(user_id) VALUES ('campaign-test-a'),('campaign-test-b')`);
      await tx.execute(sql`INSERT INTO universe_campaign(id,completed_operations,target_operations)
        VALUES (${GLOBAL_CAMPAIGN_ID},0,${GLOBAL_CAMPAIGN_TARGET})`);
      const result: ExplorationResult = {
        version:EXPLORATION_CONTRACT, runtime:ORBITAL_RUNTIME_ID, sectorId:"test-sector",
        finalTick:1,policyId:"test-policy",rewardPolicy:{id:"test-policy",creditsPerNpcKill:0,
          completionCredits:0,maxCreditsPerEncounter:0},
        missionId:"universe-patrol", outcome:"completed", objectiveCompleted:true,
        encounterId:"campaign-test-win", fingerprint:"a".repeat(64),
        pilots:["campaign-test-a","campaign-test-b"].map(playerId => ({
          playerId,kills:0,assists:0,credits:0,rewardableNpcKills:0,destroyedActorIds:[],
        })) };
      await recordGlobalCampaignClear(tx,result);
      await recordGlobalCampaignClear(tx,result);
      const counted = await tx.execute(sql`SELECT completed_operations FROM universe_campaign`);
      assert.equal(counted.rows[0]!.completed_operations,1,"two seats and a retry count as one win");
      await assert.rejects(recordGlobalCampaignClear(tx,{...result,fingerprint:"b".repeat(64)}),/campaign_result_conflict/);
      await assert.rejects(claimGlobalCampaignFinaleInTransaction(tx,"campaign-test-a"),/not_complete/);
      await tx.execute(sql`UPDATE universe_campaign SET completed_operations=25000`);
      const returning = await getGlobalCampaign("campaign-test-a",tx);
      const newcomer = await getGlobalCampaign("never-joined-test-pilot",tx);
      assert.equal(returning.progressPercent,50);
      assert.equal(newcomer.progressPercent,50,"a new pilot sees current shared progress, not a personal zero");
      assert.equal(newcomer.finaleEligible,false);
      await tx.execute(sql`UPDATE universe_campaign SET completed_operations=${GLOBAL_CAMPAIGN_TARGET-1}`);
      await recordGlobalCampaignClear(tx,{...result,encounterId:"campaign-finale-win"});
      const completed = await tx.execute(sql`SELECT completed_operations,concluded_at FROM universe_campaign`);
      assert.equal(completed.rows[0]!.completed_operations,GLOBAL_CAMPAIGN_TARGET);
      assert.ok(completed.rows[0]!.concluded_at);
      const award = await claimGlobalCampaignFinaleInTransaction(tx,"campaign-test-a");
      const repeat = await claimGlobalCampaignFinaleInTransaction(tx,"campaign-test-a");
      assert.equal(award.replayed,false);
      assert.equal(repeat.replayed,true);
      const balances = await tx.execute(sql`SELECT credits,shield_mk2 FROM player_progress WHERE user_id='campaign-test-a'`);
      assert.equal(balances.rows[0]!.credits,5090);
      assert.equal(balances.rows[0]!.shield_mk2,true);
      const otherAward = await claimGlobalCampaignFinaleInTransaction(tx,"campaign-test-b");
      assert.equal(otherAward.replayed,false,"a returning offline participant keeps its own entitlement");
      await recordGlobalCampaignClear(tx,{...result,encounterId:"after-finale"});
      const finalCount = await tx.execute(sql`SELECT completed_operations FROM universe_campaign`);
      assert.equal(finalCount.rows[0]!.completed_operations,GLOBAL_CAMPAIGN_TARGET);
      throw rollback;
    }), error => error === rollback);
  } finally {
    if (oldFlag === undefined) delete process.env.WFM_GLOBAL_CAMPAIGN_ENABLED;
    else process.env.WFM_GLOBAL_CAMPAIGN_ENABLED = oldFlag;
    await pool.end();
  }
});
