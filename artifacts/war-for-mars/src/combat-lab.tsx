import { createRoot } from "react-dom/client";
import { lazy, Suspense, useState } from "react";
import { ErrorBoundary } from "./components/error-boundary";
import { ROSTER, SHIPS, type Faction, type ShipId } from "./game/ships";
import { unlockAudio } from "./game/audio";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { OrbitalChart } from "./game/OrbitalChart";
import { DESTINATIONS, STATUS_LABEL, localFactionBrief } from "./game/universe-destinations";
import "./index.css";
import "./game/combat-lab.css";
import "./game/orbital-universe.css";
const Arena = lazy(() => import("./game/Arena").then((m) => ({ default: m.Arena })));
const CinderRingDockingApproach = lazy(() => import("./game/CinderRingDockingApproach").then((m) => ({ default: m.CinderRingDockingApproach })));

type Mode = "entry" | "arena" | "approach";
const HUB = `${import.meta.env.BASE_URL}universe`;

function CombatLab() {
  const [faction, setFaction] = useState<Faction>("ussf");
  const [ship, setShip] = useState<ShipId>("duskbreaker");
  const [mode, setMode] = useState<Mode>("entry");
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState("");
  const [destId, setDestId] = useState("mars-orbit");
  const dest = DESTINATIONS.find((d) => d.id === destId) ?? DESTINATIONS[0];
  const loading = (t: string) => <main className="lab-loading">{t}</main>;

  if (mode === "arena") return <div className="combat-lab"><Suspense fallback={loading("Loading flight systems…")}><Arena key={run} modeId="orbital-combat-lab" runtime={ORBITAL_RUNTIME_ID} shipId={ship} faction={faction} scheme="arc" refit={0} pace="practice" goal="disc" disc="rust" allyCount={1} foeCount={3} objective="MARS ORBIT · COMBAT LAB" tech={null} serverSeed={1938} gyro={false} drilled onDrill={() => {}} onNetworkExit={() => { throw new Error("The offline Combat Lab must not open a network session."); }} onDone={(result) => { setSummary(`Mars Orbit training complete. ${result.kills} defenders destroyed. ${result.reason}`); setMode("entry"); }} /></Suspense></div>;
  if (mode === "approach") return <div className="combat-lab"><Suspense fallback={loading("Plotting Cinder Ring approach…")}><CinderRingDockingApproach shipId={ship} faction={faction} onDock={() => { setSummary("Local docking at Cinder Ring complete. This practice approach does not admit you to a match or grant rewards. Station services live on the signed-in account hub."); setMode("entry"); }} onAbort={() => { setSummary("Cinder Ring approach aborted. No progress was recorded."); setMode("entry"); }} /></Suspense></div>;

  const launch = () => {
    if (dest.status === "planned") return;
    unlockAudio();
    setSummary("");
    if (dest.status === "training") { setRun((r) => r + 1); setMode("arena"); } else setMode("approach");
  };

  return <div className="combat-lab uv">
    <div className="uv-grain" aria-hidden="true" />
    <header className="uv-top">
      <div><p className="uv-eyebrow">WFM / ORBITAL NAVIGATION</p><h1 className="uv-title">WAR FOR MARS<span>THE INFINITE WAR</span></h1></div>
      <p className="uv-offline" data-testid="text-offline-scope">OFFLINE ENTRY · THIS SCREEN IS NOT UNIVERSE AUTHORITY</p>
    </header>
    <main className="uv-grid">
      <section className="uv-map" aria-label="Orbital chart">
        <OrbitalChart selected={destId} onSelect={setDestId} />
        <p className="uv-map__hint">Arrow keys or tap to select a destination</p>
      </section>
      <section className="uv-brief" aria-live="polite" key={dest.id}>
        <p className={`uv-status uv-status--${dest.status}`} data-testid="status-destination">{STATUS_LABEL[dest.status]}</p>
        <h2 className="uv-dest" data-testid="text-destination-name">{dest.name}</h2>
        <p className="uv-kind">{dest.kind}</p>
        <p className="uv-copy">{dest.summary}</p>
        <p className="uv-copy" data-testid="text-faction-brief">{localFactionBrief(faction, dest.status)}</p>
        <ul className="uv-detail">{dest.detail.map((d) => <li key={d}>{d}</li>)}</ul>

        <fieldset className="uv-loadout" disabled={dest.status === "planned"}>
          <legend>PILOT LOADOUT</legend>
          <div className="lab-factions">{(["ussf", "accord"] as const).map((f) => <button key={f} type="button" data-testid={`button-faction-${f}`} aria-pressed={faction === f} onClick={() => { setFaction(f); setShip(ROSTER[f][0]); }}>{f.toUpperCase()}</button>)}</div>
          <label className="lab-ship-label">AIRFRAME<select data-testid="select-ship" value={ship} onChange={(event) => setShip(event.target.value as ShipId)}>{ROSTER[faction].map((id) => <option key={id} value={id}>{SHIPS[id].name} · {SHIPS[id].role}</option>)}</select></label>
        </fieldset>

        {dest.status === "training" ? <button data-testid="button-launch-combat-lab" className="uv-launch" onClick={launch}>LAUNCH TRAINING</button>
          : dest.status === "approach" ? <button data-testid="button-launch-cinder-approach" className="uv-launch uv-launch--approach" onClick={launch}>BEGIN LOCAL APPROACH</button>
          : <button className="uv-launch" disabled data-testid="button-destination-unavailable">NOT YET CHARTED</button>}
        {summary ? <p role="status" className="lab-summary" data-testid="status-summary">{summary}</p> : null}

        <a className="uv-hub" href={HUB} data-testid="link-account-hub"><b>OPEN ACCOUNT & UNIVERSE SERVICES</b><span>Sign-in required. Location, queue and match eligibility are decided by the server, not this screen.</span></a>
      </section>
    </main>
    <footer className="lab-rules uv-rules"><b>FLIGHT</b><span>W/S thrust · A/D yaw · I/K pitch · Q/E roll · Z/X slide · C/V lift</span><b>COMBAT</b><span>Space fire · R cycle targets · M guided missile</span><b>ASSISTS</b><span>Shift boost · B brake · G inertia · H aim assist · P pause</span></footer>
  </div>;
}
createRoot(document.getElementById("root")!).render(<ErrorBoundary><CombatLab /></ErrorBoundary>);
