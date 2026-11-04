/**
 * Versioned gameplay runtime identities shared by clients and authoritative
 * services. New operations should use the canonical orbital runtime; the
 * surface runtime remains only to replay runs issued before migration.
 */
export const ORBITAL_RUNTIME_ID = "orbital-v1" as const;
export const LEGACY_SURFACE_RUNTIME_ID = "surface-v1" as const;

export type CombatRuntimeId =
  | typeof ORBITAL_RUNTIME_ID
  | typeof LEGACY_SURFACE_RUNTIME_ID;
