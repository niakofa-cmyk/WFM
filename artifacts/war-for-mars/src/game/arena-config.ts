import type { TechId } from "./campaign";
import {
  LEGACY_SURFACE_RUNTIME_ID,
  isOrbitalRuntimeId,
  ORBITAL_RUNTIME_ID,
  type CombatRuntimeId,
  type GameModeId,
} from "@workspace/orbital-sim";

type ServerRunConfig = { mission?: string; tech: TechId | null; flightModel?: string };

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
    return isOrbitalRuntimeId(serverConfig.flightModel)
      ? serverConfig.flightModel
      : LEGACY_SURFACE_RUNTIME_ID;
  }
  return online ? LEGACY_SURFACE_RUNTIME_ID : ORBITAL_RUNTIME_ID;
}

/** Map each real Arena launch to its declared operation contract. */
export function resolveArenaModeId(
  serverConfig: ServerRunConfig | null | undefined,
  online: boolean,
  offlineStrike = false,
): GameModeId {
  if (online) return "wing-online";
  if (!serverConfig) return offlineStrike ? "arcade-skirmish" : "local-arena-practice";
  return serverConfig.mission === "contact" && isOrbitalRuntimeId(serverConfig.flightModel)
    ? "campaign-contact"
    : "campaign-sortie";
}
