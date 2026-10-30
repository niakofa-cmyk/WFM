export const WING_REWARD_POLICY = Object.freeze({
  credits: Object.freeze({ win: 30, draw: 15, loss: 10 }),
  minActiveSeconds: 60,
  minAcceptedInputs: 120,
  maxAwardsPerUtcDay: 5,
});

export type WingOutcome = "win" | "loss" | "draw";
export type WingRewardOutcome = WingOutcome;
export type WingTeam = 0 | 1;
export type WingMatchMode =
  | "private"
  | "practice"
  | "test"
  | "competitive"
  | "casual_ai";

export type WingRewardParticipant = {
  playerId: string;
  team: WingTeam;
  activeSeconds: number;
  acceptedInputs: number;
  connectedAtEnd: boolean;
};

export type CompletedWingMatch = {
  matchId: string;
  matchMode: WingMatchMode;
  result: WingOutcome;
  participants: WingRewardParticipant[];
};

export type WingRewardStatus =
  | "awarded"
  | "not_eligible"
  | "daily_limit"
  | "disabled"
  | "unavailable";

export type WingRewardNotice = {
  status: WingRewardStatus;
  outcome: WingOutcome;
  gain: number;
  balanceAfter: number | null;
  revision: number | null;
  reason?: string;
};

type WingRewardPlan = {
  playerId: string;
  outcome: WingOutcome;
  status: "award" | "not_eligible" | "daily_limit";
  gain: number;
  reason?: string;
};

export type ExistingWingReward = {
  amount: number;
  balanceAfter: number;
  revision: number;
};

export type WingRewardBalance = {
  credits: number;
  revision: number;
};

export type WingRewardWrite = {
  playerId: string;
  idempotencyKey: string;
  matchId: string;
  outcome: WingOutcome;
  amount: number;
};

export interface WingRewardTransaction {
  lockProfiles(playerIds: string[]): Promise<Map<string, WingRewardBalance>>;
  findExistingReward(
    playerId: string,
    idempotencyKey: string,
  ): Promise<ExistingWingReward | null>;
  countRewardsInUtcWindow(
    playerId: string,
    start: Date,
    end: Date,
  ): Promise<number>;
  writeReward(input: WingRewardWrite): Promise<{
    balanceBefore: number;
    balanceAfter: number;
    revision: number;
  }>;
}

export interface WingRewardStore {
  transaction<T>(
    callback: (transaction: WingRewardTransaction) => Promise<T>,
  ): Promise<T>;
}

function opposingOutcome(result: WingOutcome, team: WingTeam): WingOutcome {
  if (team === 0 || result === "draw") return result;
  return result === "win" ? "loss" : "win";
}

export const WING_REWARD_CREDITS: Readonly<Record<WingOutcome, number>> =
  WING_REWARD_POLICY.credits;

export function wingRewardCredits(outcome: WingOutcome): number {
  return WING_REWARD_POLICY.credits[outcome];
}

export function playerWingOutcome(
  matchOutcome: WingOutcome,
  team: WingTeam,
): WingOutcome {
  return opposingOutcome(matchOutcome, team);
}

function qualifies(participant: WingRewardParticipant) {
  return (
    participant.connectedAtEnd &&
    Number.isFinite(participant.activeSeconds) &&
    participant.activeSeconds >= WING_REWARD_POLICY.minActiveSeconds &&
    Number.isSafeInteger(participant.acceptedInputs) &&
    participant.acceptedInputs >= WING_REWARD_POLICY.minAcceptedInputs
  );
}

function utcDayWindow(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function planRewards(
  input: CompletedWingMatch,
  dailyCounts: ReadonlyMap<string, number>,
): WingRewardPlan[] {
  const playerIds = input.participants.map((participant) => participant.playerId);
  const duplicateIdentity = new Set(playerIds).size !== playerIds.length;
  const qualifiedTeams = new Set(
    input.participants
      .filter(qualifies)
      .map((participant) => participant.team),
  );
  const hasQualifiedOpponents = qualifiedTeams.has(0) && qualifiedTeams.has(1);

  return input.participants.map((participant) => {
    const outcome = opposingOutcome(input.result, participant.team);
    if (duplicateIdentity) {
      return {
        playerId: participant.playerId,
        outcome,
        status: "not_eligible",
        gain: 0,
        reason: "duplicate_player_identity",
      };
    }
    if (!hasQualifiedOpponents) {
      return {
        playerId: participant.playerId,
        outcome,
        status: "not_eligible",
        gain: 0,
        reason: "opposing_human_participation_required",
      };
    }
    if (!qualifies(participant)) {
      return {
        playerId: participant.playerId,
        outcome,
        status: "not_eligible",
        gain: 0,
        reason: participant.connectedAtEnd
          ? "participation_threshold"
          : "not_connected_at_completion",
      };
    }
    if (
      (dailyCounts.get(participant.playerId) ?? 0) >=
      WING_REWARD_POLICY.maxAwardsPerUtcDay
    ) {
      return {
        playerId: participant.playerId,
        outcome,
        status: "daily_limit",
        gain: 0,
        reason: "daily_reward_limit",
      };
    }
    return {
      playerId: participant.playerId,
      outcome,
      status: "award",
      gain: WING_REWARD_POLICY.credits[outcome],
    };
  });
}

export async function settleWingMatchWithStore(
  input: CompletedWingMatch,
  store: WingRewardStore,
  now = new Date(),
): Promise<Map<string, WingRewardNotice>> {
  const notices = new Map<string, WingRewardNotice>();
  if (!input.matchId || input.participants.length === 0) return notices;
  if (input.matchMode !== "competitive") {
    for (const participant of input.participants) {
      notices.set(participant.playerId, {
        status: "not_eligible",
        outcome: opposingOutcome(input.result, participant.team),
        gain: 0,
        balanceAfter: null,
        revision: null,
        reason: "competitive_queue_required",
      });
    }
    return notices;
  }

  const playerIds = [...new Set(input.participants.map((item) => item.playerId))]
    .filter((playerId) => playerId.length > 0 && playerId.length <= 256)
    .sort();
  if (
    playerIds.length !== input.participants.length ||
    playerIds.length !== new Set(input.participants.map((item) => item.playerId)).size
  ) {
    for (const participant of input.participants) {
      notices.set(participant.playerId, {
        status: "not_eligible",
        outcome: opposingOutcome(input.result, participant.team),
        gain: 0,
        balanceAfter: null,
        revision: null,
        reason: "invalid_match_participants",
      });
    }
    return notices;
  }

  const potentialAwards = planRewards(input, new Map()).filter(
    (plan) => plan.status === "award",
  );
  const awardPlayerIds = potentialAwards
    .map((plan) => plan.playerId)
    .sort();
  if (awardPlayerIds.length === 0) {
    for (const plan of planRewards(input, new Map())) {
      notices.set(plan.playerId, {
        status: "not_eligible",
        outcome: plan.outcome,
        gain: 0,
        balanceAfter: null,
        revision: null,
        ...(plan.reason ? { reason: plan.reason } : {}),
      });
    }
    return notices;
  }

  const idempotencyKey = `wing:${input.matchId}`;
  const { start, end } = utcDayWindow(now);
  return store.transaction(async (transaction) => {
    const profiles = await transaction.lockProfiles(awardPlayerIds);
    const existing = new Map<string, ExistingWingReward | null>();
    const dailyCounts = new Map<string, number>();

    for (const playerId of awardPlayerIds) {
      existing.set(
        playerId,
        await transaction.findExistingReward(playerId, idempotencyKey),
      );
    }
    for (const playerId of awardPlayerIds) {
      if (!existing.get(playerId)) {
        dailyCounts.set(
          playerId,
          await transaction.countRewardsInUtcWindow(playerId, start, end),
        );
      }
    }

    const plans = planRewards(input, dailyCounts);
    for (const plan of plans) {
      const previous = existing.get(plan.playerId);
      if (previous) {
        notices.set(plan.playerId, {
          status: "awarded",
          outcome: plan.outcome,
          gain: previous.amount,
          balanceAfter: previous.balanceAfter,
          revision: previous.revision,
        });
        continue;
      }
      if (plan.status !== "award") {
        notices.set(plan.playerId, {
          status: plan.status,
          outcome: plan.outcome,
          gain: 0,
          balanceAfter: profiles.get(plan.playerId)?.credits ?? null,
          revision: profiles.get(plan.playerId)?.revision ?? null,
          ...(plan.reason ? { reason: plan.reason } : {}),
        });
        continue;
      }

      if (!profiles.has(plan.playerId)) {
        throw new Error("Wing reward profile lock was not acquired.");
      }
      const balance = await transaction.writeReward({
        playerId: plan.playerId,
        idempotencyKey,
        matchId: input.matchId,
        outcome: plan.outcome,
        amount: plan.gain,
      });
      profiles.set(plan.playerId, {
        credits: balance.balanceAfter,
        revision: balance.revision,
      });
      notices.set(plan.playerId, {
        status: "awarded",
        outcome: plan.outcome,
        gain: plan.gain,
        balanceAfter: balance.balanceAfter,
        revision: balance.revision,
      });
    }
    return notices;
  });
}
