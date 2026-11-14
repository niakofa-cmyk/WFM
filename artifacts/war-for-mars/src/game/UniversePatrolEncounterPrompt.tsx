import React from "react";
import { SHIPS, type Faction, type ShipId } from "./ships";
import { PATROL_INTERCEPT_RANGE_METERS } from "./universe-patrol-flight";
import type { EncounterCompositionView } from "./encounter-composition";

export type UniversePatrolEncounterNotice = {
  actorId?: string;
  engageable?: boolean;
  callsign: string;
  faction: Faction;
  shipId?: ShipId;
  shipCount: number;
  distanceMeters: number;
  shield?: number;
  shieldMax?: number;
  hull?: number;
  hullMax?: number;
  source?: "server-snapshot";
};

export function UniversePatrolEncounterPrompt({
  contact,
  enabled,
  onEngage,
  notice,
  composition,
}: {
  contact: UniversePatrolEncounterNotice | null;
  composition?: EncounterCompositionView | null;
  notice?: string;
  enabled: boolean;
  onEngage?: () => void;
}) {
  if (!contact && !composition) return null;
  const inRange = contact ? contact.distanceMeters <= PATROL_INTERCEPT_RANGE_METERS : false;
  const ship = contact?.shipId ? SHIPS[contact.shipId] : null;
  const liveEngage = enabled && contact?.source === "server-snapshot" &&
    contact.engageable === true && Boolean(onEngage);
  return (
    <aside
      className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top,0px)+5.25rem)] z-30 max-w-[min(20rem,calc(100vw-1.5rem))] text-shadow"
      data-testid="panel-in-flight-patrol-contact"
      aria-label={contact ? "Nearest patrol designation" : "Fleet battle conclusion"}
      aria-live="polite"
    >
      {contact ? <div className="flex min-h-10 items-center gap-2 border border-bone/15 bg-void/65 px-2 py-1 backdrop-blur-sm">
        <span className="sr-only">{contact.source === "server-snapshot" ? "LIVE FLEET CONTACT" : "LOCAL PATROL CONTACT"}</span>
        <span className="relative h-2 w-2 shrink-0" aria-hidden="true">
          {liveEngage && inRange ? <span className="absolute inset-0 rounded-full bg-[#f0a95d]/60 motion-safe:animate-ping" /> : null}
          <span className="absolute inset-0 rounded-full bg-[#f0a95d] shadow-[0_0_9px_#f0a95d]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-hud text-[9px] tracking-[0.12em] text-bone">
            {contact.faction.toUpperCase()} · {ship?.name.toUpperCase() ?? contact.callsign}
          </p>
          <p className="truncate font-hud text-[8px] tracking-wide text-muted">
            {contact.callsign} · {contact.shipCount} SHIPS · {Math.round(contact.distanceMeters)}M
          </p>
        </div>
        {inRange && liveEngage ? (
          <button
            type="button"
            className="min-h-9 shrink-0 border border-[#f0a95d]/80 bg-[#080b12]/70 px-2.5 font-hud text-[9px] tracking-[0.14em] text-[#f0a95d]"
            data-testid="button-intercept-in-flight-patrol"
            aria-label="Engage patrol in server-authoritative free flight"
            onClick={onEngage}
          >
            ENGAGE
          </button>
        ) : null}
      </div> : null}
      {composition ? (
        <section
          className="mt-1 border border-bone/15 bg-void/80 px-2 py-1.5 backdrop-blur-sm"
          data-testid="panel-encounter-composition"
          aria-label="Live fleet encounter composition"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-hud text-[8px] tracking-[0.12em] text-solar">
              BATTLE ARC · {composition.beat}
            </p>
            <span className="shrink-0 font-hud text-[8px] text-bone/70">
              {composition.fleet.units.filter((unit) => unit.alive).length} CONTACTS
            </span>
          </div>
          <ol className="mt-1 flex items-center gap-1" aria-label="Encounter progress">
            {composition.steps.map((step) => (
              <li
                key={step.label}
                data-state={step.state}
                className={`flex-1 border-t pt-1 text-center font-hud text-[7px] tracking-[0.08em] ${
                  step.state === "current" ? "border-solar text-solar"
                    : step.state === "complete" ? "border-bone/45 text-bone/75"
                      : "border-bone/15 text-muted/70"
                }`}
              >{step.label}</li>
            ))}
          </ol>
          {composition.elements.length ? (
            <p className="mt-1 font-hud text-[8px] leading-snug tracking-wide text-bone/75">
              {composition.elements.join(" · ")}
            </p>
          ) : null}
          {composition.commandStatus !== "unreported" ? (
            <p className={`mt-1 font-hud text-[8px] tracking-wide ${
              composition.commandStatus === "normal" ? "text-muted" : "text-alert"
            }`}>
              COMMAND VESSEL · {composition.commandStatus === "normal" ? "INTEGRITY HOLDING"
                : composition.commandStatus === "damaged" ? "DAMAGED" : "LOST"}
            </p>
          ) : null}
          <p className="sr-only">
            {composition.incomingWeapons} hostile missiles currently tracked toward this pilot.
            {composition.additionalFleetCount} additional hostile fleet contacts are in nearby sensor range.
          </p>
        </section>
      ) : null}
      {notice ? <p role="status" data-testid="status-patrol-request"
        className="mt-1 bg-void/65 px-2 py-1 font-hud text-[9px] text-bone/80">{notice}</p> : null}
      {contact && inRange && !liveEngage && contact.source === "server-snapshot" ? (
        <p className="mt-1 bg-void/65 px-2 py-1 font-hud text-[9px] tracking-widest text-muted" data-testid="status-patrol-engagement-unavailable">
          SHARED COMBAT LINK UNAVAILABLE
        </p>
      ) : null}
    </aside>
  );
}
