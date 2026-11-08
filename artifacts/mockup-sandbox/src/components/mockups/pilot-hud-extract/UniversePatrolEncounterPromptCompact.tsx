import React from "react";
import { SHIPS, type Faction, type ShipId } from "./ships";
import { PATROL_INTERCEPT_RANGE_METERS } from "./universe-patrol-flight";

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

function IntegrityBar({ label, value, maximum }: {
  label: "SHD" | "HULL";
  value: number;
  maximum: number;
}) {
  const percent = maximum > 0 ? Math.max(0, Math.min(100, Math.round(value / maximum * 100))) : 0;
  return (
    <div className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 font-hud text-[9px] tracking-widest">
      <span className="text-bone/70">{label}</span>
      <span className="h-1 overflow-hidden bg-white/15" aria-hidden="true">
        <span className="block h-full bg-[#f0a95d]" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-right text-bone/85">{percent}%</span>
    </div>
  );
}

export function UniversePatrolEncounterPrompt({
  contact,
  enabled,
  onEngage,
}: {
  contact: UniversePatrolEncounterNotice | null;
  enabled: boolean;
  onEngage?: () => void;
}) {
  if (!contact) return null;
  const inRange = contact.distanceMeters <= PATROL_INTERCEPT_RANGE_METERS;
  const ship = contact.shipId ? SHIPS[contact.shipId] : null;
  const hasIntegrity = contact.source === "server-snapshot" &&
    Number.isFinite(contact.shield) && Number.isFinite(contact.shieldMax) &&
    Number.isFinite(contact.hull) && Number.isFinite(contact.hullMax);
  const liveEngage = contact.source === "server-snapshot" &&
    enabled && contact.engageable === true && Boolean(onEngage);
  return (
    <aside
      className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+5.25rem)] z-30 max-w-[min(20rem,calc(100vw-1.5rem))] py-1 text-shadow"
      data-testid="panel-in-flight-patrol-contact"
      aria-label="Nearest patrol designation"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#f0a95d] shadow-[0_0_9px_#f0a95d]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-hud text-[9px] tracking-[0.2em] text-[#f0a95d]">
            {contact.source === "server-snapshot" ? "LIVE FLEET CONTACT" : "LOCAL PATROL CONTACT"}
          </p>
          <p className="truncate font-hud text-sm tracking-widest text-bone">
            {contact.faction.toUpperCase()} · {ship?.name.toUpperCase() ?? contact.callsign}
          </p>
          <p className="truncate text-[10px] tracking-wide text-muted">
            {contact.callsign} · {contact.shipCount} SHIPS · {Math.round(contact.distanceMeters)}M
          </p>
        </div>
        {inRange && liveEngage ? (
          <button
            type="button"
            className="min-h-9 shrink-0 border border-[#f0a95d]/80 bg-[#080b12]/70 px-3 font-hud text-[10px] tracking-[0.16em] text-[#f0a95d]"
            data-testid="button-intercept-in-flight-patrol"
            aria-label="Engage patrol in server-authoritative free flight"
            onClick={onEngage}
          >
            ENGAGE
          </button>
        ) : null}
      </div>
      {hasIntegrity && inRange ? (
        <div className="mt-1 grid max-w-56 gap-1 pl-4" data-testid="patrol-integrity-from-server">
          <IntegrityBar label="SHD" value={contact.shield!} maximum={contact.shieldMax!} />
          <IntegrityBar label="HULL" value={contact.hull!} maximum={contact.hullMax!} />
        </div>
      ) : null}
      {inRange && !liveEngage ? (
        <p className="mt-1 pl-4 font-hud text-[9px] tracking-widest text-muted" data-testid="status-patrol-engagement-unavailable">
          {contact.source === "server-snapshot" ? "SHARED COMBAT LINK UNAVAILABLE" : "LOCAL PREVIEW · NO SERVER COMBAT"}
        </p>
      ) : null}
    </aside>
  );
}
