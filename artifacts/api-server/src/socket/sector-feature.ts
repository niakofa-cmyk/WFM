export function sectorFlightEnabled(environment: Record<string, string | undefined>): boolean {
  const declaration = environment.WFM_SECTOR_FLIGHT_ENABLED;
  if (declaration === "true") return true;
  if (declaration === "false") return false;
  // Ambiguous declarations never opt Production in.
  return environment.NODE_ENV !== "production" && declaration === undefined;
}
