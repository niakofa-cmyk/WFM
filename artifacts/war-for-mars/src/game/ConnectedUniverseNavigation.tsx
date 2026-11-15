import { useEffect, useMemo, useState } from "react";
import { OrbitalChart } from "./OrbitalChart";
import type { NavigationDestination, NavigationOperation } from "./orbital-navigation";
import "./orbital-universe.css";
import "./connected-universe.css";

type Props = {
  destinations: NavigationDestination[];
  currentLocationId: string;
  directoryState: "loading" | "available" | "unavailable";
  stale: boolean;
  busy: boolean;
  onTravel: (id: string) => void;
  onOpenOperation: (operationId: string) => void;
  onOpenDestination: () => void;
  onRefresh: () => void;
};

const cr = (n: number) => `${n.toLocaleString()} CR`;

function operationStatus(op: NavigationOperation): { tone: string; text: string } {
  if (op.access === "local-training") {
    return op.publicSessions > 0
      ? { tone: "solo", text: `${op.publicSessions} LISTED SOLO SESSION${op.publicSessions === 1 ? "" : "S"} · NOT MULTIPLAYER` }
      : { tone: "catalog", text: "CATALOG ONLY · LOCAL TRAINING" };
  }
  if (op.publicSessions === 0) return { tone: "catalog", text: "CATALOG ONLY · NO PUBLIC SESSION" };
  return {
    tone: "live",
    text: `${op.publicSessions} PUBLIC SESSION${op.publicSessions === 1 ? "" : "S"} · ${op.activePlayers} PILOT${op.activePlayers === 1 ? "" : "S"}`,
  };
}

export function ConnectedUniverseNavigation({
  destinations, currentLocationId, directoryState, stale, busy,
  onTravel, onOpenOperation, onOpenDestination, onRefresh,
}: Props) {
  const [selectedId, setSelectedId] = useState(currentLocationId);
  const [confirmation, setConfirmation] = useState<{ destinationId: string; origin: string; cost: number | null } | null>(null);
  const idKey = destinations.map((d) => d.id).join("|");

  // Follow confirmed location changes; keep user selection across polling refreshes.
  useEffect(() => { setSelectedId(currentLocationId); }, [currentLocationId]);
  useEffect(() => {
    setSelectedId((prev) => (idKey.split("|").includes(prev) ? prev : currentLocationId));
  }, [idKey, currentLocationId]);

  const selected = useMemo(() => destinations.find((d) => d.id === selectedId), [destinations, selectedId]);
  const current = destinations.find((d) => d.id === currentLocationId);
  const cost = selected?.cost ?? null;
  const canTravel = Boolean(selected?.canTravel);

  useEffect(() => { setConfirmation(null); }, [selectedId, currentLocationId, cost, canTravel, stale, busy]);

  const actionsLocked = stale || busy;
  const travelEnabled = Boolean(selected) && canTravel && !actionsLocked;
  const isCurrent = selected?.status === "current";
  const confirming = confirmation?.destinationId === selectedId &&
    confirmation.origin === currentLocationId && confirmation.cost === cost;

  return (
    <section className="uv uv-connected" data-testid="panel-connected-navigation" aria-labelledby="uvc-title">
      <div className="uv-grain" aria-hidden="true" />
      <header className="uv-top">
        <div>
          <p className="uv-eyebrow">ORBITAL CHART / SERVER-AUTHORIZED ROUTES</p>
          <h2 id="uvc-title" className="uv-title">NAVIGATION<span>ROUTE TRAVEL, NOT FREE FLIGHT</span></h2>
        </div>
        <div className="uvc-fix" data-testid="text-current-location">
          <small>CONFIRMED POSITION</small>
          <b>{current?.name ?? "Position unconfirmed"}</b>
        </div>
      </header>

      {stale ? (
        <p role="status" className="uvc-banner uvc-banner--stale" data-testid="status-navigation-stale">
          SNAPSHOT NOT LIVE. You can inspect the chart, but every action is disabled until the server confirms state.
        </p>
      ) : busy ? (
        <p role="status" className="uvc-banner" data-testid="status-navigation-busy">Awaiting server confirmation. Actions paused.</p>
      ) : null}

      <div className="uv-grid uvc-grid">
        <div className="uv-map">
          {destinations.length ? (
            <OrbitalChart destinations={destinations} selected={selectedId} onSelect={setSelectedId} />
          ) : (
            <p className="uvc-empty" data-testid="status-no-destinations">No destinations reported by the server.</p>
          )}
          <p className="uv-map__hint">SELECTING A MARKER NEVER MOVES YOUR SHIP. TRAVEL IS A SERVER-APPROVED ROUTE JUMP.</p>
        </div>

        {selected ? (
          <article key={selected.id} className="uv-brief uvc-brief" data-testid={`panel-destination-${selected.id}`} aria-live="polite">
            <span className={`uvc-tag uvc-tag--${selected.status}`} data-testid="status-selected-destination">{selected.label}</span>
            <h3 className="uv-dest" data-testid="text-selected-destination">{selected.name}</h3>
            <p className="uv-kind">{selected.kind}</p>
            <p className="uv-copy">{selected.description}</p>
            {selected.services.length ? (
              <ul className="uv-detail" aria-label="Services">
                {selected.services.map((s) => <li key={s}>{s.toUpperCase()}</li>)}
              </ul>
            ) : <p className="uvc-muted">No services listed.</p>}

            <div className="uvc-route">
              <div className="uvc-route__row">
                <span>ROUTE FARE</span>
                <b data-testid="text-route-cost">{isCurrent ? "HERE" : cost === null ? "NO ROUTE" : cr(cost)}</b>
              </div>
              <p className="uvc-muted" data-testid="text-destination-reason">{selected.reason}</p>
            </div>

            {isCurrent ? (
              <button type="button" className="uv-launch uv-launch--approach" data-testid="button-open-destination"
                disabled={actionsLocked || !selected.canOpen} onClick={onOpenDestination}>OPEN DESTINATION CONTROLS</button>
            ) : confirming && travelEnabled ? (
              <div className="uvc-confirm" role="alertdialog" aria-labelledby="uvc-confirm-t" data-testid="dialog-confirm-travel">
                <p id="uvc-confirm-t"><b>Confirm route to {selected.name}?</b></p>
                <p className="uvc-muted">
                  The server charges {cost === null ? "the route fare" : cr(cost)} and changes your saved location. Current-location controls will close.
                </p>
                <div className="uvc-confirm__row">
                  <button type="button" className="uvc-btn" data-testid="button-cancel-travel" autoFocus onClick={() => setConfirmation(null)}>CANCEL</button>
                  <button type="button" className="uvc-btn uvc-btn--go" data-testid="button-confirm-travel"
                    onClick={() => {
                      if (!confirming || !travelEnabled) return;
                      setConfirmation(null);
                      onTravel(selected.id);
                    }}>CONFIRM TRAVEL</button>
                </div>
              </div>
            ) : (
              <button type="button" className="uv-launch" data-testid="button-request-travel"
                disabled={!travelEnabled} onClick={() => setConfirmation({ destinationId: selectedId, origin: currentLocationId, cost })}>
                {canTravel ? `PLOT ROUTE · ${cost === null ? "" : cr(cost)}` : "TRAVEL UNAVAILABLE"}
              </button>
            )}

            <div className="uvc-ops" aria-labelledby="uvc-ops-t">
              <div className="uvc-ops__head">
                <h4 id="uvc-ops-t">OPERATIONS HERE</h4>
                {directoryState !== "loading" ? (
                  <button type="button" className="uvc-link" data-testid="button-refresh-directory" onClick={onRefresh}>REFRESH</button>
                ) : null}
              </div>
              {directoryState === "loading" ? (
                <div role="status" aria-label="Loading operation directory" className="uvc-skel" data-testid="status-directory-loading"><i /><i /></div>
              ) : directoryState === "unavailable" ? (
                <p role="alert" className="uvc-alert" data-testid="status-directory-unavailable">
                  DIRECTORY UNAVAILABLE. Operation activity cannot be confirmed; this is not an empty sector.
                </p>
              ) : selected.status === "locked" ? (
                <p className="uvc-muted">Locked destination. Operations are not disclosed.</p>
              ) : selected.operations.length === 0 ? (
                <p className="uvc-muted" data-testid="status-no-operations">No public operations listed at this destination.</p>
              ) : (
                <ul className="uvc-oplist">
                  {selected.operations.map((op) => {
                    const st = operationStatus(op);
                    const enabled = selected.canOpen && !stale && !busy;
                    return (
                      <li key={op.id} className="uvc-op" data-testid={`row-nav-operation-${op.id}`}>
                        <div>
                          <b>{op.title}</b>
                          <small>{op.experience.toUpperCase()} · {op.runtimeId.toUpperCase()} · {op.access.toUpperCase()}</small>
                          <span className={`uvc-op__st uvc-op__st--${st.tone}`} data-testid={`status-nav-operation-${op.id}`}>{st.text}</span>
                        </div>
                        <button type="button" className="uvc-btn" disabled={!enabled}
                          data-testid={`button-open-operation-${op.id}`} onClick={() => onOpenOperation(op.id)}
                          aria-label={`Show controls for ${op.title}`}>CONTROLS</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="uvc-fine">Opening controls only scrolls to the existing entry panel. Seats are assigned by the server.</p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
