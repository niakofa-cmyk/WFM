import { createRoot } from "react-dom/client";
import { lazy, Suspense, useState } from "react";
import { ErrorBoundary } from "./components/error-boundary";
import { ROSTER, SHIPS, type Faction, type ShipId } from "./game/ships";
import { unlockAudio } from "./game/audio";
import "./index.css";
import "./game/combat-lab.css";
const Arena = lazy(() => import("./game/Arena").then((m) => ({ default: m.Arena })));

function CombatLab() {
  const [faction, setFaction] = useState<Faction>("ussf");
  const [ship, setShip] = useState<ShipId>("duskbreaker");
  const [active, setActive] = useState(false);
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState("");
  return <div className="combat-lab">
    {active ? <Suspense fallback={<main className="lab-loading">Loading flight systems…</main>}><Arena key={run} orbital shipId={ship} faction={faction} scheme="arc" refit={0} pace="practice" goal="disc" disc="rust" allyCount={1} foeCount={3} objective="MARS ORBIT · COMBAT LAB" tech={null} serverSeed={1938} gyro={false} drilled onDrill={() => {}} onNetworkExit={() => { throw new Error("The offline Combat Lab must not open a network session."); }} onDone={(result) => { setSummary(`${result.kills} defenders destroyed. ${result.reason}`); setActive(false); }} /></Suspense> : <main className="lab-brief">
      <div className="lab-art" aria-hidden="true"><div className="lab-orbit"/><div className="lab-planet"/><p>THE MARS THEATER<br/><strong>SECTOR 04 / PHOBOS APPROACH</strong></p></div>
      <section className="lab-actions"><p className="lab-eyebrow">WFM / EXPERIMENTAL FLIGHT PROGRAM</p><h1>WAR<br/>FOR MARS<span>THE INFINITE WAR</span></h1><p className="lab-tag">COMBAT LAB — OFFLINE</p><p className="lab-copy">Intercept three hostile defenders in Mars orbit. Select a target, hold it inside your nose cone, and launch when lock reaches 100%.</p>
        <div className="lab-factions">{(["ussf", "accord"] as const).map((f) => <button key={f} aria-pressed={faction === f} onClick={() => { setFaction(f); setShip(ROSTER[f][0]); }}>{f.toUpperCase()}</button>)}</div>
        <label className="lab-ship-label">AIRFRAME<select value={ship} onChange={(event) => setShip(event.target.value as ShipId)}>{ROSTER[faction].map((id) => <option key={id} value={id}>{SHIPS[id].name} · {SHIPS[id].role}</option>)}</select></label>
        <p className="lab-readiness">✓ LOCAL SYSTEMS READY · NO BACKEND REQUIRED</p>
        <button className="lab-launch" onClick={() => { unlockAudio(); setRun((r) => r + 1); setActive(true); }}>LAUNCH OPERATION ↗</button>
        <p className="lab-disclaimer">AI opponents. No matchmaking, account session, rewards, or campaign writes. Existing live services remain separate.</p>{summary ? <p role="status" className="lab-summary">{summary}</p> : null}
      </section>
      <footer className="lab-rules"><b>FLIGHT</b><span>W/S thrust · A/D yaw · I/K pitch · Q/E roll · Z/X slide · C/V lift</span><b>COMBAT</b><span>Space fire · R cycle targets · M guided missile</span><b>ASSISTS</b><span>Shift boost · B brake · G inertia · H aim assist · P pause</span></footer>
    </main>}
  </div>;
}
createRoot(document.getElementById("root")!).render(<ErrorBoundary><CombatLab /></ErrorBoundary>);
