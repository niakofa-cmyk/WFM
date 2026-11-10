import { useState } from "react";

export type FlightPresenceEntry = {
  actorId: string;
  callsign: string;
  faction: "ussf" | "accord";
  kind: "pilot" | "patrol";
  friendly: boolean;
  alive: boolean;
  distanceMeters: number;
};

type Props = {
  entries: FlightPresenceEntry[];
  connected: boolean;
  region: string;
  status: string;
};

function formatRange(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return "RANGE —";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} KM` : `${Math.round(meters)} M`;
}

export function FlightPresencePanel({ entries, connected, region, status }: Props) {
  const [open, setOpen] = useState(false);
  const sorted = connected ? [...entries].sort((a, b) => a.distanceMeters - b.distanceMeters) : [];
  const humans = sorted.filter((e) => e.kind === "pilot").length;
  const ai = sorted.length - humans;

  return (
    <div className="pointer-events-auto font-hud">
      <button
        type="button"
        data-testid="button-flight-presence"
        aria-expanded={open}
        aria-controls="flight-presence-panel"
        onClick={() => setOpen((v) => !v)}
        className="border border-solar/50 bg-void/85 px-2 py-1 text-[10px] tracking-widest text-solar hover:bg-solar/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-solar"
      >
        NEARBY PILOTS {connected ? `· ${humans}H ${ai}AI` : "· —"} {open ? "▴" : "▾"}
      </button>
      {open ? (
        <section
          id="flight-presence-panel"
          data-testid="panel-flight-presence"
          aria-label="Nearby pilots"
          className="mt-1 w-[min(18rem,80vw)] border border-bone/15 bg-void/90 text-bone"
        >
          <header className="border-b border-bone/10 px-2 py-1.5">
            <p className="text-[9px] tracking-[0.18em] text-spectral">{connected ? "SERVER-CONFIRMED NEARBY" : "PRESENCE UNCONFIRMED"} · {region.toUpperCase()}</p>
            <p data-testid="status-flight-presence" role="status" aria-live="polite" className="mt-0.5 text-[9px] tracking-wide text-muted">
              {status}
            </p>
          </header>
          {!connected ? (
            <p data-testid="text-flight-presence-unconfirmed" className="px-2 py-2 text-[10px] leading-snug text-alert">
              Live nearby contacts cannot be confirmed; no earlier roster is shown.
            </p>
          ) : sorted.length === 0 ? (
            <p data-testid="text-flight-presence-empty" className="px-2 py-2 text-[10px] leading-snug text-muted">
              No contacts confirmed near you in this region. Pilots elsewhere are not listed.
            </p>
          ) : (
            <ul className="max-h-[40dvh] overflow-y-auto">
              {sorted.map((e) => (
                <li
                  key={e.actorId}
                  data-testid={`row-flight-presence-${e.actorId}`}
                  className={`flex items-center justify-between gap-2 border-b border-bone/5 px-2 py-1 text-[10px] ${e.alive ? "" : "opacity-50"}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`shrink-0 border px-1 text-[8px] tracking-widest ${e.kind === "pilot" ? "border-solar/60 text-solar" : "border-bone/30 text-bone/70"}`}
                    >
                      {e.kind === "pilot" ? "HUMAN" : "AI"}
                    </span>
                    <span className="truncate">{e.callsign}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[9px] tracking-wide">
                    <span className={e.friendly ? "text-green-300" : "text-alert"}>
                      {e.friendly ? "FRIENDLY" : "HOSTILE"} · {e.faction.toUpperCase()}
                    </span>
                    <span className="text-muted">{e.alive ? formatRange(e.distanceMeters) : "DISABLED"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
           <p className="px-2 py-1 text-[8px] tracking-wide text-muted">Other contacts near you · excludes your ship · not a global roster</p>
        </section>
      ) : null}
    </div>
  );
}
