import { SHIPS } from "./ships";

export type FreeFlightRecoveryHint = {
  protocol: 1;
  mode: "location" | "loadout";
  shipId: keyof typeof SHIPS;
  faction: "ussf" | "accord";
  alive: boolean;
  locationKey: string;
};

/** Only the authenticated pilot's retained deployment may supply this hint. */
export function readFreeFlightRecoveryHint(value: unknown): FreeFlightRecoveryHint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hint = value as Record<string, unknown>;
  if (Object.keys(hint).length !== 6 || hint.protocol !== 1 ||
      (hint.mode !== "location" && hint.mode !== "loadout") ||
      typeof hint.shipId !== "string" || !Object.hasOwn(SHIPS, hint.shipId) ||
      (hint.faction !== "ussf" && hint.faction !== "accord") ||
      typeof hint.alive !== "boolean" || typeof hint.locationKey !== "string" ||
      !/^[A-Za-z0-9:_-]{1,80}$/.test(hint.locationKey)) return null;
  const shipId = hint.shipId as keyof typeof SHIPS;
  if (SHIPS[shipId].faction !== hint.faction) return null;
  return { protocol: 1, mode: hint.mode, shipId, faction: hint.faction,
    alive: hint.alive, locationKey: hint.locationKey };
}

export function freeFlightRecoveryHintText(hint: FreeFlightRecoveryHint): string {
  const ship = SHIPS[hint.shipId].name;
  const location = hint.locationKey.split(":").at(-1)!.replaceAll("-", " ");
  if (hint.mode === "loadout") {
    return `Your deployed ${ship} (${hint.faction.toUpperCase()}) still has retained flight state. ` +
      `Return to command, reselect ${ship} in Fleet, then resume at ${location}. ` +
      "Changing loadout cannot repair a damaged ship or clear an unfinished battle.";
  }
  return `Your ${ship} must resume at ${location}. Return to command and use normal travel to get back. ` +
    (hint.alive ? "Your ship and unfinished battle are retained." :
      "Re-enter there and request recovery after battle results settle.") +
    " Travel and reconnecting do not repair your hull.";
}
