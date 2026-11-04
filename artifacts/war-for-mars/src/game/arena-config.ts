import type { TechId } from "./campaign";
import {
  LEGACY_SURFACE_RUNTIME_ID,
  ORBITAL_RUNTIME_ID,
  type CombatRuntimeId,
} from "@workspace/orbital-sim";

type ServerRunConfig = { tech: TechId | null; flightModel?: string };

export function resolveArenaTech(
  serverConfig: ServerRunConfig | null | undefined,
  savedTech: TechId | null,
): TechId | null {
  return serverConfig ? serverConfig.tech : savedTech;
}

/**
 * Offline Arena practice uses the canonical engine. Live rooms remain on the
 * legacy runtime until the socket protocol negotiates orbital authority.
 * Server-issued runs follow their pinned model, including legacy runs.
 */
export function resolveArenaRuntime(
  serverConfig: ServerRunConfig | null | undefined,
  online: boolean,
): CombatRuntimeId {
  if (serverConfig) {
    return serverConfig.flightModel === ORBITAL_RUNTIME_ID
      ? ORBITAL_RUNTIME_ID
      : LEGACY_SURFACE_RUNTIME_ID;
  }
  return online ? LEGACY_SURFACE_RUNTIME_ID : ORBITAL_RUNTIME_ID;
}
