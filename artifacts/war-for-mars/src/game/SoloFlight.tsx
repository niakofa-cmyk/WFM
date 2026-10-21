import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { unlockAudio } from "./audio";
import { armGyro, disarmGyro } from "./gyro";
import { ROSTER, SHIPS, type Faction, type ShipId } from "./ships";
import type { Pace } from "./sim";
import type { StrikeResult } from "./Arena";

const Arena = lazy(() => import("./Arena").then((module) => ({ default: module.Arena })));

const FACTIONS: Faction[] = ["ussf", "accord"];
const FACTION_NAME: Record<Faction, string> = { ussf: "USSF", accord: "Accord" };
const PACES: Array<{ id: Pace; name: string; time: string; ally: number; foe: number }> = [
  { id: "practice", name: "Practice", time: "Two minutes", ally: 2, foe: 3 },
  { id: "strike", name: "Strike", time: "Six minutes", ally: 4, foe: 5 },
];

const css = `
.sf{min-height:100dvh;background:#140a07;color:#f1dfd0;font-family:inherit;padding:20px 16px 40px;display:flex;flex-direction:column;align-items:center}
.sf *{box-sizing:border-box}
.sf-wrap{width:100%;max-width:880px}
.sf h1{font-size:clamp(28px,7vw,52px);letter-spacing:.14em;margin:6px 0 8px;text-transform:uppercase}
.sf h2{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#e0833f;margin:26px 0 10px}
.sf-note{border:1px solid #6b3a22;background:#24120c;padding:12px 14px;font-size:14px;line-height:1.5;margin:12px 0}
.sf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.sf-btn{cursor:pointer;text-align:left;border:1px solid #5a3322;background:#1d0f0a;color:inherit;padding:12px;min-height:44px;font:inherit}
.sf-btn:hover{border-color:#e0833f}
.sf-btn:focus-visible{outline:2px solid #f4b266;outline-offset:2px}
.sf-btn[aria-pressed="true"]{border-color:#f4b266;background:#3a1c10}
.sf-btn b{display:block;letter-spacing:.1em;text-transform:uppercase}
.sf-btn small{display:block;opacity:.75;margin-top:4px;line-height:1.4}
.sf-go{background:#e0833f;color:#1a0b05;font-weight:700;letter-spacing:.2em;text-transform:uppercase;text-align:center;border-color:#e0833f;margin-top:24px;width:100%;padding:16px}
.sf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
.sf-stats div{border:1px solid #5a3322;padding:12px;text-align:center}
.sf-stats strong{display:block;font-size:28px}
.sf-row{display:flex;gap:10px;flex-wrap:wrap}
.sf-row .sf-btn{flex:1;text-align:center;min-width:140px}
`;

export function SoloFlight({ onExit }: { onExit?: () => void } = {}) {
  const [phase, setPhase] = useState<"setup" | "fly" | "done">("setup");
  const [ship, setShip] = useState<ShipId>("duskbreaker");
  const [pace, setPace] = useState<Pace>("practice");
  const [gyro, setGyro] = useState(false);
  const [gyroMsg, setGyroMsg] = useState("");
  const [gyroBusy, setGyroBusy] = useState(false);
  const mounted = useRef(true);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<StrikeResult | null>(null);
  const [flightError, setFlightError] = useState("");

  const def = SHIPS[ship];
  const cfg = PACES.find((p) => p.id === pace) ?? PACES[0];

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; disarmGyro(); };
  }, []);

  const launch = () => {
    setFlightError("");
    unlockAudio();
    setResult(null);
    setRun((n) => n + 1);
    setPhase("fly");
  };

  const toggleGyro = async () => {
    if (gyroBusy) return;
    if (gyro) {
      disarmGyro();
      setGyro(false);
      setGyroMsg("Tilt aiming off. Touch controls only.");
      return;
    }
    setGyroBusy(true);
    const ok = await armGyro();
    if (!mounted.current) { disarmGyro(); return; }
    setGyroBusy(false);
    setGyro(ok);
    setGyroMsg(ok ? "Tilt aiming armed." : "Tilt aiming unavailable or permission denied. Touch controls remain active.");
  };

  const home = () => {
    if (onExit) onExit();
    else window.location.assign(import.meta.env.BASE_URL || "/");
  };

  if (phase === "fly") {
    return (
      <div>
      <Suspense fallback={<div className="sf" role="status">Loading combat systems...<style>{css}</style></div>}>
        <Arena
          key={run}
          shipId={ship}
          faction={def.faction}
          scheme="arc"
          refit={0}
          shieldMk2={false}
          pace={pace}
          goal="disc"
          disc="rust"
          allyCount={cfg.ally}
          foeCount={cfg.foe}
          objective="HOLD TWO RELAYS"
          tech={null}
          gyro={gyro}
          drilled={true}
          onDrill={() => {}}
          onDone={(r) => {
            setResult(r);
            setPhase("done");
          }}
          onNetworkExit={() => setPhase("setup")}
          onGraphicsError={(message) => {
            setFlightError(`3D flight could not start: ${message}. This game requires WebGL2. Check your browser's graphics settings or try a supported browser/device.`);
            setPhase("setup");
          }}
        />
      </Suspense>
      <button
        className="fixed left-3 z-[110] border border-bone/30 bg-void/90 px-3 py-2 font-hud text-xs tracking-widest text-bone"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        onClick={() => setPhase("setup")}
      >EXIT SOLO FLIGHT</button>
      </div>
    );
  }

  return (
    <main className="sf" data-testid="solo-flight">
      <style>{css}</style>
      <div className="sf-wrap">
        <h1>Solo Flight</h1>
        <p className="sf-note" data-testid="text-solo-notice">
          Local solo flight needs no account and no multiplayer server. These trials do not save campaign progress or award rewards.
        </p>
        {flightError && <p role="alert" className="sf-note">{flightError}</p>}

        {phase === "done" && result && (
          <section aria-live="polite" data-testid="panel-solo-result">
            <h2>Result</h2>
            <p style={{ fontSize: 24, margin: 0, textTransform: "uppercase", letterSpacing: ".12em" }} data-testid="text-solo-outcome">
              {result.outcome === "win" ? "Victory" : result.outcome === "loss" ? "Defeat" : "Draw"}
            </p>
            <p data-testid="text-solo-reason">{result.reason}</p>
            <div className="sf-stats">
              <div><strong data-testid="text-solo-kills">{result.kills}</strong>Kills</div>
              <div><strong data-testid="text-solo-deaths">{result.deaths}</strong>Deaths</div>
              <div><strong data-testid="text-solo-relays">{result.relays}</strong>Relays</div>
            </div>
            <div className="sf-row">
              <button className="sf-btn" data-testid="button-solo-retry" onClick={launch}>Retry</button>
              <button className="sf-btn" data-testid="button-solo-setup" onClick={() => setPhase("setup")}>Back to setup</button>
              <button className="sf-btn" data-testid="button-solo-home" onClick={home}>Home</button>
            </div>
          </section>
        )}

        {FACTIONS.map((f) => (
          <section key={f} aria-label={`${FACTION_NAME[f]} ships`}>
            <h2>{FACTION_NAME[f]}</h2>
            <div className="sf-grid">
              {ROSTER[f].map((id) => (
                <button key={id} className="sf-btn" aria-pressed={ship === id} data-testid={`button-ship-${id}`} onClick={() => setShip(id)}>
                  <b>{SHIPS[id].name}</b>
                  <small>{SHIPS[id].role} / {SHIPS[id].ultName}</small>
                  <small>{SHIPS[id].blurb}</small>
                </button>
              ))}
            </div>
          </section>
        ))}

        <h2>Trial</h2>
        <div className="sf-grid">
          {PACES.map((p) => (
            <button key={p.id} className="sf-btn" aria-pressed={pace === p.id} data-testid={`button-pace-${p.id}`} onClick={() => setPace(p.id)}>
              <b>{p.name}</b>
              <small>{p.time}. {p.ally} allies, {p.foe} enemies. Baseline ship, no upgrades.</small>
            </button>
          ))}
        </div>

        <h2>Controls</h2>
        <button className="sf-btn" aria-pressed={gyro} disabled={gyroBusy} data-testid="button-solo-gyro" onClick={() => void toggleGyro()}>
          <b>Tilt aiming: {gyro ? "On" : "Off"}</b>
          <small>Optional. Asks for motion permission only when you press this.</small>
        </button>
        <p role="status" aria-live="polite" style={{ fontSize: 14 }} data-testid="text-solo-gyro">{gyroMsg}</p>

        <button className="sf-btn sf-go" data-testid="button-solo-launch" onClick={launch}>
          Launch {def.name} / {cfg.name}
        </button>
        <button className="sf-btn" style={{ marginTop: 10, width: "100%", textAlign: "center" }} data-testid="button-solo-exit" onClick={home}>
          Return home
        </button>
      </div>
    </main>
  );
}
