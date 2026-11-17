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
  onIntercept,
}: {
  contact: UniversePatrolEncounterNotice | null;
  enabled: boolean;
  onEngage?: () => void;
  onIntercept?: () => void;
}) {
  if (!contact) return null;
  const inRange = contact.distanceMeters <= PATROL_INTERCEPT_RANGE_METERS;
  const ship = contact.shipId ? SHIPS[contact.shipId] : null;
  const hasIntegrity = contact.source === "server-snapshot" &&
    Number.isFinite(contact.shield) && Number.isFinite(contact.shieldMax) &&
    Number.isFinite(contact.hull) && Number.isFinite(contact.hullMax);
  const liveEngage = contact.source === "server-snapshot" &&
    contact.engageable === true && Boolean(onEngage);
  return (
    <aside
      className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+5.25rem)] z-30 w-[min(17rem,calc(100vw-1.5rem))] border border-[#f0a95d]/65 bg-[#080b12]/95 p-3 shadow-xl"
      data-testid="panel-in-flight-patrol-contact"
      aria-live="polite"
    >
      <p className="font-hud text-[9px] tracking-[0.2em] text-[#f0a95d]">
        {contact.source === "server-snapshot" ? "LIVE FLEET CONTACT" : "PATROL CONTACT"}
      </p>
      <p className="mt-1 font-hud text-sm tracking-widest text-bone">
        {contact.faction.toUpperCase()} · {ship?.name.toUpperCase() ?? contact.callsign}
      </p>
      <p className="mt-1 text-[10px] tracking-wide text-muted">
        {contact.callsign} · {contact.shipCount} SHIPS · {Math.round(contact.distanceMeters)}M
      </p>
      {hasIntegrity ? (
        <div className="mt-2 grid gap-1 border-t border-white/10 pt-2" data-testid="patrol-integrity-from-server">
          <IntegrityBar label="SHD" value={contact.shield!} maximum={contact.shieldMax!} />
          <IntegrityBar label="HULL" value={contact.hull!} maximum={contact.hullMax!} />
          <p className="mt-1 text-[8px] tracking-[0.14em] text-muted">DAMAGE STATE · SERVER REPORTED</p>
        </div>
      ) : null}
      {inRange ? liveEngage || enabled && contact.source !== "server-snapshot" ? (
        <button
          type="button"
          className="mt-3 min-h-10 w-full border border-[#f0a95d] bg-[#f0a95d] px-3 font-hud text-[10px] tracking-[0.16em] text-[#101116]"
          data-testid="button-intercept-in-flight-patrol"
          onClick={liveEngage ? onEngage : onIntercept}
        >
          {liveEngage ? "ENGAGE IN FREE FLIGHT" : "REQUEST PATROL INTERCEPT"}
        </button>
      ) : contact.source === "server-snapshot" ? (
        <p className="mt-3 border border-bone/15 px-2 py-2 text-[10px] text-muted" data-testid="status-patrol-engagement-unavailable">
          PERSISTENT PATROL RESERVATION UNAVAILABLE
        </p>
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
