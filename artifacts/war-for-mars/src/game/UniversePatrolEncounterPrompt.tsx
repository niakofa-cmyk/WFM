import React from "react";
import type { Faction } from "./ships";
import { PATROL_INTERCEPT_RANGE_METERS } from "./universe-patrol-flight";

export type UniversePatrolEncounterNotice = {
  callsign: string;
  faction: Faction;
  shipCount: number;
  distanceMeters: number;
  source?: "server-snapshot";
};

export function UniversePatrolEncounterPrompt({
  contact,
  enabled,
  onIntercept,
}: {
  contact: UniversePatrolEncounterNotice | null;
  enabled: boolean;
  onIntercept?: () => void;
}) {
  if (!contact) return null;
  const inRange = contact.distanceMeters <= PATROL_INTERCEPT_RANGE_METERS;
  const canStart = enabled && inRange && Boolean(onIntercept);
  return (
    <aside
      className="pointer-events-auto absolute right-3 top-[calc(env(safe-area-inset-top)+5.25rem)] z-30 w-[min(20rem,calc(100vw-1.5rem))] border border-[#f0a95d]/65 bg-[#080b12]/95 p-3 shadow-xl"
      data-testid="panel-in-flight-patrol-contact"
      aria-live="polite"
    >
      <p className="font-hud text-[9px] tracking-[0.2em] text-[#f0a95d]">
        {contact.source === "server-snapshot" ? "LIVE SERVER PATROL CONTACT" : "SERVER-REPORTED PATROL CONTACT"}
      </p>
      <p className="mt-1 font-hud text-sm tracking-widest text-bone">
        {contact.callsign} · {contact.faction.toUpperCase()}
      </p>
      <p className="mt-1 text-[10px] tracking-wide text-muted">
        {contact.shipCount} SHIPS · {Math.round(contact.distanceMeters)}M ·
        {contact.source === "server-snapshot" ? " SERVER POSITION" : " VISUAL CONTACT"}
      </p>
      {inRange ? enabled ? (
        <button
          type="button"
          className="mt-3 min-h-10 w-full border border-[#f0a95d] bg-[#f0a95d] px-3 font-hud text-[10px] tracking-[0.16em] text-[#101116]"
          data-testid="button-intercept-in-flight-patrol"
          onClick={onIntercept}
        >
          REQUEST SERVER APPROACH
        </button>
      ) : (
        <p className="mt-3 border border-bone/15 px-2 py-2 text-[10px] text-muted" data-testid="status-patrol-intercept-disabled">
          INTERCEPT LINK UNAVAILABLE IN THIS DEPLOYMENT
        </p>
      ) : (
        <p className="mt-3 text-[10px] tracking-wide text-muted" data-testid="status-patrol-approach">
          CLOSE TO {PATROL_INTERCEPT_RANGE_METERS}M TO REQUEST APPROACH
        </p>
      )}
    </aside>
  );
}
