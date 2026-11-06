import { ORBITAL_WEAPON_RULES_VERSION } from "./flight";
import { ORBITAL_WEAPON_RUNTIME_ID } from "./runtime";

/** Existing server-authoritative sector wire contract kept available for rollback. */
export const SECTOR_COMPAT_PROTOCOL_VERSION = 1 as const;

/** Opt-in sector contract remains pinned independently of combat-only rule releases. */
export const SECTOR_ORBITAL_PROTOCOL_VERSION = 2 as const;

export type SectorProtocolVersion =
  | typeof SECTOR_COMPAT_PROTOCOL_VERSION
  | typeof SECTOR_ORBITAL_PROTOCOL_VERSION;

export const ORBITAL_SECTOR_SIMULATION_CONTRACT = Object.freeze({
  runtimeId: ORBITAL_WEAPON_RUNTIME_ID,
  rulesVersion: ORBITAL_WEAPON_RULES_VERSION,
});

export type SectorSimulationContract = typeof ORBITAL_SECTOR_SIMULATION_CONTRACT;

export function isOrbitalSectorSimulationContract(value: unknown): value is SectorSimulationContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const contract = value as Record<string, unknown>;
  return Object.keys(contract).length === 2 &&
    contract.runtimeId === ORBITAL_SECTOR_SIMULATION_CONTRACT.runtimeId &&
    contract.rulesVersion === ORBITAL_SECTOR_SIMULATION_CONTRACT.rulesVersion;
}
