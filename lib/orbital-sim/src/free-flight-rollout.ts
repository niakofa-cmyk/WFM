export type FreeFlightRolloutInput = {
  environment: string;
  featureFlag?: string;
  prerequisitesReady: boolean;
};

/**
 * Development previews opt in by default when their required services exist.
 * Production remains explicitly gated, and "false" disables either mode.
 */
export function isOrbitalFreeFlightEnabled({
  environment,
  featureFlag,
  prerequisitesReady,
}: FreeFlightRolloutInput): boolean {
  if (!prerequisitesReady || featureFlag === "false") return false;
  return featureFlag === "true" || environment !== "production";
}
