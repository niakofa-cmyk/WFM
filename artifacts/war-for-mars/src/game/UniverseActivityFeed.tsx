import type { OperationDirectoryResponse, WorldLocation } from "@workspace/api-client-react";
import type { OperationEventLinkState } from "./world-operation-events";

type ActivityLocation = {
  id: string;
  name: string;
  activePilots: number;
  isCurrent: boolean;
};

type ActivityEvent = {
  id: string;
  title: string;
  locationName: string;
  runtimeId: string;
  experience: string;
  currentPlayers: number;
  capacity: number;
  isCurrent: boolean;
};

export function buildUniverseActivityView(
  directory: OperationDirectoryResponse | undefined,
  locations: WorldLocation[],
  currentLocationId: string,
): { locations: ActivityLocation[]; events: ActivityEvent[] } {
  if (!directory) return { locations: [], events: [] };

  const accessibleWorldLocations = new Map(
    locations.filter((location) => location.unlocked).map((location) => [location.id, location]),
  );
  const operationSites = new Map(directory.locations.map((location) => [location.id, location]));
  const operationInstances = new Map(directory.instances.map((instance) => [instance.id, instance]));
  const operations = new Map(directory.operations.map((operation) => [operation.id, operation]));

  const visiblePresence = (directory.presence ?? []).flatMap((entry) => {
    const location = accessibleWorldLocations.get(entry.locationId);
    if (!location || entry.activePilots <= 0) return [];
    return [{
      id: location.id,
      name: location.name,
      activePilots: entry.activePilots,
      isCurrent: location.id === currentLocationId,
    }];
  }).sort((left, right) =>
    Number(right.isCurrent) - Number(left.isCurrent) ||
    right.activePilots - left.activePilots ||
    left.name.localeCompare(right.name),
  );

  const events = directory.events.flatMap((event) => {
    if (event.status !== "active" || !event.operationInstanceId) return [];
    const instance = operationInstances.get(event.operationInstanceId);
    const operation = instance ? operations.get(instance.operationId) : undefined;
    const operationSite = operationSites.get(event.locationId);
    const worldLocation = operationSite
      ? accessibleWorldLocations.get(operationSite.worldLocationId)
      : undefined;
    if (!instance || !operation || !worldLocation) return [];
    return [{
      id: event.id,
      title: event.title,
      locationName: worldLocation.name,
      runtimeId: operation.runtimeId,
      experience: operation.experience,
      currentPlayers: instance.currentPlayers,
      capacity: instance.capacity,
      isCurrent: worldLocation.id === currentLocationId,
    }];
  }).sort((left, right) =>
    Number(right.isCurrent) - Number(left.isCurrent) ||
    left.locationName.localeCompare(right.locationName),
  );

  return { locations: visiblePresence, events };
}

type Props = {
  directory?: OperationDirectoryResponse;
  locations: WorldLocation[];
  currentLocationId: string;
  streamState: OperationEventLinkState;
  loading: boolean;
};

export function UniverseActivityFeed({
  directory,
  locations,
  currentLocationId,
  streamState,
  loading,
}: Props) {
  const activity = buildUniverseActivityView(directory, locations, currentLocationId);
  const presenceStatus = directory?.presenceStatus ?? "unavailable";

  return (
    <section data-testid="panel-universe-activity" className="mt-5 border border-spectral/35 bg-panel/75">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-bone/10 px-4 py-4">
        <div>
          <p className="font-hud text-[10px] tracking-[0.2em] text-spectral">PERSISTENT UNIVERSE / PUBLIC SIGNALS</p>
          <h2 className="mt-1 font-hud text-xl sm:text-2xl">Live destinations</h2>
        </div>
        <span
          data-testid="status-universe-event-stream"
          aria-live="polite"
          className={`font-hud text-[9px] tracking-widest ${streamState === "live" ? "text-green-300" : "text-muted"}`}
        >
          {streamState === "live" ? "EVENT STREAM LIVE" : streamState === "reconnecting" ? "RECONNECTING" : streamState === "unavailable" ? "EVENT STREAM OFFLINE" : "CONNECTING"}
        </span>
      </header>
      <p className="border-b border-bone/10 px-4 py-3 text-xs leading-relaxed text-muted">
        Destinations and activity are shared across the universe; each listed operation keeps its own combat runtime and authority.
      </p>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <h3 className="font-hud text-[10px] tracking-[0.18em] text-bone/80">PILOTS BY DESTINATION</h3>
          {presenceStatus === "unavailable" ? (
            <p role="status" data-testid="status-universe-presence-unavailable" className="mt-3 border-l border-alert/60 pl-3 text-xs leading-relaxed text-alert">
              Destination presence is unavailable on this server. Its database migration may still need to be applied.
            </p>
          ) : loading && !directory ? (
            <p role="status" className="mt-3 text-xs text-muted">Loading destination signals…</p>
          ) : activity.locations.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {activity.locations.map((location) => (
                <li key={location.id} data-testid={`row-universe-presence-${location.id}`} className="flex items-center justify-between gap-3 border border-bone/10 px-3 py-2">
                  <span className="text-xs text-bone">{location.name}{location.isCurrent ? " · YOUR LOCATION" : ""}</span>
                  <span className="font-hud text-[10px] tracking-widest text-solar">{location.activePilots} PILOT{location.activePilots === 1 ? "" : "S"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted">No active destination presence has been reported. Counts are anonymous and expire automatically.</p>
          )}
        </div>
        <div>
          <h3 className="font-hud text-[10px] tracking-[0.18em] text-bone/80">LIVE PUBLIC OPERATIONS</h3>
          {loading && !directory ? (
            <p role="status" className="mt-3 text-xs text-muted">Querying live operation events…</p>
          ) : activity.events.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {activity.events.map((event) => (
                <li key={event.id} data-testid={`row-universe-event-${event.id}`} className="border border-solar/20 px-3 py-3">
                  <p className="font-hud text-xs text-solar">{event.title}</p>
                  <p className="mt-1 text-[10px] tracking-wide text-bone/75">{event.locationName}{event.isCurrent ? " · HERE" : ""}</p>
                  <p className="mt-1 text-[10px] tracking-wide text-muted">{event.experience.toUpperCase()} · {event.runtimeId.toUpperCase()}</p>
                  <p className="mt-1 text-[10px] tracking-wide text-muted">
                    {event.experience === "flight-simulation"
                      ? "LOCAL FLIGHT SESSION · NO MULTIPLAYER SEATS"
                      : `${event.currentPlayers}/${event.capacity} PILOTS · USE THE DESTINATION HUB TO ENTER OR SPECTATE`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted">No public operation instances are active. No placeholder matches or pilot identities are shown.</p>
          )}
        </div>
      </div>
    </section>
  );
}
