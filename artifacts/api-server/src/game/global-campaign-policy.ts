/** A versioned collective-operations policy, not a per-account completion count.
 * 50,000 is the supplied document's provisional tuning target, not a load claim. */
export const GLOBAL_CAMPAIGN_ID = "infinite-war-v1";
export const GLOBAL_CAMPAIGN_TARGET = 50_000;
export const FINALE_POLICY = Object.freeze({
  credits: 5_000, campaignXp: 1_000, badge: "INFINITE_WAR_VETERAN", shieldMk2: true,
});
export function campaignPhase(completed: number, target: number) {
  if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(target) ||
      target <= 0 || completed < 0 || completed > target) throw new Error("invalid_campaign_state");
  const progressPercent = completed * 100 / target;
  const phase = completed === target ? "SYSTEM_VICTORY" :
    progressPercent >= 75 ? "CAGE_CLIMAX" : progressPercent >= 50 ? "WARDEN_INTERCEPT" :
      progressPercent >= 25 ? "BEACON_RECON" : "INITIAL_CONTACT";
  return { completedOperations: completed, targetOperations: target, progressPercent,
    phase, concluded: completed === target };
}
