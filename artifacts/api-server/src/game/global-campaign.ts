import { and, eq, sql } from "drizzle-orm";
import { db, playerProgressTable, progressionEventsTable } from "@workspace/db";
import { campaignPhase, FINALE_POLICY, GLOBAL_CAMPAIGN_ID, GLOBAL_CAMPAIGN_TARGET } from "./global-campaign-policy";
import type { ExplorationResult } from "./exploration-encounter";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const globalCampaignEnabled = () => process.env.WFM_GLOBAL_CAMPAIGN_ENABLED === "true";
export class CampaignError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const finaleKey = `global-campaign-finale:${GLOBAL_CAMPAIGN_ID}`;
let flightRead: Promise<{ concluded: boolean }> | undefined;
let flightReadUntil = 0;
/** At most one shared DB read per second per process; errors never become 0%. */
export function globalCampaignFlightState() {
  if (!globalCampaignEnabled()) return Promise.resolve({ concluded: false });
  if (!flightRead || Date.now() >= flightReadUntil) {
    flightReadUntil = Date.now() + 1_000;
    flightRead = getGlobalCampaign().then(state => ({ concluded: state.concluded }));
  }
  return flightRead;
}

async function lockCampaign(tx: Transaction) {
  await tx.execute(sql`INSERT INTO universe_campaign(id, target_operations)
    VALUES (${GLOBAL_CAMPAIGN_ID}, ${GLOBAL_CAMPAIGN_TARGET}) ON CONFLICT (id) DO NOTHING`);
  const result = await tx.execute(sql`SELECT completed_operations, target_operations, concluded_at
    FROM universe_campaign WHERE id=${GLOBAL_CAMPAIGN_ID} FOR UPDATE`);
  const row = result.rows[0] as { completed_operations: number; target_operations: number; concluded_at: Date | null };
  if (!row || row.target_operations !== GLOBAL_CAMPAIGN_TARGET) throw new Error("campaign_policy_mismatch");
  return { row, state: campaignPhase(row.completed_operations, row.target_operations) };
}

/** Called only after the account and saved location have been verified for shared flight. */
export async function joinGlobalCampaign(userId: string) {
  if (!globalCampaignEnabled()) return;
  await db.transaction(async tx => {
    const { state } = await lockCampaign(tx);
    if (state.concluded) throw new CampaignError("global_campaign_complete");
    await tx.execute(sql`INSERT INTO universe_campaign_participants(campaign_id,user_id)
      VALUES (${GLOBAL_CAMPAIGN_ID},${userId}) ON CONFLICT DO NOTHING`);
  });
}

/** Within the SAME transaction as a trusted free-flight encounter's settlement.
 * No client route can increment the clock; multiplayer seats count once together. */
export async function recordGlobalCampaignClear(tx: Transaction, result: Readonly<ExplorationResult>) {
  if (!globalCampaignEnabled() || result.missionId !== "universe-patrol" ||
      result.outcome !== "completed" || !result.objectiveCompleted) return;
  const { state } = await lockCampaign(tx);
  const existing = await tx.execute(sql`SELECT fingerprint FROM universe_campaign_events
    WHERE campaign_id=${GLOBAL_CAMPAIGN_ID} AND encounter_id=${result.encounterId}`);
  if (existing.rows.length) {
    if (existing.rows[0]!.fingerprint !== result.fingerprint) throw new Error("campaign_result_conflict");
    return;
  }
  if (state.concluded) return;
  await tx.execute(sql`INSERT INTO universe_campaign_events(campaign_id,encounter_id,fingerprint)
    VALUES (${GLOBAL_CAMPAIGN_ID},${result.encounterId},${result.fingerprint})`);
  for (const pilot of result.pilots) {
    await tx.execute(sql`INSERT INTO universe_campaign_participants(campaign_id,user_id)
      VALUES (${GLOBAL_CAMPAIGN_ID},${pilot.playerId}) ON CONFLICT DO NOTHING`);
  }
  await tx.execute(sql`UPDATE universe_campaign SET completed_operations=completed_operations+1,
    concluded_at=CASE WHEN completed_operations+1=target_operations THEN now() ELSE NULL END,
    updated_at=now() WHERE id=${GLOBAL_CAMPAIGN_ID}`);
}

export async function getGlobalCampaign(userId?: string, reader: Pick<Transaction,"execute"|"select"> = db) {
  const empty = { enabled: false, campaignId: GLOBAL_CAMPAIGN_ID,
    ...campaignPhase(0, GLOBAL_CAMPAIGN_TARGET), finaleEligible: false, finaleClaimed: false };
  if (!globalCampaignEnabled()) return empty;
  const rows = await reader.execute(sql`SELECT completed_operations,target_operations FROM universe_campaign
    WHERE id=${GLOBAL_CAMPAIGN_ID}`);
  const row = rows.rows[0] as { completed_operations: number; target_operations: number } | undefined;
  const state = row ? campaignPhase(row.completed_operations,row.target_operations) : campaignPhase(0, GLOBAL_CAMPAIGN_TARGET);
  let finaleEligible = false;
  let finaleClaimed = false;
  if (userId) {
    const participant = await reader.execute(sql`SELECT 1 FROM universe_campaign_participants
      WHERE campaign_id=${GLOBAL_CAMPAIGN_ID} AND user_id=${userId}`);
    finaleEligible = participant.rows.length > 0;
    const [claim] = await reader.select({ id: progressionEventsTable.id }).from(progressionEventsTable)
      .where(and(eq(progressionEventsTable.userId,userId),eq(progressionEventsTable.idempotencyKey,finaleKey))).limit(1);
    finaleClaimed = Boolean(claim);
  }
  return { enabled: true, campaignId: GLOBAL_CAMPAIGN_ID, ...state, finaleEligible, finaleClaimed };
}

/** Durable unique ledger key has no Redis expiry. Retry after any crash is safe.
 * Offline participants receive the same entitlement when they return and claim. */
export async function claimGlobalCampaignFinale(userId: string) {
  if (!globalCampaignEnabled()) throw new CampaignError("global_campaign_disabled");
  return db.transaction(tx => claimGlobalCampaignFinaleInTransaction(tx,userId));
}

/** Transaction seam for rollback-isolated verification; never exposed as a route. */
export async function claimGlobalCampaignFinaleInTransaction(tx: Transaction, userId: string) {
    if (!globalCampaignEnabled()) throw new CampaignError("global_campaign_disabled");
    // Same ordering as exploration settlement: profiles first, campaign second.
    const [profile] = await tx.select().from(playerProgressTable)
      .where(eq(playerProgressTable.userId,userId)).for("update");
    if (!profile) throw new CampaignError("pilot_profile_required");
    const { state } = await lockCampaign(tx);
    if (!state.concluded) throw new CampaignError("global_campaign_not_complete");
    const [prior] = await tx.select({ result: progressionEventsTable.result }).from(progressionEventsTable)
      .where(and(eq(progressionEventsTable.userId,userId),eq(progressionEventsTable.idempotencyKey,finaleKey)));
    if (prior) return { ...FINALE_POLICY, campaignId: GLOBAL_CAMPAIGN_ID, replayed: true };
    const participant = await tx.execute(sql`SELECT 1 FROM universe_campaign_participants
      WHERE campaign_id=${GLOBAL_CAMPAIGN_ID} AND user_id=${userId}`);
    if (!participant.rows.length) throw new CampaignError("global_campaign_participation_required");
    const balance = profile.credits + FINALE_POLICY.credits;
    if (balance > 2_147_483_647 || profile.revision >= 2_147_483_647) throw new Error("finale_balance_overflow");
    await tx.update(playerProgressTable).set({ credits: balance, shieldMk2: true,
      revision: profile.revision+1, updatedAt: new Date() }).where(eq(playerProgressTable.userId,userId));
    const award = { campaignId: GLOBAL_CAMPAIGN_ID, ...FINALE_POLICY, replayed: false };
    await tx.insert(progressionEventsTable).values({
      userId, idempotencyKey: finaleKey, kind: "world_exploration", amount: FINALE_POLICY.credits,
      balanceBefore: profile.credits, balanceAfter: balance,
      result: { mode: "global-campaign-finale-v1", ...award },
    });
    return award;
}
