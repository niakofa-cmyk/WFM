import {
  applyProgressionAction,
  claimStrike,
  getGameProfile,
  startStrike,
  updateControlScheme,
  updateLeaderboardProfile,
  type ControlSchemeInput,
  type LeaderboardProfileUpdateInput,
  type ProgressionActionInput,
  type StrikeClaimInput,
  type StrikeStartInput,
} from "@workspace/api-client-react";

export const loadServerProfile = () => getGameProfile();
export const saveServerControlScheme = (scheme: ControlSchemeInput["scheme"]) =>
  updateControlScheme({ scheme });
export const saveServerLeaderboardProfile = (input: LeaderboardProfileUpdateInput) =>
  updateLeaderboardProfile(input);
export const startServerStrike = (selection: StrikeStartInput) => startStrike(selection);
export const claimServerStrike = (runId: string, claim: StrikeClaimInput) => claimStrike(runId, claim);
export const sendProgressionAction = (action: ProgressionActionInput) =>
  applyProgressionAction(action);
