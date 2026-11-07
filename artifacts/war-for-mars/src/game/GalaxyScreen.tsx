import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { getGetWorldOperationsQueryKey, getGetWorldPatrolsQueryKey, getGetWorldQueryKey, useGetWorld, useGetWorldOperations, useGetWorldPatrols, useRegisterWorldOperationInstance } from "@workspace/api-client-react";
import { heartbeatWorldPresence } from "@workspace/api-client-react";
import type { OperationDirectoryResponse, WorldLocation, WorldQuest } from "@workspace/api-client-react";
import type { Faction, ShipId } from "./ships";
import { useDurableAction, useOfflineSnapshot } from "./useDurableAction";
import { UniverseActivities, repLabel } from "./UniverseActivities";
import { CommandBackdrop, FactionMark } from "./CommandArt";
import { Link, useLocation } from "wouter";
import { sectorMission } from "./sector-missions";
import { CINDER_ASTEROID_OPERATION_ID, nextStorySectorMission } from "./sector-navigation";
import { expeditionFeatureEnabled, sectorClientProtocolVersion } from "./sector-client";
import { SECTOR_ORBITAL_PROTOCOL_VERSION } from "./sector-missions";
import { AsteroidArenaHub } from "./AsteroidArenaHub";
import { useWorldOperationEvents } from "./world-operation-events";
import { CinderRingArtwork } from "./CinderRingArtwork";
import { cinderRingEntrySurface, type CinderRingDockingPhase } from "./cinder-ring-entry";
import { UniverseActivityFeed } from "./UniverseActivityFeed";
import { ConnectedUniverseNavigation } from "./ConnectedUniverseNavigation";
import { connectedDestinations, operationControlTarget } from "./orbital-navigation";
import { UniversePatrolPanel } from "./UniversePatrolPanel";

const MarketPanel = lazy(() => import("./MarketPanel").then((module) => ({ default: module.MarketPanel })));
const CinderRingDockingApproach = lazy(() =>
  import("./CinderRingDockingApproach").then((module) => ({ default: module.CinderRingDockingApproach })),
);
const CINDER_RING_LOCATION_ID = "cinder-asteroid";

type Props = {
  onBack: () => void;
  credits: number;
  onCredits: (credits: number) => void;
  shipId: ShipId;
  faction: Faction;
  roomCode: string;
  onRoomCode: (roomCode: string) => void;
  onCreatePrivateRoom: () => void;
  onJoinPrivateRoom: (roomCode: string) => void;
  onlineStatus?: string;
  onJoinCompetitiveQueue: () => void;
  competitiveQueueAvailable: boolean;
  competitiveQueueing: boolean;
  presenceHeartbeat?: boolean;
};

const kindLabel: Record<string, string> = { station: "STATION", relay: "RELAY", moon: "MOON", ruins: "RUINS", asteroid: "ASTEROID" };
const statusLabel: Record<string, string> = {
  locked: "LOCKED", available: "AVAILABLE", accepted: "IN PROGRESS", ready: "READY TO CLAIM", claimed: "CLAIMED",
};
const money = (value: number) => `${value.toLocaleString()} CR`;
const errorText = (error: unknown) =>
  `${error instanceof Error ? error.message : "No response."} Outcome unknown: the server may or may not have applied this action. Retry the retained request to find out.`;
const showSectorExpedition = expeditionFeatureEnabled({
  DEV: import.meta.env.DEV,
  VITE_WFM_SECTOR_EXPEDITION_ENABLED: import.meta.env.VITE_WFM_SECTOR_EXPEDITION_ENABLED,
});

export function GalaxyScreen({
  onBack,
  credits,
  onCredits,
  shipId,
  faction,
  roomCode,
  onRoomCode,
  onCreatePrivateRoom,
  onJoinPrivateRoom,
  onlineStatus,
  onJoinCompetitiveQueue,
  competitiveQueueAvailable,
  competitiveQueueing,
  presenceHeartbeat = true,
}: Props) {
  const { getToken, userId } = useAuth();
  const [, setLocation] = useLocation();
  const [presenceActive, setPresenceActive] = useState(true);
  const canLaunchUniversePatrol =
    expeditionFeatureEnabled({
      DEV: import.meta.env.DEV,
      VITE_WFM_SECTOR_EXPEDITION_ENABLED: import.meta.env.VITE_WFM_SECTOR_EXPEDITION_ENABLED,
    }) &&
    sectorClientProtocolVersion({
      VITE_WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED: import.meta.env.VITE_WFM_SECTOR_ORBITAL_PROTOCOL_V2_ENABLED,
    }) === SECTOR_ORBITAL_PROTOCOL_VERSION;
  const operationStreamState = useWorldOperationEvents();
  const worldQuery = useGetWorld({ query: { refetchInterval: 15000, queryKey: getGetWorldQueryKey() } });
  const operationsQuery = useGetWorldOperations({
    query: {
      refetchInterval: operationStreamState === "live" ? 15000 : 30000,
      queryKey: getGetWorldOperationsQueryKey(),
    },
  });
  const registerOperation = useRegisterWorldOperationInstance();
  const snapshot = useOfflineSnapshot("world", worldQuery.data, worldQuery.isError || worldQuery.fetchStatus === "paused");
  const durable = useDurableAction();
  const [actionError, setActionError] = useState("");
  const [publishOperationStatus, setPublishOperationStatus] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [cinderDockingPhase, setCinderDockingPhase] = useState<CinderRingDockingPhase>("entry");
  const world = snapshot.data;
  const patrolsQuery = useGetWorldPatrols({
    query: {
      enabled: Boolean(userId && world && !snapshot.cached),
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
      queryKey: [...getGetWorldPatrolsQueryKey(), world?.currentLocation],
    },
  });
  useEffect(() => {
    if (!userId || !presenceActive || !presenceHeartbeat) return;
    let active = true;
    let inFlight = false;
    const sendHeartbeat = async () => {
      if (!active || document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        const token = await getToken();
        if (active && token) {
          await heartbeatWorldPresence({ headers: { Authorization: `Bearer ${token}` } });
        }
      } catch {
        // The directory exposes presence availability without blocking navigation.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void sendHeartbeat(), 20_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sendHeartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void sendHeartbeat();
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [getToken, presenceActive, presenceHeartbeat, userId]);
  useEffect(() => {
    if (world?.currentLocation !== CINDER_RING_LOCATION_ID) {
      setCinderDockingPhase("entry");
    }
  }, [world?.currentLocation]);
  const nextStoryMission = world ? nextStorySectorMission(world.discoveries) : null;
  const cached = snapshot.cached;
  const busy = durable.blocked;
  const go = async (request: Parameters<typeof durable.run>[0], label: string) => {
    setActionError("");
    try { await durable.run(request, label); } catch (error) { setActionError(errorText(error)); }
  };
  const enterOperation = async (operationId: string) => {
    setOperationError("");
    try {
      const response = await registerOperation.mutateAsync({
        operationId,
        data: {
          idempotencyKey: crypto.randomUUID(),
          visibility: publishOperationStatus ? "public" : "unlisted",
        },
      });
      const assignment = response.authorization.assignment;
      if (!response.authorization.allowed || !assignment) {
        throw new Error("The server did not authorize this operation seat.");
      }
      setPresenceActive(false);
      setLocation(`/flight?operation=${encodeURIComponent(operationId)}&instanceId=${encodeURIComponent(assignment.operationInstanceId)}`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Operation registration failed. No flight was started.");
    }
  };
  const travelTo = (destinationId: string) => go({ kind: "travel", data: { destinationId, maxCost: world?.routes.find((route) => route.destinationId === destinationId)?.costCredits } }, `Travel to ${destinationId}.`);
  const exploreLocation = (location: WorldLocation) => go({ kind: "explore", data: { locationId: location.id } }, `Explore ${location.name}.`);
  const actQuest = (quest: WorldQuest, action: "accept" | "claim") => go({ kind: "quest", data: { questId: quest.id, action } }, `${action === "accept" ? "Accept" : "Claim"} contract ${quest.title}.`);
  const runService = (serviceId: string, locationId: string, title: string) => go({ kind: "service", data: { serviceId, locationId, cycleDate: world!.event.cycleDate.slice(0, 10), creditLimit: world!.activities.find((item) => item.id === serviceId)?.creditCost } }, `Station activity: ${title}.`);
  const travel = { isPending: durable.busy };
  const explore = travel;
  const questAction = travel;
  if (worldQuery.isLoading && !world) {
    return (
      <main className="min-h-dvh bg-void px-4 py-6 text-bone sm:px-8 sm:py-9">
        <div className="mx-auto max-w-6xl animate-pulse" role="status" aria-label="Loading theater state">
          <div className="h-3 w-52 bg-bone/10" />
          <div className="mt-4 h-12 w-80 max-w-full bg-bone/10" />
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="h-80 border border-bone/10 bg-panel" />
            <div className="h-80 border border-bone/10 bg-panel" />
          </div>
          <div className="mt-4 h-44 border border-bone/10 bg-panel" />
        </div>
      </main>
    );
  }

  if (!world) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-void px-5 text-center text-bone">
        <p className="font-hud text-sm tracking-[0.22em] text-alert">THEATER LINK UNAVAILABLE</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          Persistent location, route, and contract data could not be reached.
        </p>
        <button
          type="button"
          data-testid="button-retry-world"
          onClick={() => void worldQuery.refetch()}
          className="mt-5 h-11 border border-bone/30 px-5 font-hud tracking-widest text-bone"
        >
          RETRY LINK
        </button>
        <button
          type="button"
          data-testid="button-galaxy-back"
          onClick={onBack}
          className="mt-3 min-h-11 px-5 font-hud tracking-widest text-muted"
        >
          BACK TO HANGAR
        </button>
      </main>
    );
  }

  const locations = world.locations;
  const quests = world.quests;
  const currentLocation = locations.find((location) => location.id === world.currentLocation);
  const currentIsPhobosYard =
    currentLocation?.id.toLowerCase() === "phobos-yard" ||
    currentLocation?.name.trim().toLowerCase() === "phobos yard";
  const marketAvailable = Boolean(
    currentLocation?.services.some((service) => service.trim().toLowerCase() === "market"),
  );
  const routes = world.routes;
  const discovered = new Set(world.discoveries);
  const directoryUnavailable = operationsQuery.isError || operationsQuery.fetchStatus === "paused";
  const operationDirectory = directoryUnavailable ? undefined : operationsQuery.data as OperationDirectoryResponse | undefined;
  const atCinderRing = world.currentLocation === CINDER_RING_LOCATION_ID;
  const cinderSurface = cinderRingEntrySurface(atCinderRing, cinderDockingPhase);
  const navigationBlocked = cached || worldQuery.isError || worldQuery.fetchStatus === "paused" || busy;
  const navigationDestinations = connectedDestinations(world, operationDirectory, credits, navigationBlocked);
  const scrollToControls = (target: string) => {
    const element = Array.from(document.querySelectorAll<HTMLElement>("[data-testid]"))
      .find((entry) => entry.dataset.testid === target);
    if (!element) return;
    element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    element.setAttribute("tabindex", "-1");
    element.focus({ preventScroll: true });
  };
  const openDestination = () => {
    if (navigationBlocked) return;
    scrollToControls(atCinderRing && cinderSurface === "approach-entry"
      ? "panel-cinder-ring-approach-entry" : atCinderRing
        ? "screen-asteroid-arena-hub" : "panel-operation-network");
  };
  const openOperation = (operationId: string) => {
    const current = navigationDestinations.find((entry) => entry.id === world.currentLocation);
    const operation = current?.operations.find((entry) => entry.id === operationId);
    if (!current?.canOpen || !operation || directoryUnavailable) return;
    scrollToControls(operationControlTarget(operation.experience, operation.id, cinderSurface));
  };

  if (cinderSurface === "approach-flight") {
    return (
      <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-void px-4 text-bone" role="status">Initializing Cinder Ring approach systems…</main>}>
        <CinderRingDockingApproach
          shipId={shipId}
          faction={faction}
          onDock={() => setCinderDockingPhase("docked")}
          onAbort={() => setCinderDockingPhase("entry")}
        />
      </Suspense>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-void px-4 py-5 text-bone sm:px-8 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-[22rem]"><CommandBackdrop dense /></div>
      <div className="relative mx-auto max-w-6xl">
        {cached ? <p role="status" data-testid="status-world-cached" className="mb-3 border border-alert/50 bg-alert/10 px-3 py-2 font-hud text-xs tracking-widest text-bone">OFFLINE SNAPSHOT - NOT LIVE. Showing last known theater state; nothing is confirmed until the server acknowledges.</p> : null}
        {durable.pending || durable.error ? <p role="status" data-testid="status-world-pending" className="mb-3 border border-solar/40 px-3 py-2 text-xs text-bone">{durable.pending ? `Awaiting server confirmation: ${durable.pending.label}` : durable.error}</p> : null}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-solar/30 pb-5">
          <div>
            <p className="font-hud text-[10px] tracking-[0.24em] text-solar sm:text-xs">
              WAR FOR MARS / USSF–ACCORD THEATER
            </p>
            <h1 className="mt-2 font-hud text-4xl leading-none sm:text-6xl">ORBITAL UNIVERSE</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Move between verified routes, log discoveries, and fulfill persistent contracts.
            </p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <div className="border-l-2 border-solar pl-3">
              <p className="text-[9px] tracking-[0.18em] text-muted">PILOT LEDGER</p>
              <p data-testid="text-world-credits" className="font-hud text-xl text-solar">
                {money(credits)}
              </p>
            </div>
            <button
              type="button"
              data-testid="button-galaxy-back"
              onClick={onBack}
              className="min-h-11 border border-bone/30 bg-void/70 px-4 font-hud text-xs tracking-widest text-bone sm:text-sm"
            >
              BACK TO HANGAR
            </button>
          </div>
        </header>

        <ConnectedUniverseNavigation
          destinations={navigationDestinations}
          currentLocationId={world.currentLocation}
          directoryState={directoryUnavailable ? "unavailable" : operationDirectory ? "available" : "loading"}
          stale={cached || worldQuery.isError || worldQuery.fetchStatus === "paused"}
          busy={busy}
          onTravel={(id) => {
            if (navigationDestinations.find((entry) => entry.id === id)?.canTravel) void travelTo(id);
          }}
          onOpenOperation={openOperation}
          onOpenDestination={openDestination}
          onRefresh={() => { void worldQuery.refetch(); void operationsQuery.refetch(); }}
        />

        <section
          data-testid="panel-world-event"
          className="relative mt-5 overflow-hidden border border-solar/35 bg-panel p-4 sm:p-5"
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-solar" />
          <div className="flex flex-col justify-between gap-4 pl-2 sm:flex-row sm:items-start">
            <div>
              <p className="font-hud text-[10px] tracking-[0.2em] text-solar">
                LIVE THEATER EVENT / {new Date(world.event.cycleDate).toLocaleDateString()}
              </p>
              <h2 className="mt-1 font-hud text-2xl sm:text-3xl">{world.event.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
                {world.event.description}
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-x-5 border-t border-bone/10 pt-3 text-[10px] tracking-wide text-muted sm:block sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
              <p>BEGINS {new Date(world.event.startsAt).toLocaleString()}</p>
              <p className="sm:mt-1">ENDS {new Date(world.event.endsAt).toLocaleString()}</p>
            </div>
          </div>
        </section>

        <UniverseActivityFeed
          directory={operationDirectory}
          locations={locations}
          currentLocationId={world.currentLocation}
          streamState={operationStreamState}
          loading={operationsQuery.isLoading}
          unavailable={directoryUnavailable}
        />
        <UniversePatrolPanel
          directory={patrolsQuery.data}
          currentLocationId={world.currentLocation}
          currentLocationName={currentLocation?.name}
          nearbyPilotCount={operationDirectory?.presence?.find(
            (entry) => entry.locationId === world.currentLocation,
          )?.activePilots ?? 0}
          pilotFaction={faction}
          shipId={shipId}
          canLaunchEncounter={canLaunchUniversePatrol}
          locations={locations}
          loading={patrolsQuery.isLoading}
          unavailable={patrolsQuery.isError || patrolsQuery.fetchStatus === "paused"}
          onRetry={() => { void patrolsQuery.refetch(); }}
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <section className="border border-bone/15 bg-panel/65">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bone/10 px-4 py-4">
                <div>
                  <p className="font-hud text-xs tracking-[0.2em] text-solar">CURRENT POSITION</p>
                  <h2 className="mt-1 font-hud text-2xl">
                    {currentLocation?.name ?? "Position unconfirmed"}
                  </h2>
                </div>
                <div className="text-right text-[10px] tracking-widest text-muted">
                  <p>{currentLocation ? kindLabel[currentLocation.kind] ?? currentLocation.kind.toUpperCase() : "NO FIX"}</p>
                  {currentLocation ? (
                    <p className="mt-1 font-mono text-bone/70">
                      GRID {String(currentLocation.x).padStart(2, "0")} / {String(currentLocation.y).padStart(2, "0")}
                    </p>
                  ) : null}
                </div>
              </div>
              {currentLocation ? (
                <div className="p-4">
                  <p className="max-w-2xl text-sm leading-relaxed text-muted">{currentLocation.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="font-hud text-[10px] tracking-widest text-muted">STATION SERVICES</span>
                    {currentLocation.services.length > 0 ? currentLocation.services.map((service) => (
                      <span key={service} className="border border-bone/15 px-2 py-1 text-[10px] tracking-wider text-bone/80">
                        {service.toUpperCase()}
                      </span>
                    )) : <span className="text-xs text-muted">No services at this location.</span>}
                  </div>
                  {currentLocation.sector ? <p className="mt-3 font-hud text-[10px] tracking-widest text-solar">SECTOR / {currentLocation.sector.toUpperCase()}</p> : null}
                  {currentLocation.unlocked && !currentLocation.explored ? (
                    <button
                      type="button"
                      data-testid={`button-explore-${currentLocation.id}`}
                      disabled={busy}
                      onClick={() => void exploreLocation(currentLocation)}
                      className="mt-4 min-h-11 w-full border border-solar/50 font-hud text-xs tracking-widest text-solar disabled:opacity-40 sm:w-auto sm:px-5"
                    >
                      {explore.isPending ? "RECORDING DISCOVERY…" : "EXPLORE CURRENT LOCATION"}
                    </button>
                  ) : (
                    <p className="mt-4 font-hud text-[10px] tracking-widest text-solar">
                      {currentLocation.explored ? "DISCOVERY ALREADY RECORDED" : "LOCATION NOT AVAILABLE FOR EXPLORATION"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="p-4 text-sm text-muted">No matching location is currently reported by the theater signal.</p>
              )}
            </section>

            {cinderSurface === "approach-entry" ? (
              <section data-testid="panel-cinder-ring-approach-entry" className="grid gap-4 border border-solar/35 bg-panel/75 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,.9fr)] sm:items-center sm:p-6">
                <div>
                  <p className="font-hud text-xs tracking-[0.2em] text-solar">PHYSICAL DESTINATION / LOCAL TRANSIT</p>
                  <h2 className="mt-2 font-hud text-2xl sm:text-3xl">CINDER RING APPROACH</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                    Fly the capture corridor to the asteroid station. The approach is local and no-reward; docking opens the existing competitive and private-room operations hub.
                  </p>
                  <button
                    type="button"
                    data-testid="button-start-cinder-ring-approach"
                    onClick={() => setCinderDockingPhase("approach")}
                    className="mt-4 min-h-12 border border-solar/60 bg-solar/10 px-5 font-hud text-xs tracking-widest text-solar"
                  >
                    BEGIN FLIGHT APPROACH
                  </button>
                </div>
                <div className="overflow-hidden border border-bone/10 bg-void/60">
                  <CinderRingArtwork />
                </div>
              </section>
            ) : (
              <>
                {cinderSurface === "docked-hub" ? (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-spectral/30 bg-panel/70 px-4 py-3">
                    <p className="font-hud text-xs tracking-[0.18em] text-spectral">DOCKED AT CINDER RING · OPERATIONS HUB</p>
                    <button
                      type="button"
                      data-testid="button-undock-cinder-ring"
                      onClick={() => setCinderDockingPhase("entry")}
                      className="min-h-10 border border-bone/25 px-4 font-hud text-[10px] tracking-widest text-bone"
                    >
                      RETURN TO ORBIT
                    </button>
                  </div>
                ) : null}
                <AsteroidArenaHub
                  operations={operationDirectory}
                  directoryLoading={operationsQuery.isLoading}
                  directoryError={operationsQuery.isError}
                  atAsteroid={atCinderRing}
                  queueAvailable={competitiveQueueAvailable}
                  queueing={competitiveQueueing}
                  roomCode={roomCode}
                  onRoomCode={onRoomCode}
                  onCreatePrivateRoom={() => {
                    setPresenceActive(false);
                    onCreatePrivateRoom();
                  }}
                  onJoinPrivateRoom={(code) => {
                    setPresenceActive(false);
                    onJoinPrivateRoom(code);
                  }}
                  onlineStatus={onlineStatus}
                  onJoinQueue={() => {
                    setPresenceActive(false);
                    onJoinCompetitiveQueue();
                  }}
                  onTravel={() => travelTo(CINDER_RING_LOCATION_ID)}
                />
              </>
            )}

            <section data-testid="panel-operation-network" className="border border-spectral/35 bg-panel/75">
              <div className="border-b border-bone/10 px-4 py-4">
                <p className="flex flex-wrap items-center justify-between gap-2 font-hud text-xs tracking-[0.2em] text-spectral">
                  <span>ORBITAL OPERATIONS NETWORK</span>
                  <span
                    data-testid="status-operation-stream"
                    className={operationStreamState === "live" ? "text-green-300" : "text-muted"}
                    aria-live="polite"
                  >
                    {operationStreamState === "live"
                      ? "LIVE STATUS LINK"
                      : operationStreamState === "reconnecting"
                        ? "RECONNECTING"
                        : operationStreamState === "unavailable"
                          ? "STATUS LINK UNAVAILABLE"
                          : "CONNECTING"}
                  </span>
                </p>
                <h2 className="mt-1 font-hud text-2xl">Asteroid operations</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">One universe can host distinct operations and runtimes. The directory reports real server instances only; it never creates placeholder pilots or battles.</p>
              </div>
              {operationsQuery.isLoading && !operationDirectory ? (
                <p role="status" className="p-4 text-sm text-muted">Querying the public operation directory…</p>
              ) : operationsQuery.isError || !operationDirectory ? (
                <div className="p-4">
                  <p role="alert" className="text-sm text-alert">Operation directory unavailable. No live operation status can be confirmed.</p>
                  <button type="button" onClick={() => void operationsQuery.refetch()} className="mt-3 min-h-11 border border-bone/25 px-4 font-hud text-xs tracking-widest">RETRY DIRECTORY</button>
                </div>
              ) : operationDirectory.operations.length === 0 ? (
                <p className="p-4 text-sm text-muted">No operations are currently listed.</p>
              ) : (
                <div className="divide-y divide-bone/10">
                  {operationDirectory.operations.map((operation) => {
                    const site = operationDirectory.locations.find((location) => location.id === operation.locationId);
                    const siteState = site ? locations.find((location) => location.id === site.worldLocationId) : undefined;
                    const route = siteState ? routes.find((item) => item.destinationId === siteState.id) : undefined;
                    const atSite = siteState?.id === world.currentLocation;
                    const instances = operationDirectory.instances.filter((item) => item.operationId === operation.id);
                    return (
                      <article key={operation.id} data-testid={`card-operation-${operation.id}`} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-hud text-lg">{operation.title}</h3>
                            <p className="mt-1 text-xs text-spectral">{site?.name ?? "LOCATION SIGNAL UNAVAILABLE"} · {operation.runtimeId.toUpperCase()}</p>
                          </div>
                          <span className="border border-solar/35 px-2 py-1 font-hud text-[9px] tracking-widest text-solar">
                            {operation.access === "local-training" ? "LOCAL SPECIALIST MODE" : operation.access.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted">{operation.description}</p>
                        {instances.length === 0 ? (
                          <p data-testid={`status-no-live-${operation.id}`} className="mt-3 border-l border-bone/25 pl-2 text-xs text-muted">NO PUBLIC INSTANCE · No live multiplayer match or spectator feed is available.</p>
                        ) : operation.experience !== "flight-simulation" || operation.access !== "local-training" ? (
                          <div className="mt-3 space-y-1 text-xs text-solar" data-testid={`status-live-${operation.id}`}>
                            {instances.map((instance) => (
                              <p key={instance.id}>{instance.phase.toUpperCase()} · {instance.currentPlayers}/{instance.capacity} PILOTS</p>
                            ))}
                            <p className="text-muted">Anonymous status only. Room codes and pilot identities are never listed here.</p>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-1 text-xs text-solar">
                            <p>{instances.length} server-registered solo session{instances.length === 1 ? "" : "s"} listed</p>
                            <p className="text-muted">These are not multiplayer matches; occupied seats cannot be joined.</p>
                          </div>
                        )}
                        {operation.experience === "cooperative" && showSectorExpedition && atSite ? (
                          <Link href="/expedition?mission=rust-disc" data-testid={`link-coop-${operation.id}`}
                            onClick={() => setPresenceActive(false)}
                            className="mt-3 flex min-h-11 items-center justify-center bg-solar px-4 font-hud text-xs tracking-widest text-void">
                            OPEN RUST DISC CO-OP AT CINDER RING
                          </Link>
                        ) : operation.experience === "cooperative" && route ? (
                          <button type="button" data-testid={`button-route-${operation.id}`} disabled={!route.available || credits < route.costCredits || busy} onClick={() => void travelTo(route.destinationId)} className="mt-3 min-h-11 w-full border border-spectral/50 px-4 font-hud text-xs tracking-widest text-spectral disabled:opacity-40">
                            {route.available ? `TRAVEL TO ${site?.name.toUpperCase()} · ${money(route.costCredits)}` : "ROUTE UNAVAILABLE"}
                          </button>
                        ) : null}
                        {operation.access === "local-training" && atSite ? (
                          <div className="mt-3">
                            <label className="flex min-h-11 items-center gap-3 text-xs text-muted">
                              <input type="checkbox" checked={publishOperationStatus} onChange={(event) => setPublishOperationStatus(event.currentTarget.checked)} className="h-5 w-5 accent-[#79bfff]" />
                              Publish this anonymous solo-session status in the public operation directory
                            </label>
                            {operationError ? <p role="alert" className="mt-2 text-sm text-alert">{operationError}</p> : null}
                            <button type="button" data-testid={`button-enter-${operation.id}`} disabled={registerOperation.isPending} onClick={() => void enterOperation(operation.id)} className="mt-2 flex min-h-11 w-full items-center justify-center bg-solar px-4 font-hud text-xs tracking-widest text-void disabled:opacity-50">
                              {registerOperation.isPending ? "REGISTERING OPERATION…" : "ENTER ASTEROID FLIGHT CIRCUIT · NO REWARDS"}
                            </button>
                          </div>
                        ) : operation.access === "local-training" && route ? (
                          <button type="button" data-testid={`button-route-${operation.id}`} disabled={!route.available || credits < route.costCredits || busy} onClick={() => void travelTo(route.destinationId)} className="mt-3 min-h-11 w-full border border-spectral/50 px-4 font-hud text-xs tracking-widest text-spectral disabled:opacity-40">
                            {route.available ? `TRAVEL TO ${site?.name.toUpperCase()} · ${money(route.costCredits)}` : "ROUTE UNAVAILABLE"}
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <UniverseActivities world={world} blocked={busy} onRun={runService} />
            <section className="border border-bone/15 bg-panel/65">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bone/10 px-4 py-4">
                <div>
                  <p className="font-hud text-xs tracking-[0.2em] text-solar">AUTHORIZED MOVEMENT</p>
                  <h2 className="mt-1 font-hud text-2xl">Available routes</h2>
                </div>
                <p className="text-xs text-muted">Fare shown per destination</p>
              </div>
              {routes.length === 0 ? (
                <p className="m-3 border border-dashed border-bone/15 px-4 py-6 text-sm text-muted">
                  No routes are charted from this position.
                </p>
              ) : (
                <div className="divide-y divide-bone/10">
                  {routes.map((route) => {
                    const destination = locations.find((location) => location.id === route.destinationId);
                    const available = route.available && Boolean(destination?.unlocked);
                    const canAfford = credits >= route.costCredits;
                    const lockedReason = destination
                      ? `LOCKED · ${destination.lockReason ?? `CLEAR ${destination.unlockAfter}`}`
                      : "DESTINATION SIGNAL MISSING";
                    return (
                      <article
                        key={route.destinationId}
                        data-testid={`row-world-route-${route.destinationId}`}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="font-hud text-lg leading-tight">
                              {destination?.name ?? route.destinationId}
                            </h3>
                            <span className={`text-[9px] tracking-widest ${available ? "text-solar" : "text-alert"}`}>
                              {available ? "ROUTE OPEN" : route.available ? lockedReason : "ROUTE UNAVAILABLE"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {destination
                              ? `${destination.sector ? destination.sector.toUpperCase() + " · " : ""}${destination.requiredTechTier ? `HYPERDRIVE T${destination.requiredTechTier} · ` : ""}${destination.requiredRep ? `REP ${destination.requiredRep}+ · ` : ""}${kindLabel[destination.kind] ?? destination.kind.toUpperCase()} · GRID ${String(destination.x).padStart(2, "0")} / ${String(destination.y).padStart(2, "0")}`
                              : "Destination details not charted"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="text-right">
                            <p className="font-hud text-lg text-solar">{money(route.costCredits)}</p>
                            <p className="text-[9px] tracking-widest text-muted">
                              {canAfford ? "FLIGHT FARE" : `NEED ${money(route.costCredits - credits)} MORE`}
                            </p>
                          </div>
                          <button
                            type="button"
                            data-testid={`button-travel-${route.destinationId}`}
                            disabled={!available || !canAfford || busy}
                            onClick={() => void travelTo(route.destinationId)}
                            className="min-h-11 min-w-28 bg-solar px-3 font-hud text-xs tracking-widest text-void disabled:border disabled:border-bone/10 disabled:bg-transparent disabled:text-muted"
                          >
                            {travel.isPending ? "IN TRANSIT…" : !available ? "UNAVAILABLE" : canAfford ? "TRAVEL" : "INSUFFICIENT"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="border border-bone/15 bg-panel/65 p-4">
              <p className="font-hud text-xs tracking-[0.2em] text-solar">FACTION STANDING</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="min-w-0 border-l-2 border-[#a9c9cc] bg-void/45 p-3">
                  <p className="flex items-center gap-2 text-[10px] tracking-widest text-muted"><FactionMark faction="accord" className="h-6 w-6" />THE ACCORD</p>
                  <p data-testid="text-reputation-accord" className="mt-1 font-mono text-2xl sm:text-3xl">
                    {world.reputation.accord.toLocaleString()} <span className="block font-hud text-[10px] tracking-widest text-solar">{repLabel(world.reputation.accord)}</span>
                  </p>
                </div>
                <div className="min-w-0 border-l-2 border-bone/50 bg-void/45 p-3">
                  <p className="flex items-center gap-2 text-[10px] tracking-widest text-muted"><FactionMark faction="ussf" className="h-6 w-6" />USSF</p>
                  <p data-testid="text-reputation-ussf" className="mt-1 font-mono text-2xl sm:text-3xl">
                    {world.reputation.ussf.toLocaleString()} <span className="block font-hud text-[10px] tracking-widest text-solar">{repLabel(world.reputation.ussf)}</span>
                  </p>
                </div>
              </div>
            </section>

            <section className="border border-bone/15 bg-panel/65">
              <div className="border-b border-bone/10 px-4 py-4">
                <p className="font-hud text-xs tracking-[0.2em] text-solar">PERSISTENT CONTRACTS</p>
                <h2 className="mt-1 font-hud text-2xl">Theater operations</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Accept at Phobos Yard. Claim only at the recorded objective location.
                </p>
              </div>
              {quests.length === 0 ? (
                <p className="p-4 text-sm text-muted">No contracts are currently available.</p>
              ) : (
                <div className="divide-y divide-bone/10">
                  {quests.map((quest) => {
                    const target = locations.find((item) => item.id === quest.requiredLocation);
                    const canAccept = quest.status === "available" && currentIsPhobosYard;
                    const isAtTarget = world.currentLocation === quest.requiredLocation;
                    const hasDiscovery = discovered.has(quest.requiredLocation);
                    const canClaim = quest.status === "ready" && isAtTarget && hasDiscovery;
                    const action = canAccept ? "accept" : canClaim ? "claim" : null;
                    const gateCopy =
                      quest.status === "available" && !currentIsPhobosYard
                        ? "ACCEPT AT PHOBOS YARD"
                        : quest.status === "accepted" && hasDiscovery && !isAtTarget
                          ? `TRAVEL TO ${target?.name ?? "OBJECTIVE LOCATION"} TO CLAIM`
                          : quest.status === "accepted" && isAtTarget && !hasDiscovery
                            ? "EXPLORE OBJECTIVE LOCATION TO RECORD DISCOVERY"
                            : null;
                    return (
                      <article key={quest.id} data-testid={`card-world-quest-${quest.id}`} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-hud text-lg leading-tight">{quest.title}</h3>
                          <span className={`shrink-0 text-[9px] tracking-widest ${quest.status === "ready" ? "text-solar" : "text-muted"}`}>
                            {statusLabel[quest.status] ?? quest.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted">{quest.description}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tracking-wider text-bone/65">
                          <span>{money(quest.rewardCredits)}</span>
                          <span>+{quest.reputationReward} REP</span>
                          <span>CLEAR {quest.requiredClear}</span>
                          <span>OBJECTIVE · {target?.name ?? quest.requiredLocation}</span>
                        </div>
                        {gateCopy ? (
                          <p className="mt-3 border-l border-alert/40 pl-2 text-[9px] leading-relaxed tracking-widest text-muted">
                            {gateCopy}
                          </p>
                        ) : null}
                        {action ? (
                          <button
                            type="button"
                            data-testid={`button-${action}-quest-${quest.id}`}
                            disabled={busy}
                            onClick={() => void actQuest(quest, action)}
                            className="mt-3 min-h-11 w-full bg-solar font-hud text-xs tracking-widest text-void disabled:opacity-45"
                          >
                            {questAction.isPending
                              ? "UPDATING CONTRACT…"
                              : action === "accept"
                                ? "ACCEPT OPERATION"
                                : "CLAIM REWARD"}
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="border border-bone/15 bg-panel/65 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-hud text-xs tracking-[0.2em] text-solar">RECORDED DISCOVERIES</p>
                <span className="font-mono text-xs text-muted">{world.discoveries.length} LOGGED</span>
              </div>
              {world.discoveries.length === 0 ? (
                <p className="mt-3 border border-dashed border-bone/15 px-3 py-4 text-sm leading-relaxed text-muted">
                  The chart is blank. Explore your current unlocked location to record the first signal.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {world.discoveries.map((discovery) => {
                    const expeditionId = discovery.startsWith("flight:") ? discovery.slice("flight:".length) : "";
                    const expedition = sectorMission(expeditionId);
                    return (
                      <li key={discovery} className="border-l border-solar/50 pl-3 text-sm text-bone/80">
                        {expedition ? `${expedition.title} · VERIFIED FLIGHT` : locations.find((location) => location.id === discovery)?.name ?? discovery}
                      </li>
                    );
                  })}
                </ul>
              )}
              {showSectorExpedition && nextStoryMission ? (
                <Link
                  href={`/expedition?mission=${encodeURIComponent(nextStoryMission.id)}`}
                  data-testid="link-discovery-expedition"
                  className="wfm-cmd wfm-cmd-secondary mt-3 min-h-11 justify-center px-3 font-hud text-[11px] tracking-widest"
                >
                  {nextStoryMission.id === "rust-disc" ? "BEGIN" : "CONTINUE"} {nextStoryMission.title.toUpperCase()}
                </Link>
              ) : null}
            </section>
          </aside>
        </div>

        {marketAvailable ? (
          <section className="mt-5" aria-label="Station market service">
            <Suspense fallback={<div role="status" className="h-48 border border-bone/10 bg-panel/50" aria-label="Loading station market" />}>
              <MarketPanel onCredits={onCredits} />
            </Suspense>
          </section>
        ) : null}

        {actionError ? (
          <p role="alert" data-testid="status-world-error" className="mt-4 border border-alert/40 bg-alert/10 px-3 py-3 text-sm leading-relaxed text-bone">
            {actionError}
          </p>
        ) : null}
      </div>
    </main>
  );
}
