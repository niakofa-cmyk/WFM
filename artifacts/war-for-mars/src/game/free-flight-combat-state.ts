/** A failed secondary request is not authority to end an existing encounter. */
export function combatStatusAfterRequest(active: boolean): string {
  return active ? "active" : "requesting";
}

export function combatStatusAfterError(current: string, active: boolean, reason: string): string {
  if (reason === "freeflight_engagement_required") return "idle";
  if (reason === "freeflight_rate_limited") return current;
  return active ? "active" : reason;
}

export function freeFlightCombatNotice(reason: string): string {
  if (reason === "freeflight_rate_limited") return "";
  if (reason === "freeflight_encounter_active") return "Fleet already engaged. Continue the battle.";
  if (reason === "freeflight_patrol_departed") return "Patrol has moved on. Contacts updated.";
  if (reason === "freeflight_patrol_roster_changed") return "Fleet roster changed. Contacts updated; approach again.";
  if (reason === "freeflight_patrol_reservation_unavailable") return "Fleet unavailable. Contacts refreshed; keep flying or approach another fleet.";
  if (reason === "freeflight_patrol_refresh_unavailable") return "Could not refresh this fleet. Keep flying and retry.";
  if (reason === "freeflight_location_changed") return "Server location changed. Leave flight and re-enter from the hangar.";
  if (reason === "freeflight_patrol_approach_required") return "Close to the fleet to engage.";
  return "Combat request unavailable. Keep flying and retry.";
}
