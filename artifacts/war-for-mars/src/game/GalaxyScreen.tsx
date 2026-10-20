import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMarketQueryKey,
  getGetWorldQueryKey,
  useActOnWorldQuest,
  useExploreLocation,
  useGetWorld,
} from "@workspace/api-client-react";
import type { WorldLocation, WorldQuest } from "@workspace/api-client-react";

type Props = { onBack: () => void };
const kindLabel: Record<string, string> = { station: "STATION", relay: "RELAY", moon: "MOON", ruins: "RUINS" };
const statusLabel: Record<string, string> = { locked: "LOCKED", available: "AVAILABLE", accepted: "IN PROGRESS", ready: "READY TO CLAIM", claimed: "CLAIMED" };
const errorText = (error: unknown) => error instanceof Error ? error.message : "Operation could not be completed. Try again.";

export function GalaxyScreen({ onBack }: Props) {
  const queryClient = useQueryClient();
  const worldQuery = useGetWorld({ query: { refetchInterval: 15000, queryKey: getGetWorldQueryKey() } });
  const explore = useExploreLocation();
  const questAction = useActOnWorldQuest();
  const [actionError, setActionError] = useState("");
  const requestKeys = useRef(new Map<string, string>());
  const world = worldQuery.data;

  const exploreLocation = async (location: WorldLocation) => {
    setActionError("");
    const idempotencyKey =
      requestKeys.current.get(`explore:${location.id}`) ?? crypto.randomUUID();
    requestKeys.current.set(`explore:${location.id}`, idempotencyKey);
    try {
      await explore.mutateAsync({ locationId: location.id, data: { idempotencyKey } });
      requestKeys.current.delete(`explore:${location.id}`);
      await queryClient.invalidateQueries({ queryKey: getGetWorldQueryKey() });
    } catch (error) { setActionError(errorText(error)); }
  };
  const actQuest = async (quest: WorldQuest, action: "accept" | "claim") => {
    setActionError("");
    const keyName = `quest:${quest.id}:${action}`;
    const idempotencyKey = requestKeys.current.get(keyName) ?? crypto.randomUUID();
    requestKeys.current.set(keyName, idempotencyKey);
    try {
      await questAction.mutateAsync({ questId: quest.id, data: { idempotencyKey, action } });
      requestKeys.current.delete(keyName);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetWorldQueryKey() }),
        ...(action === "claim" ? [queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey() })] : []),
      ]);
    } catch (error) { setActionError(errorText(error)); }
  };

  if (worldQuery.isLoading) return <main className="min-h-dvh bg-void px-4 py-8 text-bone sm:px-8"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-3 w-48 bg-bone/10" /><div className="mt-4 h-12 w-80 max-w-full bg-bone/10" /><div className="mt-8 grid gap-4 md:grid-cols-2"><div className="h-64 bg-panel" /><div className="h-64 bg-panel" /></div></div></main>;
  if (worldQuery.isError || !world) return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-void px-5 text-center text-bone">
      <p className="font-hud text-sm tracking-[0.22em] text-alert">GALAXY SIGNAL UNAVAILABLE</p>
      <p className="mt-2 max-w-md text-sm text-muted">Persistent world state could not be reached. No exploration or quest progress was changed.</p>
      <button type="button" data-testid="button-retry-world" onClick={() => void worldQuery.refetch()} className="mt-5 h-11 border border-bone/30 px-5 font-hud tracking-widest">RETRY LINK</button>
      <button type="button" onClick={onBack} className="mt-3 h-10 px-5 font-hud tracking-widest text-muted">BACK TO MENU</button>
    </main>
  );

  const locations = world.locations;
  const quests = world.quests;
  const busy = explore.isPending || questAction.isPending;
  return (
    <main className="min-h-dvh bg-void px-4 py-5 text-bone sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-solar/30 pb-5">
          <div>
            <p className="font-hud text-xs tracking-[0.24em] text-solar">WAR FOR MARS / PERSISTENT THEATER</p>
            <h1 className="mt-2 font-hud text-4xl leading-none sm:text-6xl">THE GALAXY</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">A living chart of the Phobos theater. Discoveries and standing persist between sorties.</p>
          </div>
          <button type="button" data-testid="button-galaxy-back" onClick={onBack} className="h-11 border border-bone/30 px-4 font-hud tracking-widest text-bone">RETURN TO MENU</button>
        </header>

        <section data-testid="panel-world-event" className="relative mt-5 overflow-hidden border border-solar/35 bg-panel p-4 sm:p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-solar" />
          <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
            <div><p className="font-hud text-[10px] tracking-[0.22em] text-solar">ACTIVE WORLD EVENT · {new Date(world.event.cycleDate).toLocaleDateString()}</p>
              <h2 className="mt-1 font-hud text-2xl sm:text-3xl">{world.event.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{world.event.description}</p>
            </div>
              <div className="border-l border-bone/15 pl-3 text-xs text-muted"><p>BEGINS {new Date(world.event.startsAt).toLocaleString()}</p><p className="mt-1">ENDS {new Date(world.event.endsAt).toLocaleString()}</p></div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="border border-bone/15 bg-panel/65">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bone/10 px-4 py-4">
              <div><p className="font-hud text-xs tracking-[0.2em] text-solar">THEATER CHART</p><h2 className="mt-1 font-hud text-2xl">Locations</h2></div>
              <p className="text-xs text-muted">{locations.filter((loc) => loc.explored).length} / {locations.length} explored</p>
            </div>
            {locations.length === 0 ? <p className="p-5 text-sm text-muted">No locations are currently charted.</p> : (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {locations.map((location) => (
                  <article key={location.id} data-testid={`card-location-${location.id}`} className={`border p-3 ${location.unlocked ? "border-bone/15 bg-void/45" : "border-bone/8 bg-void/20 opacity-75"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="font-hud text-lg leading-tight">{location.name}</p><p className="mt-1 font-mono text-[10px] tracking-widest text-solar">{kindLabel[location.kind] ?? location.kind.toUpperCase()} · {String(location.x).padStart(2, "0")} / {String(location.y).padStart(2, "0")}</p></div>
                      <span className={`shrink-0 border px-2 py-1 text-[9px] tracking-widest ${location.explored ? "border-solar/40 text-solar" : location.unlocked ? "border-bone/20 text-bone/70" : "border-alert/30 text-alert"}`}>{location.explored ? "CHARTED" : location.unlocked ? "UNDISCOVERED" : `CLEAR ${location.unlockAfter}`}</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted">{location.description}</p>
                    {location.services.length > 0 && <p className="mt-2 text-[10px] tracking-wider text-bone/65">{location.services.join(" · ")}</p>}
                    <button type="button" data-testid={`button-explore-${location.id}`} disabled={!location.unlocked || location.explored || busy} onClick={() => void exploreLocation(location)} className="mt-3 h-9 w-full border border-solar/45 font-hud text-xs tracking-widest text-solar disabled:border-bone/10 disabled:text-muted">
                      {explore.isPending ? "RECORDING DISCOVERY…" : location.explored ? "DISCOVERY RECORDED" : location.unlocked ? "EXPLORE LOCATION" : "LOCATION LOCKED"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-5">
            <section className="border border-bone/15 bg-panel/65 p-4">
              <p className="font-hud text-xs tracking-[0.2em] text-solar">FACTION STANDING</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="border-l-2 border-solar bg-void/45 p-3"><p className="text-[10px] tracking-widest text-muted">THE ACCORD</p><p data-testid="text-reputation-accord" className="mt-1 font-mono text-3xl">{world.reputation.accord.toLocaleString()}</p></div>
                <div className="border-l-2 border-bone/50 bg-void/45 p-3"><p className="text-[10px] tracking-widest text-muted">USSF</p><p data-testid="text-reputation-ussf" className="mt-1 font-mono text-3xl">{world.reputation.ussf.toLocaleString()}</p></div>
              </div>
            </section>
            <section className="border border-bone/15 bg-panel/65">
              <div className="border-b border-bone/10 px-4 py-4"><p className="font-hud text-xs tracking-[0.2em] text-solar">SIDE OPERATIONS</p><h2 className="mt-1 font-hud text-2xl">Persistent contracts</h2><p className="mt-1 text-xs text-muted">Server-authorized objectives and rewards.</p></div>
              {quests.length === 0 ? <p className="p-4 text-sm text-muted">No side operations are available.</p> : <div className="divide-y divide-bone/10">
                {quests.map((quest) => {
                  const location = locations.find((item) => item.id === quest.requiredLocation);
                  const action = quest.status === "available" ? "accept" : quest.status === "ready" ? "claim" : null;
                  return <article key={quest.id} data-testid={`card-world-quest-${quest.id}`} className="p-4">
                    <div className="flex items-start justify-between gap-3"><h3 className="font-hud text-lg leading-tight">{quest.title}</h3><span className={`shrink-0 text-[9px] tracking-widest ${quest.status === "ready" ? "text-solar" : "text-muted"}`}>{statusLabel[quest.status] ?? quest.status.toUpperCase()}</span></div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{quest.description}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tracking-wider text-bone/65"><span>{quest.rewardCredits.toLocaleString()} CR</span><span>+{quest.reputationReward} REP</span><span>CLEAR {quest.requiredClear}{location ? ` · ${location.name}` : ""}</span></div>
                    {action ? <button type="button" data-testid={`button-${action}-quest-${quest.id}`} disabled={busy} onClick={() => void actQuest(quest, action)} className="mt-3 h-9 w-full bg-solar font-hud text-xs tracking-widest text-void disabled:opacity-50">{questAction.isPending ? "UPDATING CONTRACT…" : action === "accept" ? "ACCEPT OPERATION" : "CLAIM REWARD"}</button> : null}
                  </article>;
                })}
              </div>}
            </section>
            <section className="border border-bone/15 bg-panel/65 p-4">
              <p className="font-hud text-xs tracking-[0.2em] text-solar">RECORDED DISCOVERIES</p>
              {world.discoveries.length === 0 ? <p className="mt-2 text-sm text-muted">No discoveries recorded yet. Explore an unlocked location to begin the chart.</p> : <ul className="mt-3 space-y-2">{world.discoveries.map((discovery) => <li key={discovery} className="border-l border-solar/50 pl-3 text-sm text-bone/80">{locations.find((location) => location.id === discovery)?.name ?? discovery}</li>)}</ul>}
            </section>
          </div>
        </div>
        {actionError ? <p role="alert" data-testid="status-world-error" className="mt-4 border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-bone">{actionError}</p> : null}
      </div>
    </main>
  );
}
