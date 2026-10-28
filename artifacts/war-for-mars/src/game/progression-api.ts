import {
  applyProgressionAction,
  claimStrike,
  getGameProfile,
  startStrike,
  updateControlScheme,
  type ControlSchemeInput,
  type ProgressionActionInput,
  type StrikeClaimInput,
  type StrikeStartInput,
} from "@workspace/api-client-react";

export const loadServerProfile = () => getGameProfile();
export const saveServerControlScheme = (scheme: ControlSchemeInput["scheme"]) =>
  updateControlScheme({ scheme });
export const startServerStrike = (selection: StrikeStartInput) => startStrike(selection);
export const claimServerStrike = (runId: string, claim: StrikeClaimInput) => claimStrike(runId, claim);
export const sendProgressionAction = (action: ProgressionActionInput) =>
  applyProgressionAction(action);
