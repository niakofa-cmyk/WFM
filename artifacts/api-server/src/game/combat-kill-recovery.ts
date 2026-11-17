export type CombatKillProgress = { kills: number; streak: number; bestStreak: number };
export const COMBAT_KILL_MILESTONES = [5, 10, 15, 20] as const;
export function validCombatKillProgress(value: CombatKillProgress) {
  return value && [value.kills, value.streak, value.bestStreak].every(n => Number.isSafeInteger(n) && n >= 0) &&
    value.streak <= value.bestStreak && value.bestStreak <= value.kills;
}
/** Called once on an accepted server-owned hostile destruction, never a claim. */
export function combatKillRecovery(progress: CombatKillProgress, energy: number, heavy: boolean) {
  if (!validCombatKillProgress(progress) || progress.kills >= Number.MAX_SAFE_INTEGER ||
      !Number.isFinite(energy) || energy < 0 || energy > 100)
    throw new Error("Invalid combat kill recovery state.");
  const next = { kills: progress.kills + 1, streak: progress.streak + 1,
    bestStreak: Math.max(progress.bestStreak, progress.streak + 1) };
  const milestone = COMBAT_KILL_MILESTONES.find(n => n === next.streak) ?? null;
  const restored = Math.min(100 - energy, (heavy ? 30 : 20) + (milestone ? 10 : 0));
  return { progress: next, energy: energy + restored, restored, milestone };
}
