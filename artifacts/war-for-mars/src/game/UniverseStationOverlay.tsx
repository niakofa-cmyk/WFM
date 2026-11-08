import * as React from "react";
import {
  CINDER_STATION,
  type UniverseDockEvaluation,
  type UniverseSession,
} from "./orbital-universe-session";
import { CinderRingOperationPreview } from "./CinderRingOperationPreview";
import { isOriginSector, sectorAddressKey, universeSectorContents } from "./universe-sectors";
import type { LocalAnomalyScan, LocalRelayInteraction } from "./orbital-universe-runtime";

type Props = {
  session: UniverseSession;
  dock: UniverseDockEvaluation | null;
  anomalyScan: LocalAnomalyScan | null;
  relayInteraction: LocalRelayInteraction | null;
  onScanAnomaly: () => void;
  onScanRelay: () => void;
  onRecoverRelay: () => void;
  rendererReady: boolean;
  graphicsError: string | null;
  servicesHref: string;
  sharedFlightJoined?: boolean;
  onOpenOperations?: () => void;
  onDock: () => void;
  onUndock: () => void;
  onLaunchTraining: () => void;
  onAbortTraining: () => void;
  onReturn: () => void;
  onExit: () => void;
};

const REASON: Record<UniverseDockEvaluation["reason"], string> = {
  ready: "DOCKING CLEARED",
  range: "FLY INTO THE RING",
  closure: "TOO FAST · BRAKE",
  heading: "ALIGN NOSE WITH RING",
  inactive: "FLIGHT OFFLINE",
};

const panel = "pointer-events-auto border border-bone/15 bg-void/85 backdrop-blur-sm";
const btn = "min-h-11 px-4 font-hud tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function formatDockDistance(distance: number, targetLabel: string) {
  if (distance >= 1_000_000_000) return `${targetLabel} · DISTANT SECTOR`;
  if (distance >= 1_000_000) return `${(distance / 1_000_000).toFixed(1)} M KM`;
  if (distance >= 10_000) return `${(distance / 1_000).toFixed(1)} KM`;
  return `${Math.round(distance)} M`;
}

/** HUD + station panels for the local Orbital universe. Presentation only; Arena owns all state effects. */
export function UniverseStationOverlay(p: Props) {
  const { session, dock, anomalyScan, relayInteraction } = p;
  const scope = session.phase === "exploration" && p.sharedFlightJoined
    ? "SHARED FLIGHT · SERVER AUTHORITY"
    : "LOCAL PRACTICE · NO REWARDS";

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
    const origin = isOriginSector(session.sectorAddress);
    const contents = universeSectorContents(session.sectorAddress);
    const nearDock = Boolean(dock && dock.distance <= 220);
    return (
      <div className="pointer-events-none absolute inset-0 z-30" data-testid="universe-exploration-hud" data-universe-phase="exploration">
        {nearDock && dock ? (
          <div className="absolute inset-x-0 top-3 flex justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-2 text-shadow" data-testid="universe-dock-readout">
              <span className="font-hud text-[10px] tracking-widest text-solar">DOCK TARGET · {dock.targetLabel}</span>
              <span className="font-hud text-[10px] tracking-wider text-bone/85" data-testid="text-dock-telemetry">
                {formatDockDistance(dock.distance, dock.targetLabel)}
              </span>
              <span className={`font-hud text-[9px] tracking-widest ${ready ? "text-solar" : "text-bone/65"}`} data-testid="status-dock-gate">
                {p.rendererReady ? REASON[dock.reason] : "RENDERER STARTING"}
              </span>
              <button type="button" data-testid="button-universe-dock" disabled={!ready} onClick={p.onDock}
                className={`${btn} min-h-10 px-3 ${ready ? "bg-solar text-void" : "border border-bone/20 text-bone"}`}>
                DOCK
              </button>
            </div>
          </div>
        ) : null}
        {dock?.targetId === "cinder-ring" && dock.distance <= 90 ? (
          <div className="absolute left-1/2 top-14 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2">
            <CinderRingOperationPreview />
          </div>
        ) : null}
        <div className="pointer-events-none absolute right-3 top-24 flex w-[min(17rem,calc(100vw-1.5rem))] flex-col gap-2">
          {anomalyScan && (anomalyScan.distance <= 80 || anomalyScan.scanned) ? (
            <div className="pointer-events-auto text-shadow" data-testid="universe-anomaly-signal">
              <p className="font-hud text-[10px] tracking-[0.2em] text-cyan-300">ANOMALY · {Math.round(anomalyScan.distance)} M</p>
              <p className="truncate font-hud text-[10px] text-bone/75">{anomalyScan.label}</p>
              {anomalyScan.logFull ? (
                <p className="mt-2 font-hud text-[10px] tracking-widest text-alert" data-testid="status-anomaly-scanned">LOCAL DISCOVERY LOG FULL</p>
              ) : anomalyScan.scanned ? (
                <p className="mt-2 font-hud text-[10px] tracking-widest text-solar" data-testid="status-anomaly-scanned">SIGNATURE LOGGED · THIS SESSION</p>
              ) : (
                <>
                  <p className="mt-1 font-hud text-[9px] tracking-widest text-muted">
                    {anomalyScan.ready ? "SCAN WINDOW OPEN" : anomalyScan.distance > 24 ? "CLOSE TO 24 M" : "REDUCE SPEED TO 4 M/S"}
                  </p>
                  <button type="button" data-testid="button-universe-scan-anomaly" disabled={!anomalyScan.ready} onClick={p.onScanAnomaly}
                    className="mt-1 min-h-10 border border-cyan-300/55 bg-void/50 px-3 font-hud text-[10px] tracking-widest text-cyan-200">SCAN</button>
                </>
              )}
            </div>
          ) : null}
          {relayInteraction && (relayInteraction.distance <= 80 || relayInteraction.scanned) ? (
            <div className="pointer-events-auto text-shadow" data-testid="universe-rust-relay">
              <p className="font-hud text-[10px] tracking-[0.2em] text-solar">RUST DISC RELAY · {Math.round(relayInteraction.distance)} M</p>
              <p className="truncate font-hud text-[10px] text-bone/75">{relayInteraction.label}</p>
              <p className="font-hud text-[9px] tracking-wider text-bone/70">
                {Math.round(relayInteraction.distance)} M · {relayInteraction.speed.toFixed(1)} M/S
              </p>
              {relayInteraction.recovered ? (
                <p className="mt-2 font-hud text-[10px] tracking-widest text-solar" data-testid="status-rust-relay-recovered">
                  RECORD RECOVERED · LOCAL SESSION ONLY · NOT SYNCED
                </p>
              ) : relayInteraction.scanned ? (
                <>
                  <p className="mt-2 font-hud text-[9px] tracking-widest text-muted">SIGNAL DECODED · RECOVERY WINDOW OPEN</p>
                  <button type="button" data-testid="button-universe-recover-rust-relay" disabled={!relayInteraction.canRecover} onClick={p.onRecoverRelay}
                    className="mt-1 min-h-10 border border-solar/70 bg-void/60 px-3 font-hud text-[10px] tracking-widest text-solar">RECOVER</button>
                </>
              ) : (
                <>
                  <p className="mt-1 font-hud text-[9px] tracking-widest text-muted">
                    {relayInteraction.ready ? "STATIONARY SCAN WINDOW OPEN" : relayInteraction.distance > 24 ? "CLOSE TO 24 M" : "REDUCE SPEED TO 4 M/S"}
                  </p>
                  <button type="button" data-testid="button-universe-scan-rust-relay" disabled={!relayInteraction.canScan} onClick={p.onScanRelay}
                    className="mt-1 min-h-10 border border-solar/70 bg-void/60 px-3 font-hud text-[10px] tracking-widest text-solar">SCAN</button>
                </>
              )}
              <p className="mt-1 font-hud text-[8px] tracking-wider text-muted">LOCAL ONLY · NO REWARDS OR ACCOUNT EVIDENCE</p>
            </div>
          ) : null}
        </div>
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
  const dockedLabel = session.dockedAt === "mars-night-side-station" ? "MARS NIGHT-SIDE STATION" : "CINDER RING";
  const dockedAtNightSide = session.dockedAt === "mars-night-side-station";
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
            <button type="button" data-testid="button-universe-return" onClick={p.onReturn} className={`${btn} mt-5 w-full bg-solar text-void`}>RETURN TO {dockedLabel}</button>
          </>
        ) : (
          <>
            <h2 className="mt-1 font-hud text-3xl leading-none tracking-wide" data-testid="text-universe-docked">DOCKED · {dockedLabel}</h2>
            <p className="mt-2 text-sm text-bone/75">
              {dockedAtNightSide
                ? "Night-side station clamps hold the ship in place. Your flight pose is retained for undock; docking does not update account location, mission evidence, or rewards."
                : `Flight is held at the Cinder Ring clamp. Your position and velocity are kept for undock${session.trainingRuns ? ` · training runs this session: ${session.trainingRuns}` : ""}.`}
            </p>
            <div className="mt-4 grid gap-2">
              {!dockedAtNightSide ? (
                <button type="button" data-testid="button-universe-launch-training" onClick={p.onLaunchTraining}
                  className={`${btn} flex min-h-14 flex-col items-start justify-center bg-solar text-left text-void`}>
                  <span>LAUNCH COMBAT TRAINING</span><span className="font-sans text-xs tracking-normal text-void/75">Three defenders · local rules · returns here</span>
                </button>
              ) : null}
              <button type="button" data-testid="button-universe-undock" onClick={p.onUndock}
                className={`${btn} border border-solar/60 text-solar`}>UNDOCK</button>
              {!dockedAtNightSide ? (
                <>
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
                </>
              ) : null}
              <button type="button" data-testid="button-universe-exit-docked" onClick={p.onExit}
                className="min-h-11 font-hud text-xs tracking-widest text-muted hover:text-bone">LEAVE UNIVERSE</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
