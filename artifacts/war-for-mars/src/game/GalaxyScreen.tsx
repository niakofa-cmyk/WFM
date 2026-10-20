import { lazy, Suspense, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMarketQueryKey,
  getGetWorldQueryKey,
  useActOnWorldQuest,
  useExploreLocation,
  useGetWorld,
  useTravelWorld,
} from "@workspace/api-client-react";
import type { WorldLocation, WorldQuest } from "@workspace/api-client-react";

const MarketPanel = lazy(() => import("./MarketPanel").then((module) => ({ default: module.MarketPanel })));

type Props = { onBack: () => void; credits: number; onCredits: (credits: number) => void };

const kindLabel: Record<string, string> = {
  station: "STATION",
  relay: "RELAY",
  moon: "MOON",
  ruins: "RUINS",
};
const statusLabel: Record<string, string> = {
  locked: "LOCKED",
  available: "AVAILABLE",
  accepted: "IN PROGRESS",
  ready: "READY TO CLAIM",
  claimed: "CLAIMED",
};
const money = (value: number) => `${value.toLocaleString()} CR`;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Operation could not be completed. Try again.";

export function GalaxyScreen({ onBack, credits, onCredits }: Props) {
  const queryClient = useQueryClient();
  const worldQuery = useGetWorld({
    query: { refetchInterval: 15000, queryKey: getGetWorldQueryKey() },
  });
  const travel = useTravelWorld();
  const explore = useExploreLocation();
  const questAction = useActOnWorldQuest();
  const [actionError, setActionError] = useState("");
  const requestKeys = useRef(new Map<string, string>());
  const world = worldQuery.data;
  const busy = travel.isPending || explore.isPending || questAction.isPending;

  const keyFor = (name: string) => {
    const existing = requestKeys.current.get(name);
    if (existing) return existing;
    const next = crypto.randomUUID();
    requestKeys.current.set(name, next);
    return next;
  };

  const applyWorldResult = async (nextWorld: typeof world) => {
    if (nextWorld) queryClient.setQueryData(getGetWorldQueryKey(), nextWorld);
    await queryClient.invalidateQueries({ queryKey: getGetWorldQueryKey() });
  };

  const travelTo = async (destinationId: string) => {
    const requestName = `travel:${destinationId}`;
    setActionError("");
    try {
      const result = await travel.mutateAsync({
        data: { idempotencyKey: keyFor(requestName), destinationId },
      });
      onCredits(result.credits);
      await Promise.all([
        applyWorldResult(result.world),
        queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey() }),
      ]);
      requestKeys.current.delete(requestName);
    } catch (error) {
      setActionError(errorText(error));
    }
  };

  const exploreLocation = async (location: WorldLocation) => {
    const requestName = `explore:${location.id}`;
    setActionError("");
    try {
      const result = await explore.mutateAsync({
        locationId: location.id,
        data: { idempotencyKey: keyFor(requestName) },
      });
      await applyWorldResult(result.world);
      requestKeys.current.delete(requestName);
    } catch (error) {
      setActionError(errorText(error));
    }
  };

  const actQuest = async (quest: WorldQuest, action: "accept" | "claim") => {
    const requestName = `quest:${quest.id}:${action}`;
    setActionError("");
    try {
      const result = await questAction.mutateAsync({
        questId: quest.id,
        data: { idempotencyKey: keyFor(requestName), action },
      });
      if (action === "claim") onCredits(result.credits);
      await Promise.all([
        applyWorldResult(result.world),
        ...(action === "claim"
          ? [queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey() })]
          : []),
      ]);
      requestKeys.current.delete(requestName);
    } catch (error) {
      setActionError(errorText(error));
    }
  };

  if (worldQuery.isLoading) {
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

  if (worldQuery.isError || !world) {
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
          className="mt-3 h-10 px-5 font-hud tracking-widest text-muted"
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

  return (
    <main className="min-h-dvh bg-void px-4 py-5 text-bone sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-solar/30 pb-5">
          <div>
            <p className="font-hud text-[10px] tracking-[0.24em] text-solar sm:text-xs">
              WAR FOR MARS / USSF–ACCORD THEATER
            </p>
            <h1 className="mt-2 font-hud text-4xl leading-none sm:text-6xl">THEATER CONTROL</h1>
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
              className="h-11 border border-bone/30 px-4 font-hud text-xs tracking-widest text-bone sm:text-sm"
            >
              BACK TO HANGAR
            </button>
          </div>
        </header>

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
                  {currentLocation.unlocked && !currentLocation.explored ? (
                    <button
                      type="button"
                      data-testid={`button-explore-${currentLocation.id}`}
                      disabled={busy}
                      onClick={() => void exploreLocation(currentLocation)}
                      className="mt-4 h-10 w-full border border-solar/50 font-hud text-xs tracking-widest text-solar disabled:opacity-40 sm:w-auto sm:px-5"
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
                      ? `LOCKED · CLEAR ${destination.unlockAfter}`
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
                              ? `${kindLabel[destination.kind] ?? destination.kind.toUpperCase()} · GRID ${String(destination.x).padStart(2, "0")} / ${String(destination.y).padStart(2, "0")}`
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
                            className="h-10 min-w-28 bg-solar px-3 font-hud text-xs tracking-widest text-void disabled:border disabled:border-bone/10 disabled:bg-transparent disabled:text-muted"
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
                <div className="border-l-2 border-solar bg-void/45 p-3">
                  <p className="text-[10px] tracking-widest text-muted">THE ACCORD</p>
                  <p data-testid="text-reputation-accord" className="mt-1 font-mono text-3xl">
                    {world.reputation.accord.toLocaleString()}
                  </p>
                </div>
                <div className="border-l-2 border-bone/50 bg-void/45 p-3">
                  <p className="text-[10px] tracking-widest text-muted">USSF</p>
                  <p data-testid="text-reputation-ussf" className="mt-1 font-mono text-3xl">
                    {world.reputation.ussf.toLocaleString()}
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
                            className="mt-3 h-10 w-full bg-solar font-hud text-xs tracking-widest text-void disabled:opacity-45"
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
                  {world.discoveries.map((discovery) => (
                    <li key={discovery} className="border-l border-solar/50 pl-3 text-sm text-bone/80">
                      {locations.find((location) => location.id === discovery)?.name ?? discovery}
                    </li>
                  ))}
                </ul>
              )}
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
            {actionError} Retry the same action; its request key is retained.
          </p>
        ) : null}
      </div>
    </main>
  );
}
