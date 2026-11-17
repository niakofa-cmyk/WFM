import React from "react";
import type { WorldPatrolDirectory, WorldLocation } from "@workspace/api-client-react";
import type { Faction, ShipId } from "./ships";
import { OrbitalUniverseTrafficScene } from "./OrbitalUniverseTrafficScene";

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
  nearbyPilotCount?: number;
  pilotFaction: Faction;
  shipId: ShipId;
  canLaunchEncounter: boolean;
  locations: Pick<WorldLocation, "id" | "name">[];
  loading: boolean;
  unavailable: boolean;
  onRetry: () => void;
};

export function UniversePatrolPanel({
  directory,
  currentLocationId,
  currentLocationName,
  nearbyPilotCount = 0,
  pilotFaction,
  shipId,
  canLaunchEncounter,
  locations,
  loading,
  unavailable,
  onRetry,
}: Props) {
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const currentSnapshot = directory?.currentLocationId === currentLocationId;
  const launchablePatrolId = directory?.patrols
    .filter((patrol) => patrol.faction !== pilotFaction && patrol.ships.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id))[0]?.id;

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
          Persistent USSF and Accord AI patrols—not live human matches—move between connected regions. Intercept the opposing faction for a server-authoritative Orbital flight encounter. Credits and shared fleet losses settle only from verified combat results.
        </p>
      </header>

      {directory && currentSnapshot ? (
        <OrbitalUniverseTrafficScene
          traffic={directory.traffic}
          nearbyPilotCount={nearbyPilotCount}
        />
      ) : null}

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
                  {patrol.faction === pilotFaction ? "FRIENDLY ROUTE" : "OPPOSING CONTACT"}
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
              {patrol.id === launchablePatrolId ? (
                canLaunchEncounter ? (
                  <a
                    href={`/expedition?mission=universe-patrol&ship=${encodeURIComponent(shipId)}`}
                    data-testid="button-intercept-universe-patrol"
                    className="mt-4 inline-flex min-h-11 items-center justify-center border border-solar bg-solar px-4 font-hud text-[10px] tracking-widest text-void"
                  >
                    INTERCEPT PATROL IN ORBITAL FLIGHT
                  </a>
                ) : (
                  <p className="mt-4 text-[10px] tracking-wide text-muted">
                    Orbital multiplayer flight is unavailable in this client configuration.
                  </p>
                )
              ) : null}
            </article>
          ))}
          <p className="px-4 py-3 text-[10px] tracking-wide text-muted">
            Route positions persist in the strategic layer. The intercept link resolves the opposing roster and current region on the server; it does not accept a client-selected target or location.
          </p>
        </div>
      )}
    </section>
  );
}
