import { CINDER_STATION, type DockEvaluation, type UniverseSession } from "./orbital-universe-session";
import { CinderRingOperationPreview } from "./CinderRingOperationPreview";

type Props = {
  session: UniverseSession;
  dock: DockEvaluation | null;
  rendererReady: boolean;
  graphicsError: string | null;
  servicesHref: string;
  onOpenOperations?: () => void;
  onDock: () => void;
  onUndock: () => void;
  onLaunchTraining: () => void;
  onAbortTraining: () => void;
  onReturn: () => void;
  onExit: () => void;
};

const REASON: Record<DockEvaluation["reason"], string> = {
  ready: "DOCKING CLEARED",
  range: "FLY INTO THE RING",
  closure: "TOO FAST · BRAKE",
  heading: "ALIGN NOSE WITH RING",
  inactive: "FLIGHT OFFLINE",
};

const panel = "pointer-events-auto border border-bone/15 bg-void/85 backdrop-blur-sm";
const btn = "min-h-11 px-4 font-hud tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/** HUD + station panels for the local Orbital universe. Presentation only; Arena owns all state effects. */
export function UniverseStationOverlay(p: Props) {
  const { session, dock } = p;
  const scope = "LOCAL · OFFLINE · NO REWARDS";

  if (p.graphicsError) {
    return (
      <div className="absolute inset-0 z-50 overflow-y-auto bg-void/90 p-4" data-testid="universe-graphics-error">
        <div className={`${panel} mx-auto max-w-sm p-5`}>
          <p className="font-hud text-xs tracking-[0.2em] text-alert">RENDERER UNAVAILABLE</p>
          <p className="mt-2 text-sm text-bone/80">WebGL could not start, so the local universe cannot be flown on this device. Nothing was recorded.</p>
          <button type="button" data-testid="button-universe-exit" className={`${btn} mt-4 w-full border border-bone/30 text-bone`} onClick={p.onExit}>LEAVE UNIVERSE</button>
        </div>
      </div>
    );
  }

  if (session.phase === "exploration") {
    const ready = Boolean(dock?.eligible) && p.rendererReady;
    return (
      <div className="pointer-events-none absolute inset-0 z-30" data-testid="universe-exploration-hud" data-universe-phase="exploration">
        <div className="absolute inset-x-0 top-2 flex justify-center px-3">
          <div className={`${panel} pointer-events-auto flex w-full max-w-[20rem] items-center gap-2 px-2 py-1`}>
            <div className="min-w-0 flex-1">
              <p className="font-hud text-[11px] tracking-widest text-solar">CINDER RING</p>
              <p className="font-hud text-[9px] text-muted" data-testid="text-universe-scope">{scope}</p>
              <p className="font-hud text-xs tracking-wider text-bone/80" data-testid="text-dock-telemetry">
                {dock ? `${Math.round(dock.distance)} M · ${dock.closure.toFixed(1)}/${CINDER_STATION.maxClosureSpeed} M/S · ${Math.round(dock.headingDeg)}°` : "ACQUIRING"}
              </p>
              <p className={`font-hud text-[11px] tracking-widest ${ready ? "text-solar" : "text-bone/60"}`} data-testid="status-dock-gate">
                {p.rendererReady ? (dock ? REASON[dock.reason] : "ACQUIRING") : "RENDERER STARTING"}
              </p>
            </div>
            <button type="button" data-testid="button-universe-dock" disabled={!ready} onClick={p.onDock}
              className={`${btn} px-3 ${ready ? "bg-solar text-void" : "border border-bone/20 text-bone"}`}>DOCK</button>
            <button type="button" data-testid="button-universe-exit" onClick={p.onExit} aria-label="Leave local universe"
              className="min-h-11 min-w-11 font-hud text-[10px] tracking-widest text-muted hover:text-bone">EXIT</button>
          </div>
        </div>
        {dock && dock.distance <= 90 ? (
          <div className="absolute left-3 top-24 w-[min(18rem,calc(100vw-1.5rem))]">
            <CinderRingOperationPreview />
          </div>
        ) : null}
      </div>
    );
  }

  if (session.phase === "training") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center px-3" data-universe-phase="training">
        <div className={`${panel} flex items-center gap-3 px-3 py-1.5`}>
          <p className="font-hud text-[10px] tracking-[0.2em] text-solar" data-testid="text-universe-training">CINDER TRAINING · LOCAL · NO REWARDS</p>
          <button type="button" data-testid="button-universe-abort-training" onClick={p.onAbortTraining}
            className="min-h-11 border border-alert/50 px-3 font-hud text-[11px] tracking-widest text-alert">ABORT</button>
        </div>
      </div>
    );
  }

  const debrief = session.phase === "debrief" ? session.debrief : null;
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto overscroll-contain bg-void/70 p-3 sm:p-4" data-universe-phase={session.phase} data-testid="universe-station-panel">
      <div className={`${panel} mx-auto my-auto w-full max-w-md border-l-2 border-l-solar p-4 sm:p-5`}>
        <p className="font-hud text-[10px] tracking-[0.22em] text-muted">{scope}</p>
        {debrief ? (
          <>
            <h2 className="mt-1 font-hud text-3xl leading-none tracking-wide" data-testid="text-universe-debrief">
              {debrief.outcome === "win" ? "TRAINING CLEARED" : debrief.outcome === "aborted" ? "TRAINING ABORTED" : "TRAINING ENDED"}
            </h2>
            <p className="mt-2 font-hud text-sm tracking-widest text-solar">{debrief.kills} DEFENDERS DOWN · NO REWARDS ISSUED</p>
            <p className="mt-2 text-sm leading-relaxed text-bone/80" data-testid="text-universe-debrief-reason">{debrief.reason}</p>
            <button type="button" data-testid="button-universe-return" onClick={p.onReturn} className={`${btn} mt-5 w-full bg-solar text-void`}>RETURN TO CINDER RING</button>
          </>
        ) : (
          <>
            <h2 className="mt-1 font-hud text-3xl leading-none tracking-wide" data-testid="text-universe-docked">DOCKED · CINDER RING</h2>
            <p className="mt-2 text-sm text-bone/75">Flight is held at the clamp. Your position and velocity are kept for undock{session.trainingRuns ? ` · training runs this session: ${session.trainingRuns}` : ""}.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" data-testid="button-universe-launch-training" onClick={p.onLaunchTraining}
                className={`${btn} flex min-h-14 flex-col items-start justify-center bg-solar text-left text-void`}>
                <span>LAUNCH COMBAT TRAINING</span><span className="font-sans text-xs tracking-normal text-void/75">Three defenders · local rules · returns here</span>
              </button>
              <button type="button" data-testid="button-universe-undock" onClick={p.onUndock}
                className={`${btn} border border-solar/60 text-solar`}>UNDOCK</button>
              <CinderRingOperationPreview />
              {p.onOpenOperations ? (
                <button type="button" data-testid="button-open-account-operations" onClick={p.onOpenOperations}
                  className="flex min-h-12 flex-col justify-center border border-bone/20 px-4 text-left text-bone hover:border-solar/60">
                  <span className="font-hud text-sm tracking-widest">OPEN ACCOUNT OPERATIONS</span>
                  <span className="text-xs text-muted">Listings are public; travel and match access still require server authorization.</span>
                </button>
              ) : (
                <a href={p.servicesHref} data-testid="link-universe-account-services"
                  className="flex min-h-12 flex-col justify-center border border-bone/20 px-4 text-bone hover:border-bone/40">
                  <span className="font-hud text-sm tracking-widest">ACCOUNT SERVICES · EXTERNAL</span>
                  <span className="text-xs text-muted">Leaves this local session. Sign-in, queues and match seats are server-decided; this dock grants none.</span>
                </a>
              )}
              <button type="button" data-testid="button-universe-exit-docked" onClick={p.onExit}
                className="min-h-11 font-hud text-xs tracking-widest text-muted hover:text-bone">LEAVE UNIVERSE</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
