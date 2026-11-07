import { lazy, Suspense, useState } from "react";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { ROSTER, SHIPS, type Faction, type ShipId } from "./ships";
import { unlockAudio } from "./audio";
import { OrbitalChart } from "./OrbitalChart";
import { MarsAdventureAtlas } from "./MarsAdventureAtlas";
import { OrbitalFlightPreview } from "./OrbitalFlightPreview";
import { DESTINATIONS, STATUS_LABEL, localFactionBrief } from "./universe-destinations";
import type { FlightState } from "./flight-sector";
import "./combat-lab.css";
import "./orbital-universe.css";

const Arena = lazy(() => import("./Arena").then((m) => ({ default: m.Arena })));
const CinderRingDockingApproach = lazy(() => import("./CinderRingDockingApproach").then((m) => ({ default: m.CinderRingDockingApproach })));
type Mode = "entry" | "arena" | "approach" | "universe";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const HUB = `${BASE}/universe`;

/** Shared primary boot and compatibility Lab entry; one flight implementation. */
export function OrbitalBoot({ standalone = false }: { standalone?: boolean }) {
  const [faction, setFaction] = useState<Faction>("ussf");
  const [ship, setShip] = useState<ShipId>("duskbreaker");
  const [mode, setMode] = useState<Mode>(() => new URLSearchParams(window.location.search).get("universe") === "1" ? "universe" : "entry");
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState("");
  const [trainingReturnSnapshot, setTrainingReturnSnapshot] = useState<FlightState | null>(null);
  const [destId, setDestId] = useState("mars-orbit");
  const dest = DESTINATIONS.find((d) => d.id === destId) ?? DESTINATIONS[0];
  const startLocation = dest.id === "cinder-ring" ? "cinder-ring" : "mars-orbit";
  const loading = (text: string) => <main role="status" className="lab-loading">{text}</main>;

  if (mode === "arena") return <div className="combat-lab"><Suspense fallback={loading("Loading flight systems…")}><Arena key={run} modeId="orbital-combat-lab" runtime={ORBITAL_RUNTIME_ID} shipId={ship} faction={faction} scheme="arc" refit={0} pace="practice" goal="disc" disc="rust" allyCount={1} foeCount={3} objective="MARS ORBIT · COMBAT LAB" tech={null} serverSeed={1938} gyro={false} drilled onDrill={() => {}} onNetworkExit={() => { throw new Error("Offline training must not open a network session."); }} onDone={(result) => { setSummary(`Mars Orbit training complete. ${result.kills} defenders destroyed. ${result.reason}`); setMode("entry"); }} /></Suspense></div>;
  if (mode === "universe") return <div className="combat-lab"><Suspense fallback={loading("Entering local Mars sector…")}><Arena key={`u${run}`} modeId="orbital-universe-local" runtime={ORBITAL_RUNTIME_ID} shipId={ship} faction={faction} scheme="arc" refit={0} pace="practice" goal="disc" disc="rust" allyCount={1} foeCount={3} objective="CINDER RING · LOCAL TRAINING" tech={null} serverSeed={1938} gyro={false} drilled onDrill={() => {}} localUniverse={{ startLocation, servicesHref: HUB, onExit: () => { setSummary("Left the local universe. Nothing was saved or rewarded."); setMode("entry"); } }} onNetworkExit={() => { throw new Error("Local flight must not open a network session."); }} onDone={() => setMode("entry")} /></Suspense></div>;
  if (mode === "approach") return <div className="combat-lab"><Suspense fallback={loading("Plotting Cinder Ring approach…")}><CinderRingDockingApproach shipId={ship} faction={faction} onDock={() => { setSummary("Local docking complete. Account services validate location, match entry and rewards separately."); setMode("entry"); }} onAbort={() => { setSummary("Approach aborted. No progress recorded."); setMode("entry"); }} /></Suspense></div>;

  const launch = () => {
    if (dest.status === "planned") return;
    unlockAudio();
    setSummary("");
    setTrainingReturnSnapshot(null);
    setRun((value) => value + 1);
    // The primary game enters the same spatial universe for every destination.
    // The separate Lab/approach scenes remain only as explicit standalone rollback paths.
    setMode(standalone ? (dest.status === "training" ? "arena" : "approach") : "universe");
  };
  return <div className="combat-lab uv" data-testid="orbital-primary-boot">
    <div className="uv-grain" aria-hidden="true" />
    <header className="uv-top">
      <div><p className="uv-eyebrow">WFM / ORBITAL UNIVERSE</p><h1 className="uv-title">WAR FOR MARS<span>THE INFINITE WAR</span></h1></div>
      <p className="uv-offline" data-testid="text-offline-scope">{standalone ? "OFFLINE LAB · COMPATIBILITY ENTRY" : "ORBITAL PRIMARY BOOT · LOCAL FLIGHT PROFILE"}</p>
    </header>
    <main className="uv-grid">
      <section className="uv-map" aria-label="Orbital chart">
        <OrbitalChart selected={destId} onSelect={(next) => { setDestId(next); setTrainingReturnSnapshot(null); }} />
        <p className="uv-map__hint">Arrow keys or tap to select a destination</p>
        <OrbitalFlightPreview
          shipId={ship}
          faction={faction}
          servicesHref={HUB}
          trainingReturnSnapshot={trainingReturnSnapshot}
          onTrainingReturnConsumed={() => setTrainingReturnSnapshot(null)}
          onLaunchTraining={(snapshot) => {
            setTrainingReturnSnapshot(snapshot);
            setSummary("");
            setRun((value) => value + 1);
            setMode("arena");
          }}
        />
      </section>
      <section className="uv-brief" aria-live="polite" key={dest.id}>
        <p className={`uv-status uv-status--${dest.status}`} data-testid="status-destination">{STATUS_LABEL[dest.status]}</p>
        <h2 className="uv-dest" data-testid="text-destination-name">{dest.name}</h2>
        <p className="uv-kind">{dest.kind}</p>
        <p className="uv-copy">{dest.summary}</p>
        <p className="uv-copy" data-testid="text-faction-brief">{localFactionBrief(faction, dest.status)}</p>
        <ul className="uv-detail">{dest.detail.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        <MarsAdventureAtlas />
        <fieldset className="uv-loadout" disabled={dest.status === "planned"}>
          <legend>PILOT LOADOUT</legend>
          <div className="lab-factions">{(["ussf", "accord"] as const).map((value) => <button key={value} type="button" data-testid={`button-faction-${value}`} aria-pressed={faction === value} onClick={() => { setFaction(value); setShip(ROSTER[value][0]); setTrainingReturnSnapshot(null); }}>{value.toUpperCase()}</button>)}</div>
          <label className="lab-ship-label">AIRFRAME<select data-testid="select-ship" value={ship} onChange={(event) => { setShip(event.target.value as ShipId); setTrainingReturnSnapshot(null); }}>{ROSTER[faction].map((id) => <option key={id} value={id}>{SHIPS[id].name} · {SHIPS[id].role}</option>)}</select></label>
        </fieldset>
        <button data-testid="button-launch-local-universe" className="uv-launch" disabled={dest.status === "planned"}
          onClick={() => { unlockAudio(); setSummary(""); setTrainingReturnSnapshot(null); setRun((value) => value + 1); setMode("universe"); }}>
          {dest.id === "cinder-ring" ? "APPROACH CINDER · ORBITAL UNIVERSE" : "ENTER MARS ORBIT · ORBITAL UNIVERSE"}
        </button>
        <p className="uv-map__hint" data-testid="text-local-universe-scope">Current flight profile: session-only sandbox, no rewards or shared ships. Authenticated universe encounters and rewards require server authority.</p>
        {!standalone ? <p className="uv-map__hint">Combat training is a station activity at Cinder Ring inside this same flight session.</p>
          : dest.status === "training" ? <button data-testid="button-launch-combat-lab" className="uv-launch" onClick={launch}>LAUNCH COMPATIBILITY TRAINING</button>
            : dest.status === "approach" ? <button data-testid="button-launch-cinder-approach" className="uv-launch uv-launch--approach" onClick={launch}>CINDER APPROACH · COMPATIBILITY</button>
              : <button className="uv-launch" disabled data-testid="button-destination-unavailable">NOT YET CHARTED</button>}
        {summary ? <p role="status" className="lab-summary" data-testid="status-summary">{summary}</p> : null}
        <a className="uv-hub" href={HUB} data-testid="link-account-hub"><b>OPEN ACCOUNT & UNIVERSE SERVICES</b><span>Sign-in required. Saved location, queue and match eligibility remain server-owned.</span></a>
        <a className="uv-hub" href={`${BASE}/command`} data-testid="link-compatibility-command"><b>COMPATIBILITY COMMAND CENTER</b><span>Existing campaign, hangar, Wing and account workflows.</span></a>
      </section>
    </main>
    <footer className="lab-rules uv-rules"><b>FLIGHT</b><span>W/S thrust · A/D yaw · I/K pitch · Q/E roll · Z/X slide · Mobile: two-thumb flight controls</span></footer>
  </div>;
}
