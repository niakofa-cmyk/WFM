import { EXPLORATION_CONTRACT, readExplorationReceipt, type ExplorationPilotResult, type ExplorationReceipt, type ExplorationResult } from "./exploration-encounter";

export type ExplorationAward = Readonly<ExplorationPilotResult & {
  balanceAfter: number;
  revision: number;
}>;
export type ExplorationLedgerRecord = {
  version: typeof EXPLORATION_CONTRACT;
  fingerprint: string;
  award: ExplorationAward;
};
export interface ExplorationRewardTransaction {
  /** Must lock all existing profiles in sorted order for the whole transaction. */
  lockProfiles(playerIds: string[]): Promise<Map<string, { credits: number; revision: number }>>;
  findResult(playerId: string, key: string): Promise<ExplorationLedgerRecord | null>;
  applyPatrolOutcome?(
    patrolId: string,
    encounterId: string,
    destroyedActorIds: readonly string[],
  ): Promise<void>;
  writeResult(playerId: string, key: string, result: Readonly<ExplorationResult>, award: ExplorationAward): Promise<void>;
}
export interface ExplorationRewardStore {
  transaction<T>(callback: (tx: ExplorationRewardTransaction) => Promise<T>): Promise<T>;
}
export type ExplorationSettlement =
  | { status: "disabled" | "not_eligible"; awards: readonly [] }
  | { status: "settled" | "duplicate"; awards: readonly ExplorationAward[] };

/** No public endpoint calls this. Rollout requires an explicit trusted-server gate. */
export async function settleExplorationWithStore(
  receipt: ExplorationReceipt,
  store: ExplorationRewardStore,
  enabled = false,
): Promise<ExplorationSettlement> {
  const result = readExplorationReceipt(receipt);
  if (enabled !== true) return { status: "disabled", awards: [] };
  if (result.outcome !== "completed") return { status: "not_eligible", awards: [] };
  const key = `${EXPLORATION_CONTRACT}:${result.encounterId}`;
  return store.transaction(async (tx) => {
    const players = result.pilots.map((pilot) => pilot.playerId).sort();
    const profiles = await tx.lockProfiles(players);
    if (players.some((playerId) => !profiles.has(playerId))) throw new Error("Exploration participant profile missing.");
    for (const profile of profiles.values()) {
      if (!Number.isSafeInteger(profile.credits) || profile.credits < 0 ||
          !Number.isSafeInteger(profile.revision) || profile.revision < 0) throw new Error("Invalid exploration participant balance.");
    }
    const previous: ExplorationAward[] = [];
    for (const playerId of players) {
      const existing = await tx.findResult(playerId, key);
      if (!existing) continue;
      if (existing.version !== result.version || existing.fingerprint !== result.fingerprint) throw new Error("Conflicting exploration settlement.");
      const pilot = result.pilots.find((entry) => entry.playerId === playerId)!;
      const award = existing.award;
      if (award.playerId !== playerId || award.credits !== pilot.credits || award.kills !== pilot.kills ||
          award.assists !== pilot.assists || award.rewardableNpcKills !== pilot.rewardableNpcKills ||
          JSON.stringify(award.destroyedActorIds) !== JSON.stringify(pilot.destroyedActorIds) ||
          !Number.isSafeInteger(award.balanceAfter) || award.balanceAfter < 0 || award.balanceAfter > 2_147_483_647 ||
          !Number.isSafeInteger(award.revision) || award.revision < 1 || award.revision > 2_147_483_647) {
        throw new Error("Invalid exploration ledger award.");
      }
      previous.push(existing.award);
    }
    if (previous.length > 0) {
      if (previous.length !== players.length) throw new Error("Partial exploration settlement requires reconciliation.");
      return { status: "duplicate", awards: previous };
    }
    if (result.patrol) {
      if (!tx.applyPatrolOutcome) throw new Error("Persistent patrol settlement is unavailable.");
      const destroyedActorIds = [...new Set(result.pilots.flatMap((pilot) => pilot.destroyedActorIds))].sort();
      await tx.applyPatrolOutcome(result.patrol.patrolId, result.encounterId, destroyedActorIds);
    }
    const awards: ExplorationAward[] = [];
    for (const pilot of result.pilots) {
      const profile = profiles.get(pilot.playerId)!;
      const balanceAfter = profile.credits + pilot.credits;
      const revision = profile.revision + 1;
      if (!Number.isSafeInteger(balanceAfter) || balanceAfter < 0 || balanceAfter > 2_147_483_647 ||
          !Number.isSafeInteger(revision) || revision < 1 || revision > 2_147_483_647) throw new Error("Exploration balance or revision overflow.");
      const award = { ...pilot, balanceAfter, revision };
      await tx.writeResult(pilot.playerId, key, result, award);
      awards.push(award);
    }
    return { status: "settled", awards };
  });
}
