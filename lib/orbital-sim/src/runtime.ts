/**
 * Versioned gameplay runtime identities shared by clients and authoritative
 * services. New sessions use Orbital v3. Orbital v1 and v2 remain available
 * to adjudicate already-issued campaign replays with their original rules.
 */
import {
  LEGACY_ORBITAL_RULES_VERSION,
  ORBITAL_WEAPON_RULES_VERSION,
  ORBITAL_RULES_VERSION,
  type OrbitalRulesVersion,
} from "./flight";

export const LEGACY_ORBITAL_RUNTIME_ID = "orbital-v1" as const;
export const ORBITAL_WEAPON_RUNTIME_ID = "orbital-v2" as const;
export const ORBITAL_RUNTIME_ID = "orbital-v3" as const;
export const LEGACY_SURFACE_RUNTIME_ID = "surface-v1" as const;
export type OrbitalRuntimeId =
  | typeof LEGACY_ORBITAL_RUNTIME_ID
  | typeof ORBITAL_WEAPON_RUNTIME_ID
  | typeof ORBITAL_RUNTIME_ID;

export type CombatRuntimeId =
  | OrbitalRuntimeId
  | typeof LEGACY_SURFACE_RUNTIME_ID;

export function isOrbitalRuntimeId(value: unknown): value is OrbitalRuntimeId {
  return value === LEGACY_ORBITAL_RUNTIME_ID ||
    value === ORBITAL_WEAPON_RUNTIME_ID ||
    value === ORBITAL_RUNTIME_ID;
}

export function orbitalRulesVersionForRuntime(runtimeId: OrbitalRuntimeId): OrbitalRulesVersion {
  if (runtimeId === LEGACY_ORBITAL_RUNTIME_ID) return LEGACY_ORBITAL_RULES_VERSION;
  if (runtimeId === ORBITAL_WEAPON_RUNTIME_ID) return ORBITAL_WEAPON_RULES_VERSION;
  return ORBITAL_RULES_VERSION;
}
