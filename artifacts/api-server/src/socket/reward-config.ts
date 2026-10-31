export type WingRewardEnvironment = {
  WFM_WING_REWARDS_ENABLED?: string;
  DATABASE_URL?: string;
};

export type SocketFeatureEnvironment = WingRewardEnvironment & {
  WFM_COMPETITIVE_QUEUE_ENABLED?: string;
  WFM_CASUAL_AI_QUEUE_ENABLED?: string;
};

export function isWingRewardsEnabled(environment: WingRewardEnvironment) {
  return (
    environment.WFM_WING_REWARDS_ENABLED === "true" &&
    Boolean(environment.DATABASE_URL)
  );
}

export function getSocketFeatureReadiness(
  environment: SocketFeatureEnvironment,
) {
  const wingRewardsFlagEnabled =
    environment.WFM_WING_REWARDS_ENABLED === "true";
  const databaseConfigured = Boolean(environment.DATABASE_URL);
  return {
    competitiveQueueEnabled:
      environment.WFM_COMPETITIVE_QUEUE_ENABLED === "true",
    casualAiQueueEnabled:
      environment.WFM_CASUAL_AI_QUEUE_ENABLED === "true",
    wingRewardsFlagEnabled,
    databaseConfigured,
    wingRewardsEnabled: wingRewardsFlagEnabled && databaseConfigured,
  };
}
