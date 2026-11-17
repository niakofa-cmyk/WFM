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

/** Development pairs V2 by default; production requires explicit paired opt-in. */
export function sectorProtocolVersion(
  environment: Record<string, string | undefined>,
): SectorProtocolVersion {
  const flag = environment.WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED;
  return sectorFlightEnabled(environment) &&
      (flag === "true" || (environment.NODE_ENV !== "production" && flag !== "false"))
    ? SECTOR_ORBITAL_PROTOCOL_VERSION
    : SECTOR_COMPAT_PROTOCOL_VERSION;
}
