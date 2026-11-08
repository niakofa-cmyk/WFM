/** Additive join intent: no client-selected enemy, pose, health or reward. */
export function freeFlightJoinPacket(openingEncounter = false) {
  return openingEncounter
    ? { type: "freeflight_join", openingEncounter: true as const }
    : { type: "freeflight_join" };
}

export function openingEncounterNotice(status: unknown): string {
  if (status === "ready") return "ENTRY PATROL · HOSTILES AHEAD · FIGHT OR DISENGAGE";
  if (status === "unavailable") return "NO OPENING PATROL AVAILABLE · CONTINUE FREE FLIGHT";
  if (status === "resumed") return "EXISTING FLIGHT RESTORED · SHIP AND BATTLE STATE PRESERVED";
  return "";
}
