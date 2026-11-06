import { menuTip, type MenuAction, type MenuStateId } from "./menu";
import { ROSTER, SHIPS, type Faction, type Scheme, type ShipId } from "./ships";
import { TECHS, type TechId } from "./campaign";
import { ReadOnlyProfileCheck } from "./ReadOnlyProfileCheck";
import type { Save } from "./save";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CommandBackdrop, CommandPanel, FactionMark, PanelLabel, Wordmark } from "./CommandArt";
import { ShipIllustration } from "./ShipIllustration";
import { HangarShip } from "./HangarShip";
import { campaignBriefing } from "./command-briefing";
import { expeditionFeatureEnabled } from "./sector-client";

const EXPEDITION_ENABLED = expeditionFeatureEnabled({
  DEV: import.meta.env.DEV,
  VITE_WFM_SECTOR_EXPEDITION_ENABLED: import.meta.env.VITE_WFM_SECTOR_EXPEDITION_ENABLED,
});

type HomeProps = {
  state: MenuStateId;
  tipIndex: number;
  faction: Faction;
  ship: ShipId;
  scheme: Scheme;
  gyro: boolean;
  refit: number;
  credits: number;
  tech: TechId | null;
  profile: Save;
  signedIn: boolean;
  publicLeaderboardOptIn: boolean;
  publicLeaderboardCallsign: string;
  publicLeaderboardSaving: boolean;
  publicLeaderboardError: string;
  onSavePublicLeaderboard: (enabled: boolean, callsign: string) => void;
  cleared: number;
  refitLabel: string;
  refitDisabled: boolean;
  onAction: (action: MenuAction) => void;
  onGalaxy: () => void;
  onJoinCompetitiveQueue: () => void;
  onJoinCasualAiQueue: () => void;
  onCancelMatchmaking: () => void;
  competitiveQueueing: boolean;
  competitiveQueueAvailable: boolean;
  casualAiQueueing: boolean;
  casualAiQueueAvailable: boolean;
  onlineStatus?: string;
  offlineAvailable: boolean;
  onOfflineStrike: () => void;
  onFaction: (faction: Faction) => void;
  onShip: (ship: ShipId) => void;
  onSaveLoadout: (input: { faction: Faction; shipId: ShipId }) => Promise<boolean>;
  loadoutSaving: boolean;
  loadoutError: string;
  onScheme: (scheme: Scheme) => void;
  onGyro: () => void;
  onTech: (tech: TechId) => void;
  onRefit: () => void;
};

export function HomeScreen(props: HomeProps) {
  const { state, onAction } = props;
  const commandState = state === "MAIN_MENU";
  return (
    <section
      data-testid="home-screen"
      className="relative min-h-dvh overflow-x-hidden bg-void text-bone"
    >
      <CommandBackdrop dense={state === "SETTINGS" || state === "ARMORY"} faction={commandState ? props.faction : undefined} />
      <div className="wfm-safe relative flex min-h-dvh flex-col justify-between pt-5 sm:px-10">
        {commandState ? (
          <CommandTopBar {...props} />
        ) : (
          <div className="flex items-center gap-3 border-b border-bone/10 pb-3 pr-12">
            <FactionMark faction="ussf" className="h-7 w-7" />
            <p className="min-w-0 flex-1 font-hud text-[11px] tracking-[0.22em] text-solar">USSF VS THE ACCORD · PHOBOS THEATER</p>
            <FactionMark faction="accord" className="h-7 w-7 opacity-80" />
          </div>
        )}
        {state === "BOOT" ? <Boot /> : null}
        {state === "TITLE" ? <Title onAction={onAction} /> : null}
        {state === "MAIN_MENU" ? <MainMenu {...props} /> : null}
        {state === "ARMORY" ? <Armory {...props} /> : null}
        {state === "SETTINGS" ? <Settings {...props} /> : null}
        {state === "LOADING" ? <Loading tip={menuTip(props.tipIndex)} ship={SHIPS[props.ship].name} /> : null}
      </div>
    </section>
  );
}

function Boot() {
  return (
    <div className="flex flex-1 items-center" role="status">
      <p className="font-hud text-sm tracking-widest text-bone">
        <span className="wfm-blink mr-2 inline-block h-2 w-2 bg-solar align-middle" aria-hidden="true" />
        LINKING THE WING
      </p>
    </div>
  );
}

function Title({ onAction }: { onAction: (action: MenuAction) => void }) {
  return (
    <button
      type="button"
      className="group flex flex-1 flex-col items-start justify-center text-left"
      onClick={() => onAction("START")}
    >
      <h1 className="sr-only">WAR FOR MARS: INFINITE WAR</h1>
      <span className="wfm-rise flex items-center gap-3">
        <FactionMark faction="ussf" className="h-12 w-12 sm:h-16 sm:w-16" />
        <span aria-hidden="true" className="h-10 w-px bg-bone/25" />
        <FactionMark faction="accord" className="h-12 w-12 sm:h-16 sm:w-16" />
      </span>
      <Wordmark className="wfm-arrive mt-6 w-full max-w-3xl" />
      <span aria-hidden="true" className="wfm-sweep mt-4 block h-px w-full max-w-3xl bg-gradient-to-r from-solar via-solar/40 to-transparent" />
      <span className="wfm-rise-2 mt-4 block font-hud text-sm tracking-[0.32em] text-muted">THE INFINITE WAR · USSF VS THE ACCORD · PHOBOS THEATER</span>
      <span className="wfm-rise-3 wfm-chamfer wfm-cmd wfm-cmd-primary mt-8 min-h-14 px-7 font-hud text-lg tracking-[0.28em] group-hover:bg-[#ebb173]">
        ENTER THE WAR
      </span>
    </button>
  );
}

function CommandTopBar({ faction, credits, cleared, signedIn, ship }: HomeProps) {
  const { completed, total } = campaignBriefing(cleared);
  return (
    <header className="wfm-rise flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-bone/10 pb-3 pr-12">
      <Wordmark className="w-36 sm:w-48" />
      <span className="sr-only">WAR FOR MARS: INFINITE WAR</span>
      <span className="font-hud text-[9px] tracking-[0.2em] text-solar">THE INFINITE WAR</span>
      <div className="ml-auto flex items-center gap-4 font-hud text-xs tracking-[0.18em]">
        <span className="flex items-center gap-2" data-testid="text-command-faction">
          <FactionMark faction={faction} className="h-6 w-6" />
          <span className={faction === "accord" ? "text-solar" : "text-spectral"}>{FACTION_NAME[faction]}</span>
        </span>
        <span className="hidden text-muted sm:inline">{SHIPS[ship].name.toUpperCase()}</span>
        <span data-testid="text-command-credits" className="text-bone">{credits} CR</span>
        <span data-testid="text-command-progress" className="text-muted">{completed}/{total} SORTIES</span>
        <span className={signedIn ? "text-muted" : "text-alert"}>{signedIn ? "SIGNED IN" : "GUEST"}</span>
      </div>
    </header>
  );
}

const FACTION_NAME: Record<Faction, string> = { ussf: "USSF", accord: "THE ACCORD" };

function MainMenu(props: HomeProps) {
  const { onAction, onGalaxy, ship, faction, cleared } = props;
  const def = SHIPS[ship];
  const brief = campaignBriefing(cleared);
  return (
    <main className="wfm-hangar-content flex-1 py-4 sm:py-6">
      <section className="wfm-hangar-hero wfm-rise-2" aria-labelledby="hangar-title" data-testid="panel-command-briefing">
        <div className="wfm-hangar-scene">
          <div className="wfm-hangar-art" aria-hidden="true" />
          <div className="absolute left-4 top-4 z-10">
            <PanelLabel tone={faction === "accord" ? "solar" : "spectral"}>{FACTION_NAME[faction]} · PHOBOS YARD / BAY 04</PanelLabel>
            <p className="mt-1 font-hud text-xs tracking-[0.24em] text-bone/60">HANGAR DECK · READY STATUS</p>
          </div>
          <div className="absolute right-4 top-4 z-10 hidden text-right font-hud text-[10px] tracking-[0.2em] text-muted sm:block">
            <p>ORBITAL DOCKING CLAMP</p><p className="mt-1 text-solar">● SECURE</p>
          </div>
          <HangarShip ship={ship} faction={faction} />
          <div className="absolute bottom-4 right-4 z-10 font-hud text-[10px] tracking-[0.18em] text-bone/60">NOSE VECTOR · +Z</div>
        </div>
        <div className="wfm-hangar-identity">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <PanelLabel tone={faction === "accord" ? "solar" : "spectral"}>SAVED HULL · {FACTION_NAME[faction]}</PanelLabel>
              <h1 id="hangar-title" data-testid="text-selected-ship" className="mt-1 font-hud text-4xl leading-none tracking-[0.06em] sm:text-5xl">{def.name.toUpperCase()}</h1>
              <p className={`mt-2 font-hud text-xs tracking-[0.2em] ${faction === "accord" ? "text-solar" : "text-spectral"}`}>{def.role.toUpperCase()} · ULT {def.ultShort}</p>
            </div>
            <FactionMark faction={faction} className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone/80">{def.blurb}</p>
          <dl className="mt-4 grid grid-cols-3 gap-px border border-bone/10 bg-bone/10 font-hud">
            {[
              ["SHIELD", def.shield],
              ["HULL", def.hull],
              ["TOP SPEED", def.maxSpeed],
              ["THRUST", def.accel],
              ["PULSE DMG", def.shotDmg],
              ["SHOT RATE", `${(1 / def.fireInterval).toFixed(1)}/s`],
            ].map(([k, v]) => (
              <div key={k} className="bg-panel px-3 py-2"><dt className="text-[10px] tracking-[0.22em] text-muted">{k}</dt><dd className="text-xl leading-none">{v}</dd></div>
            ))}
          </dl>
          <button type="button" onClick={() => onAction("ARMORY")} data-testid="button-change-ship-faction" className="wfm-cmd wfm-cmd-secondary mt-4 min-h-11 w-full justify-center px-3 font-hud tracking-widest">
            ARMORY · CHANGE SAVED HULL
          </button>
          <p className="mt-2 text-[11px] tracking-wide text-muted">Hangar display reflects your saved account loadout. Configure and save in Armory.</p>
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
        <section aria-label="Operations" className="wfm-rise flex flex-col gap-3">
          <div className="flex items-end justify-between border-b border-bone/15 pb-2">
            <div><PanelLabel>PRIMARY OPERATION · PHOBOS THEATER</PanelLabel><p className="mt-1 font-hud text-2xl tracking-wider">STORY CAMPAIGN</p></div>
            <span className="font-hud text-xs tracking-widest text-muted">{brief.completed}/{brief.total} CLEARED</span>
          </div>
          <div className="wfm-operation-brief">
            <div className="min-w-0">
              <p data-testid="text-campaign-briefing" className="font-hud text-[11px] tracking-[0.2em] text-solar">NEXT SORTIE · {brief.label} · OBJECTIVE {brief.sortie.objective}</p>
              <h2 className="mt-1 font-hud text-2xl leading-none sm:text-3xl">{brief.sortie.name.toUpperCase()}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone/75">{brief.sortie.brief}</p>
              <div className="mt-4 flex gap-1" aria-label={`${brief.completed} of ${brief.total} sorties cleared`}>
                {Array.from({ length: brief.total }, (_, i) => <span key={i} className={`h-1 flex-1 ${i < brief.completed ? "bg-solar" : "bg-bone/15"}`} />)}
              </div>
            </div>
            <button type="button" onClick={() => onAction("DEPLOY")} data-testid="button-campaign-deploy" className="wfm-cmd wfm-cmd-primary wfm-chamfer min-h-14 justify-center px-5 font-hud text-lg tracking-[0.15em]">
              DEPLOY NEXT SORTIE
            </button>
          </div>
          <a href="/combat-lab.html?universe=1" data-testid="link-home-local-universe" className="wfm-cmd wfm-cmd-secondary min-h-14 flex-col items-start justify-center gap-1 border-l-2 border-solar px-4">
            <span className="font-hud tracking-widest text-solar">FLY THE MARS SECTOR · LOCAL</span>
            <span className="text-xs text-muted">Bounded offline Orbital flight · dock at Cinder Ring for training · no rewards</span>
          </a>
          {EXPEDITION_ENABLED ? (
            <Link href="/expedition" data-testid="link-home-expedition" className="wfm-cmd wfm-cmd-secondary min-h-14 flex-col items-start justify-center gap-1 border-l-2 border-spectral px-4">
              <span className="font-hud tracking-widest text-spectral">SECTOR OPERATIONS · CO-OP</span>
              <span className="text-xs text-muted">1–8 pilots · server-run missions across the Mars route</span>
            </Link>
          ) : null}
          <details data-testid="details-flight-systems" className="group border border-bone/15 bg-panel/60">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 font-hud text-sm tracking-[0.16em] text-bone marker:content-none">
              <span className="min-w-0">
                <span className="block">COMBAT TRAINING</span>
                <span className="mt-1 block font-sans text-[11px] tracking-normal text-muted">Orbital Lab · local arcade compatibility</span>
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-muted group-open:hidden">SHOW</span>
              <span className="ml-auto hidden shrink-0 text-[10px] text-muted group-open:inline">HIDE</span>
            </summary>
            <div className="grid gap-2 border-t border-bone/10 p-2 sm:grid-cols-2">
              <a href="/combat-lab.html" data-testid="link-home-combat-lab" className="wfm-cmd wfm-cmd-quiet min-h-[4.5rem] flex-col items-start justify-center gap-1 border-l-2 border-solar px-4">
                <span className="font-hud tracking-widest text-solar">ORBITAL COMBAT LAB · OFFLINE</span>
                <span className="text-xs text-muted">Canonical local combat training · no rewards</span>
              </a>
              <button type="button" onClick={() => onAction("ARCADE")} className="wfm-cmd wfm-cmd-quiet min-h-[4.5rem] flex-col items-start justify-center gap-1 px-4 sm:col-span-2">
                <span className="font-hud text-lg tracking-widest">ARCADE SKIRMISH</span>
                <span className="text-xs text-muted">Open-disc practice or strike sortie</span>
              </button>
            </div>
          </details>
        </section>

        <div className="flex flex-col gap-4">
          <CommandPanel className="wfm-rise-3 p-4" data-testid="panel-universe-navigation">
            <PanelLabel>UNIVERSE · STRATEGIC ACCESS</PanelLabel>
            <button type="button" data-testid="button-open-galaxy" onClick={onGalaxy} className="wfm-cmd wfm-cmd-secondary mt-3 min-h-14 w-full flex-col items-start justify-center gap-0 px-3">
              <span className="font-hud text-lg tracking-widest text-solar">PERSISTENT GALAXY</span>
              <span className="text-xs text-muted">World event · locations · side operations</span>
            </button>
          </CommandPanel>
          <OnlineWing {...props} />
          <nav aria-label="Hangar services" className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAction("ARMORY")} className="wfm-cmd wfm-cmd-quiet min-h-12 flex-col items-start justify-center gap-0 px-3">
              <span className="font-hud text-sm tracking-widest">ARMORY & UPGRADES</span><span className="truncate text-[11px] text-muted">{def.name} · saved loadout</span>
            </button>
            <button type="button" onClick={() => onAction("SETTINGS")} className="wfm-cmd wfm-cmd-quiet min-h-12 flex-col items-start justify-center gap-0 px-3">
              <span className="font-hud text-sm tracking-widest">SETTINGS</span><span className="text-[11px] text-muted">Controls · display</span>
            </button>
            <Link href="/leaderboard" data-testid="link-public-wing-leaderboard" className="wfm-cmd wfm-cmd-quiet col-span-2 min-h-12 flex-col items-start justify-center gap-0 px-3">
              <span className="font-hud text-sm tracking-widest text-solar">WING LEADERBOARD</span><span className="text-[11px] text-muted">Opt-in callsigns · verified Wing credits</span>
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}

function OnlineWing({
  onJoinCompetitiveQueue,
  onJoinCasualAiQueue,
  onCancelMatchmaking,
  competitiveQueueing,
  competitiveQueueAvailable,
  casualAiQueueing,
  casualAiQueueAvailable,
  signedIn,
  onlineStatus,
  offlineAvailable,
  onOfflineStrike,
}: HomeProps) {
  const queueing = competitiveQueueing || casualAiQueueing;
  return (
    <CommandPanel accent className="wfm-rise-3 order-3 p-4" data-testid="panel-online-wing">
      <PanelLabel>5V5 ONLINE WING</PanelLabel>
      {queueing || onlineStatus ? (
        <p role="status" className="mt-2 flex items-center gap-2 font-hud text-sm tracking-widest text-bone">
          {queueing ? <span aria-hidden="true" className="wfm-blink h-2 w-2 bg-solar" /> : null}
          {onlineStatus || (casualAiQueueing ? "JOINING THE PILOT WINDOW" : "WAITING FOR TEN HUMAN PILOTS")}
        </p>
      ) : null}

      <div className="mt-3 border-l-2 border-bone/20 pl-3">
        <p className="font-hud text-xs tracking-[0.2em] text-muted">CINDER RING MULTIPLAYER STATION</p>
        <p className="mb-2 text-xs text-muted">Private invite rooms and the human-only 5v5 competition are accessed at the asteroid dock.</p>
        <button
          type="button"
          data-testid="button-online-5v5"
          onClick={onJoinCompetitiveQueue}
          className="wfm-cmd wfm-cmd-secondary wfm-chamfer min-h-12 w-full flex-col items-start justify-center gap-0 px-3"
        >
          <span className="font-hud text-base leading-none tracking-widest">OPEN MULTIPLAYER DOCK</span>
          <span className="text-xs text-muted">Travel to Cinder Ring to create or join a private room.</span>
        </button>
      </div>

      {casualAiQueueAvailable || competitiveQueueAvailable || queueing ? (
        <div className="mt-4 border-l-2 border-solar/60 pl-3">
          <p className="font-hud text-xs tracking-[0.2em] text-muted">MATCHMAKING</p>
          {casualAiQueueAvailable ? (
            <button
              type="button"
              data-testid="button-casual-ai-queue"
              disabled={!signedIn || casualAiQueueing || competitiveQueueing}
              onClick={onJoinCasualAiQueue}
              className="wfm-cmd wfm-cmd-quiet mt-2 min-h-12 w-full flex-col items-start justify-center gap-0 px-3 py-1"
            >
              <span className="font-hud text-base leading-none tracking-widest text-solar">
                {casualAiQueueing ? "CONNECTING TO QUICK MATCH" : "QUICK MATCH · AI FILL"}
              </span>
              <span className="text-xs text-muted">
                {casualAiQueueing
                  ? onlineStatus || "Joining the pilot window…"
                  : signedIn
                    ? "30-second pilot window · each new pilot resets it · AI fills seats · no rewards or rank."
                    : "Sign in to join · casual, unranked, and no-reward."}
              </span>
            </button>
          ) : null}
          {competitiveQueueAvailable ? (
            <button
              type="button"
              data-testid="button-competitive-queue"
              disabled={!signedIn || competitiveQueueing || casualAiQueueing}
              onClick={onJoinCompetitiveQueue}
              className="wfm-cmd wfm-cmd-secondary mt-2 min-h-12 w-full flex-col items-start justify-center gap-0 px-3 py-1"
            >
              <span className="font-hud text-base leading-none tracking-widest text-solar">
                {competitiveQueueing ? "SEARCHING FOR PILOTS" : "OPEN CINDER RING ARENA"}
              </span>
              <span className="text-xs text-muted">
                {competitiveQueueing
                  ? onlineStatus || "Waiting for ten authenticated human pilots."
                  : signedIn
                    ? "Travel to the asteroid hub to queue, watch, and enter live Relay competitions."
                    : "Sign in to queue · ten human pilots required."}
              </span>
            </button>
          ) : null}
          {queueing ? (
            <button
              type="button"
              data-testid="button-cancel-matchmaking"
              onClick={onCancelMatchmaking}
              className="wfm-cmd mt-2 min-h-11 w-full border border-alert/60 bg-void/80 px-3 font-hud text-sm tracking-widest text-alert"
            >
              {casualAiQueueing ? "CANCEL QUICK MATCH" : "CANCEL QUEUE"}
            </button>
          ) : null}
        </div>
      ) : null}

      {offlineAvailable ? (
        <button
          type="button"
          data-testid="button-offline-strike"
          onClick={onOfflineStrike}
          className="wfm-cmd mt-3 min-h-11 w-full flex-col items-start justify-center gap-0 border border-alert/60 bg-void/80 px-3 py-1 text-alert"
        >
          <span className="font-hud text-sm tracking-widest">START OFFLINE STRIKE</span>
          <span className="text-xs">Room unavailable · play the local AI-filled match instead.</span>
        </button>
      ) : null}
    </CommandPanel>
  );
}

function Armory(props: HomeProps) {
  // Draft is deliberately separate from the periodically refreshed account.
  // Only an acknowledged save changes the command screen's equipped hull.
  const [draft, setDraft] = useState({ faction: props.faction, ship: props.ship });
  const dirty = draft.faction !== props.faction || draft.ship !== props.ship;
  const pickFaction = (faction: Faction) => setDraft(previous => ({
    faction,
    ship: ROSTER[faction].includes(previous.ship) ? previous.ship : ROSTER[faction][0],
  }));
  const saveHull = () => props.onSaveLoadout({ faction: draft.faction, shipId: draft.ship });
  const back = async () => {
    if (!dirty || await saveHull()) props.onAction("BACK");
  };
  return (
    <div className="flex flex-col gap-3 py-4">
      <h2 className="font-hud text-4xl leading-none">ARMORY</h2>
      <fieldset disabled={props.loadoutSaving} className="contents">
      <div className="grid max-w-xl grid-cols-2 gap-2">
        <Pick on={draft.faction === "accord"} label="The Accord" detail="Solar, stealth, the rings" click={() => pickFaction("accord")} mark="accord" />
        <Pick on={draft.faction === "ussf"} label="USSF" detail="Sensors, wards, the glide" click={() => pickFaction("ussf")} mark="ussf" />
      </div>
      <HullBay {...props} {...draft} isSaved={!dirty} onShip={ship => setDraft(previous => ({ ...previous, ship }))} />
      </fieldset>
      <div className="max-w-3xl">
        <button
          type="button"
          data-testid="button-save-hull"
          disabled={props.loadoutSaving || !dirty}
          onClick={() => void saveHull()}
          className="wfm-cmd wfm-cmd-primary min-h-12 w-full justify-center px-3 font-hud tracking-widest disabled:opacity-60"
        >
          {props.loadoutSaving ? "SAVING HULL…" : dirty ? "SAVE HULL" : "HULL SAVED"}
        </button>
        <p role={props.loadoutError ? "alert" : "status"} className="mt-2 text-sm text-bone">
          {props.loadoutError || (dirty ? "Unsaved selection. Save Hull or Back saves it to your pilot profile." : "Selected hull is saved to your pilot profile.")}
        </p>
      </div>
      <div className="grid max-w-xl grid-cols-1 gap-2 min-[400px]:grid-cols-3">
        {TECHS.map((tech) => {
          const locked = props.cleared < tech.need;
          return (
            <button
              key={tech.id}
              type="button"
              disabled={locked}
              onClick={() => props.onTech(tech.id)}
              className={
                props.tech === tech.id
                  ? "min-h-14 bg-solar px-2 py-1 text-left text-void"
                  : "wfm-glass min-h-14 min-w-0 border border-bone/25 bg-void/60 px-2 text-left text-bone disabled:opacity-40"
              }
            >
              <span className="block font-hud text-xs tracking-widest">{tech.name.toUpperCase()}</span>
              <span className={props.tech === tech.id ? "text-xs text-void/80" : "text-xs text-muted"}>{locked ? "Locked" : tech.detail}</span>
            </button>
          );
        })}
      </div>
      <div className="flex max-w-xl items-center justify-between gap-3">
        <p className="font-hud text-xl text-solar">{props.credits} CR</p>
        <button
          type="button"
          disabled={props.refitDisabled}
          className="wfm-chamfer min-h-11 bg-solar px-4 font-hud tracking-widest text-void disabled:bg-transparent disabled:outline disabled:outline-1 disabled:outline-bone/20 disabled:text-muted"
          onClick={props.onRefit}
        >
          {props.refitLabel}
        </button>
      </div>
      <button type="button" disabled={props.loadoutSaving} onClick={() => void back()}
        className="min-h-11 w-full max-w-xs border border-bone/30 bg-void/70 font-hud tracking-widest text-bone disabled:opacity-60">
        {props.loadoutSaving ? "SAVING…" : "BACK"}
      </button>
    </div>
  );
}

function Settings(props: HomeProps) {
  const [enabled, setEnabled] = useState(props.publicLeaderboardOptIn);
  const [callsign, setCallsign] = useState(props.publicLeaderboardCallsign);

  useEffect(() => {
    setEnabled(props.publicLeaderboardOptIn);
    setCallsign(props.publicLeaderboardCallsign);
  }, [props.publicLeaderboardOptIn, props.publicLeaderboardCallsign]);

  const validCallsign = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,15}$/.test(callsign.trim());

  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <h2 className="font-hud text-4xl leading-none">SETTINGS</h2>
      <div className="flex max-w-sm flex-col gap-2">
        <Pick on={props.scheme === "arc"} label="ARC" detail="Left stick turns the nose." click={() => props.onScheme("arc")} />
        <Pick on={props.scheme === "strafe"} label="STRAFE" detail="Left stick slides. Right stick turns." click={() => props.onScheme("strafe")} />
        <Pick on={props.gyro} label={props.gyro ? "GYRO ON" : "GYRO"} detail="Tilt rolls the nose after permission." click={props.onGyro} />
      </div>
      <p className="max-w-sm text-sm text-muted">Shake and sound stay on the fight glass. Hold is the P key.</p>
      <section className="wfm-glass max-w-sm border border-solar/40 p-3" data-testid="public-leaderboard-settings">
        <PanelLabel>PUBLIC WING LEADERBOARD</PanelLabel>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Only your callsign and total server-verified Wing credits are public. Your account, balance, match history, and online status stay private.
        </p>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-bone">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            data-testid="checkbox-leaderboard-opt-in"
          />
          Show me on the public board
        </label>
        <label htmlFor="leaderboard-callsign" className="mt-2 block text-xs tracking-widest text-muted">
          PUBLIC CALLSIGN
        </label>
        <input
          id="leaderboard-callsign"
          data-testid="input-leaderboard-callsign"
          autoComplete="off"
          maxLength={16}
          disabled={!enabled}
          value={callsign}
          onChange={(event) => setCallsign(event.target.value)}
          placeholder="3–16 letters, numbers, spaces, _ or -"
          className="mt-1 h-11 w-full border border-bone/25 bg-void px-3 text-bone placeholder:text-muted disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-muted">Choose a callsign, not your real name, email, or other personal information.</p>
        {props.publicLeaderboardError ? (
          <p role="alert" className="mt-2 text-sm text-alert">{props.publicLeaderboardError}</p>
        ) : null}
        <button
          type="button"
          data-testid="button-save-leaderboard-preference"
          disabled={props.publicLeaderboardSaving || (enabled && !validCallsign)}
          onClick={() => props.onSavePublicLeaderboard(enabled, callsign.trim())}
          className="mt-3 h-11 border border-solar px-3 font-hud tracking-widest text-solar disabled:opacity-40"
        >
          {props.publicLeaderboardSaving ? "SAVING…" : enabled ? "OPT IN AND SAVE" : "OPT OUT AND SAVE"}
        </button>
      </section>
      <ReadOnlyProfileCheck save={props.profile} signedIn={props.signedIn} />
      <Back onAction={props.onAction} />
    </div>
  );
}

function Loading({ tip, ship }: { tip: string; ship: string }) {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 pb-8">
      <p className="font-hud text-sm tracking-widest text-solar">{ship.toUpperCase()} · LAUNCH</p>
      <p className="max-w-md text-sm leading-relaxed text-bone">{tip}</p>
      <div className="h-1 w-full max-w-md overflow-hidden bg-bone/20">
        <div className="wfm-pulse h-full w-1/2 animate-pulse bg-solar" />
      </div>
    </div>
  );
}

function Back({ onAction }: { onAction: (action: MenuAction) => void }) {
  return (
    <button
      type="button"
      className="min-h-11 w-full max-w-xs border border-bone/30 bg-void/70 font-hud tracking-widest text-bone"
      onClick={() => onAction("BACK")}
    >
      BACK
    </button>
  );
}

function Pick({ on, label, detail, click, mark }: { on: boolean; label: string; detail: string; click: () => void; mark?: Faction }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={click}
      className={`flex min-h-14 min-w-0 items-center gap-2 px-3 py-1 text-left ${on ? "bg-solar text-void" : "wfm-glass border border-bone/25 text-bone"}`}
    >
      {mark ? <FactionMark faction={mark} className={`h-9 w-9 rounded-sm ${on ? "bg-void p-0.5" : ""}`} /> : null}
      <span className="min-w-0">
        <span className="block font-hud text-lg leading-none">{label}</span>
        <span className={on ? "text-xs text-void/80" : "text-xs text-muted"}>{detail}</span>
      </span>
    </button>
  );
}

function HullBay({ faction, ship, onShip, isSaved }: Pick<HomeProps, "faction" | "ship" | "onShip"> & { isSaved: boolean }) {
  const sel = SHIPS[ship];
  const accord = faction === "accord";
  const tone = accord ? "text-solar" : "text-spectral";
  const ring = accord ? "border-solar" : "border-spectral";
  return (
    <div className="grid max-w-3xl gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <CommandPanel className="p-3" data-testid="panel-selected-hull" data-ship-id={ship}>
        <PanelLabel tone={accord ? "solar" : "spectral"}>SELECTED HULL · {FACTION_NAME[faction]}</PanelLabel>
        <HangarShip ship={ship} faction={faction} isSaved={isSaved} />
        <p data-testid="text-armory-selected-ship" className="font-hud text-3xl leading-none tracking-wide">{sel.name.toUpperCase()}</p>
        <p className={`mt-1 font-hud text-xs tracking-[0.2em] ${tone}`}>{sel.role.toUpperCase()} · ULT {sel.ultName.toUpperCase()}</p>
        <p className="mt-2 text-sm leading-relaxed text-bone/85">{sel.blurb}</p>
        <dl className="mt-3 grid grid-cols-2 gap-px border border-bone/10 bg-bone/10 font-hud sm:grid-cols-3">
          {([
            ["SHIELD", sel.shield],
            ["HULL", sel.hull],
            ["SPEED", sel.maxSpeed],
            ["THRUST", sel.accel],
            ["PULSE DMG", sel.shotDmg],
            ["SHOT RATE", `${(1 / sel.fireInterval).toFixed(1)}/s`],
          ] as const).map(([k, v]) => (
            <div key={k} className="bg-panel px-2 py-1.5">
              <dt className="text-[9px] tracking-[0.2em] text-muted">{k}</dt>
              <dd className="text-lg leading-none">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 font-hud text-[10px] tracking-[0.16em] text-muted">
          SPECIAL SYSTEM · {sel.ultName.toUpperCase()} · {sel.ultCd}s CYCLE
        </p>
      </CommandPanel>
      <div className="grid grid-cols-2 content-start gap-2" role="group" aria-label={`${FACTION_NAME[faction]} hulls`}>
        {ROSTER[faction].map((id) => {
          const def = SHIPS[id];
          const on = id === ship;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onShip(id)}
              data-testid={`card-ship-${id}`}
              data-ship-id={id}
              className={`wfm-glass flex min-h-11 min-w-0 flex-col border bg-void/60 p-2 text-left text-bone transition-transform active:scale-[0.98] ${on ? `${ring} border-2` : "border-bone/20"}`}
            >
              <ShipIllustration ship={id} caption={false} grid={false} className={`mx-auto h-20 w-20 ${on ? "" : "opacity-70"}`} />
              <span className="mt-1 flex items-center justify-between gap-1">
                <span className="truncate font-hud text-base leading-none">{def.name.toUpperCase()}</span>
                {on ? <span className={`font-hud text-[9px] tracking-widest ${tone}`}>ACTIVE</span> : null}
              </span>
              <span className="text-[11px] text-muted">{def.role} · {def.ultShort}</span>
              <span className="mt-1 font-hud text-[10px] tracking-wider text-bone/70">SH {def.shield} · HL {def.hull} · SPD {def.maxSpeed}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
