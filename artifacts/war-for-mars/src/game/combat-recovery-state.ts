export type CombatRecoveryState = {
  type: "freeflight_combat_progress"; protocol: 1; sessionInstanceId: string;
  actorId: string; tick: number; energy: number; kills: number; streak: number;
  bestStreak: number; restored: number; milestone: number | null; reason: "kill" | "sync";
};
/** Optional additive packet: old snapshots and old servers remain valid. */
export function isCombatRecoveryState(value: unknown): value is CombatRecoveryState {
  if (!value || typeof value !== "object") return false;
  const p = value as CombatRecoveryState;
  return p.type === "freeflight_combat_progress" && p.protocol === 1 &&
    typeof p.sessionInstanceId === "string" && /^[0-9a-f-]{36}$/i.test(p.sessionInstanceId) &&
    typeof p.actorId === "string" && /^[A-Za-z0-9_:-]{8,80}$/.test(p.actorId) &&
    [p.tick, p.kills, p.streak, p.bestStreak].every(n => Number.isSafeInteger(n) && n >= 0) &&
    p.streak <= p.bestStreak && p.bestStreak <= p.kills &&
    Number.isFinite(p.energy) && p.energy >= 0 && p.energy <= 100 &&
    Number.isFinite(p.restored) && p.restored >= 0 && p.restored <= 40 &&
    (p.milestone === null || [5, 10, 15, 20].includes(p.milestone) && p.milestone === p.streak) &&
    (p.reason === "kill" || p.reason === "sync");
}
