import type { FreeFlightSnapshotV1 } from "@workspace/orbital-sim";

export type FreeFlightPilotVitals = Pick<FreeFlightSnapshotV1["actors"][number],
  "alive" | "hull" | "hullMax" | "shield" | "shieldMax">;

export function freeFlightPilotVitals(
  snapshot: Pick<FreeFlightSnapshotV1, "actors" | "ownActorId"> | undefined,
): FreeFlightPilotVitals | null {
  const own = snapshot?.actors.find((actor) =>
    actor.actorId === snapshot.ownActorId && actor.own && actor.kind === "pilot");
  if (!own) return null;
  const { alive, hull, hullMax, shield, shieldMax } = own;
  return { alive, hull, hullMax, shield, shieldMax };
}

export function sameFreeFlightPilotVitals(
  a: FreeFlightPilotVitals | null, b: FreeFlightPilotVitals | null,
): boolean {
  return a === b || Boolean(a && b && a.alive === b.alive && a.hull === b.hull &&
    a.hullMax === b.hullMax && a.shield === b.shield && a.shieldMax === b.shieldMax);
}

export function freeFlightWeaponsEnabled(
  active: boolean, pilot: FreeFlightPilotVitals | null,
): boolean {
  return active && pilot?.alive === true;
}

/** Primary guns stay armed throughout shared flight; the server decides hits. */
export function freeFlightPrimaryFireEnabled(
  pilot: FreeFlightPilotVitals | null,
): boolean {
  return pilot?.alive === true;
}

/** A refused join carries no vitals, but must not hide the recovery exit. */
export function freeFlightRecoveryRequired(
  status: string, pilot: FreeFlightPilotVitals | null,
): boolean {
  return status === "freeflight_recovery_required" || pilot?.alive === false;
}

export function freeFlightConnectionStatusAfter(
  current: string, state: string, reason?: string,
): string {
  if (state === "joined") return state;
  // Closing the refused socket starts reconnect callbacks. They are not
  // authority to dismiss the server's outstanding recovery requirement.
  if (current === "freeflight_recovery_required") return current;
  // A transport reason describes why retries began, not a failed admission.
  if (state === "reconnecting") return state;
  return reason ?? state;
}

/** Presentation is never authority to admit a pilot to shared flight. */
export function freeFlightLinkPresentation(status: string, enabled: boolean, recovery: boolean) {
  if (recovery) return {
    state: "recovery", label: "RECOVERY REQUIRED",
    detail: "Return to the hangar to restore your saved ship.",
  };
  if (!enabled) return {
    state: "preview", label: "LOCAL PREVIEW",
    detail: "Not connected to shared multiplayer flight.",
  };
  if (status === "joined") return {
    state: "shared", label: "SHARED FLIGHT",
    detail: "Server-admitted to your current spatial session. Only nearby ships are streamed.",
  };
  if (status === "connecting" || status === "authenticating") return {
    state: status, label: status === "connecting" ? "CONNECTING" : "AUTHENTICATING",
    detail: "Waiting for server admission. Shared flight is not confirmed yet.",
  };
  if (status === "reconnecting") return {
    state: "reconnecting", label: "RECONNECTING",
    detail: "Flight link interrupted. Waiting for the server to restore shared flight.",
  };
  return {
    state: "unavailable", label: "LINK UNAVAILABLE",
    detail: status === "client_module_failed" || status === "client_module_unavailable"
      ? "Flight client could not load. Leave flight and retry."
      : "Shared flight admission is unavailable. Leave flight and retry; this is not a confirmed shared session.",
  };
}

/** A failed secondary request is not authority to end an existing encounter. */
export function combatStatusAfterRequest(active: boolean): string {
  return active ? "active" : "requesting";
}

export function combatStatusAfterError(current: string, active: boolean, reason: string): string {
  if (reason === "freeflight_pilot_destroyed") return "disabled";
  if (reason === "freeflight_engagement_required") return "idle";
  if (reason === "freeflight_rate_limited") return current;
  return active ? "active" : reason;
}

export function freeFlightCombatNotice(reason: string): string {
  if (reason === "freeflight_pilot_destroyed") return "Ship disabled. Return to the hangar.";
  if (reason === "freeflight_recovery_pending_settlement") return "Recovery waiting: your fleet battle or reward settlement is still unresolved. Retry after settlement.";
  if (reason === "freeflight_recovery_not_disabled") return "Recovery is only available for a disabled ship.";
  if (reason === "freeflight_recovery_location_changed") return "Recovery blocked: your verified world location changed. Return to command; no substitute destination was selected.";
  if (reason === "freeflight_recovery_required") return "Your previous ship still has damage or an unresolved battle. Restore its saved loadout to reconnect; changing ships cannot repair it.";
  if (reason === "freeflight_rate_limited") return "";
  if (reason === "freeflight_encounter_active") return "Fleet already engaged. Continue the battle.";
  if (reason === "freeflight_patrol_departed") return "Patrol has moved on. Contacts updated.";
  if (reason === "freeflight_patrol_roster_changed") return "Fleet roster changed. Contacts updated; approach again.";
  if (reason === "freeflight_patrol_reservation_unavailable") return "Fleet unavailable. Contacts refreshed; keep flying or approach another fleet.";
  if (reason === "freeflight_patrol_refresh_unavailable") return "Could not refresh this fleet. Keep flying and retry.";
  if (reason === "freeflight_location_changed") return "Server location changed. Leave flight and re-enter from the hangar.";
  if (reason === "freeflight_patrol_approach_required") return "Close to the fleet to engage.";
  if (reason === "freeflight_assist_approach_required") return "Move within 520 m of the battle to answer the wing call.";
  if (reason === "freeflight_assist_call_expired") return "Wing call expired. Ask for support again if the battle is still active.";
  if (reason === "freeflight_assist_call_cooldown") return "Wing support signal is cooling down.";
  return "Combat request unavailable. Keep flying and retry.";
}
