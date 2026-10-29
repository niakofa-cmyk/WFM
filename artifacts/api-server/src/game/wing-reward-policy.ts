export type WingRewardOutcome = "win" | "loss" | "draw";

// These are in-game credits only. They are never redeemable for cash.
export const WING_REWARD_CREDITS: Readonly<Record<WingRewardOutcome, number>> = {
  win: 100,
  draw: 50,
  loss: 25,
};

export function wingRewardCredits(outcome: WingRewardOutcome): number {
  return WING_REWARD_CREDITS[outcome];
}

export function playerWingOutcome(
  matchOutcome: WingRewardOutcome,
  team: 0 | 1,
): WingRewardOutcome {
  if (matchOutcome === "draw") return "draw";
  const teamZeroWon = matchOutcome === "win";
  return (team === 0) === teamZeroWon ? "win" : "loss";
}
