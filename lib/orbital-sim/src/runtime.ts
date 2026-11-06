/**
 * Versioned gameplay runtime identities shared by clients and authoritative
 * services. New sessions use Orbital v2. Orbital v1 remains available only
 * to adjudicate already-issued campaign replays with their original rules.
 */
import {
  LEGACY_ORBITAL_RULES_VERSION,
  ORBITAL_RULES_VERSION,
  type OrbitalRulesVersion,
} from "./flight";

export const LEGACY_ORBITAL_RUNTIME_ID = "orbital-v1" as const;
export const ORBITAL_RUNTIME_ID = "orbital-v2" as const;
export const LEGACY_SURFACE_RUNTIME_ID = "surface-v1" as const;
export type OrbitalRuntimeId = typeof LEGACY_ORBITAL_RUNTIME_ID | typeof ORBITAL_RUNTIME_ID;

export type CombatRuntimeId =
  | OrbitalRuntimeId
  | typeof LEGACY_SURFACE_RUNTIME_ID;

export function isOrbitalRuntimeId(value: unknown): value is OrbitalRuntimeId {
  return value === LEGACY_ORBITAL_RUNTIME_ID || value === ORBITAL_RUNTIME_ID;
}

export function orbitalRulesVersionForRuntime(runtimeId: OrbitalRuntimeId): OrbitalRulesVersion {
  return runtimeId === LEGACY_ORBITAL_RUNTIME_ID
    ? LEGACY_ORBITAL_RULES_VERSION
    : ORBITAL_RULES_VERSION;
}
