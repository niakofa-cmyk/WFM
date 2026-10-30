export type WingRewardEnvironment = {
  WFM_WING_REWARDS_ENABLED?: string;
  DATABASE_URL?: string;
};

export function isWingRewardsEnabled(environment: WingRewardEnvironment) {
  return (
    environment.WFM_WING_REWARDS_ENABLED === "true" &&
    Boolean(environment.DATABASE_URL)
  );
}
