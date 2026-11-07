import React from "react";
import type { WorldPatrolDirectory, WorldLocation } from "@workspace/api-client-react";

const OBJECTIVE_LABELS: Record<string, string> = {
  recon: "Recon patrol",
  "route-security": "Route security",
  escort: "Escort duty",
  "supply-screen": "Supply screen",
};

type Props = {
  directory?: WorldPatrolDirectory;
  currentLocationId: string;
  currentLocationName?: string;
  locations: Pick<WorldLocation, "id" | "name">[];
  loading: boolean;
  unavailable: boolean;
  onRetry: () => void;
};

export function UniversePatrolPanel({
  directory,
  currentLocationId,
  currentLocationName,
  locations,
  loading,
  unavailable,
  onRetry,
}: Props) {
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const currentSnapshot = directory?.currentLocationId === currentLocationId;

  return (
    <section data-testid="panel-universe-patrols" className="mt-5 border border-spectral/35 bg-panel/75">
      <header className="border-b border-bone/10 px-4 py-4">
        <p className="font-hud text-[10px] tracking-[0.2em] text-spectral">
          UNIVERSE SIMULATION / STRATEGIC AI CONTACTS
        </p>
        <h2 className="mt-1 font-hud text-xl sm:text-2xl">
          Patrol formations · {currentLocationName ?? "Current sector"}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Persistent USSF and Accord patrols move between connected regions. These are server-owned AI fleets, not live human matches; this strategic view does not claim a nearby 3D encounter or award combat rewards.
        </p>
      </header>

      {loading && !directory ? (
        <p role="status" className="p-4 text-sm text-muted">Synchronizing patrol records…</p>
      ) : unavailable ? (
        <div className="p-4">
          <p role="alert" className="text-sm text-alert">
            Patrol sensors are unavailable. No fleet presence can be confirmed.
          </p>
          <button
            type="button"
            data-testid="button-retry-patrols"
            onClick={onRetry}
            className="mt-3 min-h-11 border border-bone/25 px-4 font-hud text-xs tracking-widest"
          >
            RETRY PATROL LINK
          </button>
        </div>
      ) : !directory || !currentSnapshot ? (
        <p role="status" className="p-4 text-sm text-muted">
          Reacquiring the server-confirmed patrol picture for this region…
        </p>
      ) : directory.patrols.length === 0 ? (
        <p data-testid="status-no-patrols" className="p-4 text-sm text-muted">
          No patrol formations are currently reported at this location. Nearby routes remain part of the strategic simulation.
        </p>
      ) : (
        <div className="divide-y divide-bone/10">
          {directory.patrols.map((patrol) => (
            <article key={patrol.id} data-testid={`card-patrol-${patrol.id}`} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className={`font-hud text-lg ${patrol.faction === "ussf" ? "text-spectral" : "text-solar"}`}>
                    {patrol.callsign}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {patrol.faction.toUpperCase()} · {OBJECTIVE_LABELS[patrol.objective] ?? "Patrol assignment"} · {patrol.ships.length} ships
                  </p>
                </div>
                <span className="border border-bone/20 px-2 py-1 font-hud text-[9px] tracking-widest text-muted">
                  STRATEGIC ROUTE
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Route: {patrol.route.map((locationId) => locationNames.get(locationId) ?? locationId).join(" → ")}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${patrol.callsign} ship formation`}>
                {patrol.ships.map((ship) => (
                  <li key={ship.id} className="border border-bone/15 bg-void/60 px-2 py-1 text-[10px] text-bone/80">
                    {ship.name} <span className="text-muted">· {ship.callsign}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          <p className="px-4 py-3 text-[10px] tracking-wide text-muted">
            Route positions advance in the persistent strategic layer. Encounter detection, 3D flight combat, kill attribution, and settlement remain separate server-authoritative systems.
          </p>
        </div>
      )}
    </section>
  );
}
