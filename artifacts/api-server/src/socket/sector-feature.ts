import {
  SECTOR_COMPAT_PROTOCOL_VERSION,
  SECTOR_ORBITAL_PROTOCOL_VERSION,
  type SectorProtocolVersion,
} from "@workspace/orbital-sim";

export function sectorFlightEnabled(environment: Record<string, string | undefined>): boolean {
  const declaration = environment.WFM_SECTOR_FLIGHT_ENABLED;
  if (declaration === "true") return true;
  if (declaration === "false") return false;
  // Ambiguous declarations never opt Production in.
  return environment.NODE_ENV !== "production" && declaration === undefined;
}

/** V2 is an explicit paired-deployment opt-in; the v1 contract remains rollback-safe. */
export function sectorProtocolVersion(
  environment: Record<string, string | undefined>,
): SectorProtocolVersion {
  return sectorFlightEnabled(environment) &&
      environment.WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED === "true"
    ? SECTOR_ORBITAL_PROTOCOL_VERSION
    : SECTOR_COMPAT_PROTOCOL_VERSION;
}
