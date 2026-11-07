import { useEffect, useRef, useState } from "react";
import { PilotFlightStick } from "./PilotFlightStick";
import { clearInput, createBus, pulseVectorManeuver, setCircularRollControl, type Bus } from "./input";
import {
  CINDER_ASTEROID_SECTOR,
  createFlight,
  flightObjective,
  stepFlight,
  type FlightSector,
  type FlightState,
} from "./flight-sector";
import { readOrbitalPreviewInput } from "./orbital-flight-preview-input";
import { createOrbitalNativeFlightRenderer, type OrbitalNativeFlightRenderer } from "./orbital-native-flight-renderer";
import {
  evaluateNativeCinderDock,
  restoreDockedFlightSnapshot,
  snapshotDockedFlightForTraining,
} from "./orbital-native-docking";
import {
  createNativeCinderSkirmish,
  createNativeCinderStationMooring,
  NATIVE_CINDER_SKIRMISH_WORLD,
} from "./orbital-native-combat";
import { type Faction, type ShipId } from "./ships";

const FIXED_STEP = 1 / 30;
const FLIGHT_KEYS = new Set([
  "KeyW", "KeyS", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "ArrowLeft", "ArrowRight",
  "KeyI", "KeyK", "KeyQ", "KeyE", "KeyZ", "KeyX", "KeyC", "KeyV",
  "ShiftLeft", "ShiftRight", "KeyB", "Space", "KeyR", "KeyM", "KeyT", "KeyG",
]);

type HudState = {
  speed: number;
  energy: number;
  hull: number;
  missiles: number;
  lock: number;
  hits: number;
  stage: string;
  range: number;
  objective: string;
  dockReason: string;
  dockSpeed: number;
  dockHeading: number;
  canDock: boolean;
  targetHull: number | null;
  missileReady: boolean;
};

type SortieDebrief = {
  outcome: "complete" | "destroyed";
  hull: number;
  hits: number;
  collisions: number;
  elapsed: number;
};

function readHud(state: FlightState, sector: FlightSector = CINDER_ASTEROID_SECTOR): HudState {
  const objective = flightObjective(state, sector);
  const dock = evaluateNativeCinderDock(state);
  return {
    speed: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
    energy: state.energy,
    hull: state.hull,
    missiles: state.missiles,
    lock: state.lock * 100,
    hits: state.hits,
    stage: state.stage.toUpperCase(),
    range: dock.distance,
    objective: state.stage === "complete"
      ? "Cinder sortie complete"
      : state.stage === "destroyed"
        ? "Pilot craft destroyed"
        : objective.label,
    dockReason: dock.reason,
    dockSpeed: dock.speed,
    dockHeading: dock.headingDeg,
    canDock: dock.eligible,
    targetHull: state.stage === "drone"
      ? Math.max(0, Math.min(100, (state.drone.hull / (sector.droneHull ?? 60)) * 100))
      : null,
    missileReady: state.stage === "drone" && state.lock >= 1 && state.missiles > 0,
  };
}

const DOCK_COPY: Record<HudState["dockReason"], string> = {
  ready: "CAPTURE WINDOW READY · DOCK TO ENTER",
  range: "APPROACH WITHIN 22 M",
  closure: "REDUCE CLOSURE SPEED TO 4 M/S OR LESS",
  heading: "ALIGN YOUR NOSE WITH THE STATION",
  inactive: "FLIGHT INACTIVE",
};

function holdControl(bus: Bus, key: string, held: boolean) {
  if (held) bus.keys.add(key);
  else bus.keys.delete(key);
}

function HoldButton({ bus, control, label, testId, accent = false }: {
  bus: Bus; control: string; label: string; testId: string; accent?: boolean;
}) {
  return (
    <button
      type="button"
      className={`uv-flight-action${accent ? " uv-flight-action--accent" : ""}`}
      data-testid={testId}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        holdControl(bus, control, true);
      }}
      onPointerUp={() => holdControl(bus, control, false)}
      onPointerCancel={() => holdControl(bus, control, false)}
      onLostPointerCapture={() => holdControl(bus, control, false)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          holdControl(bus, control, true);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          holdControl(bus, control, false);
        }
      }}
      onBlur={() => holdControl(bus, control, false)}
    >
      {label}
    </button>
  );
}

/** Local no-reward flight slice: shared Orbital sim, native WebGL2, and current pilot controls. */
export function OrbitalFlightPreview({
  shipId,
  faction,
  servicesHref,
  trainingReturnSnapshot,
  onTrainingReturnConsumed,
  onLaunchTraining,
}: {
  shipId: ShipId;
  faction: Faction;
  servicesHref: string;
  trainingReturnSnapshot: FlightState | null;
  onTrainingReturnConsumed: () => void;
  onLaunchTraining: (snapshot: FlightState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busRef = useRef<Bus | null>(null);
  const flightRef = useRef<FlightState | null>(null);
  const sectorRef = useRef<FlightSector>(CINDER_ASTEROID_SECTOR);
  const rendererRef = useRef<OrbitalNativeFlightRenderer | null>(null);
  const pausedRef = useRef(false);
  const dockedRef = useRef(false);
  const pendingResumeSnapshotRef = useRef<FlightState | null>(null);
  const terminalStageRef = useRef<FlightState["stage"] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [docked, setDocked] = useState(false);
  const [debrief, setDebrief] = useState<SortieDebrief | null>(null);
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState("Native renderer idle · no GPU resources allocated.");
  const [hud, setHud] = useState<HudState>({
    speed: 0, energy: 100, hull: 100, missiles: 3, lock: 0, hits: 0, stage: "RELAY", range: 0,
    objective: "Investigate damaged relay", dockReason: "range", dockSpeed: 0, dockHeading: 180, canDock: false,
    targetHull: null,
    missileReady: false,
  });

  if (!busRef.current) {
    const bus = createBus("arc");
    bus.orbital = true;
    bus.leftStickFlight = true;
    busRef.current = bus;
  }
  const bus = busRef.current;
  pausedRef.current = paused;

  const enterFlight = () => {
    pendingResumeSnapshotRef.current = trainingReturnSnapshot
      ? restoreDockedFlightSnapshot(trainingReturnSnapshot, shipId)
      : null;
    if (trainingReturnSnapshot) onTrainingReturnConsumed();
    setEnabled(true);
  };
  const launchTraining = () => {
    const flight = flightRef.current;
    const snapshot = flight && dockedRef.current ? snapshotDockedFlightForTraining(flight) : null;
    if (!snapshot) return;
    clearInput(bus);
    onLaunchTraining(snapshot);
  };
  const launchNativeSkirmish = () => {
    const currentFlight = flightRef.current;
    if (!currentFlight || !rendererRef.current || !dockedRef.current
      || !evaluateNativeCinderDock(currentFlight).eligible) return;
    clearInput(bus);
    const sortie = createNativeCinderSkirmish(shipId);
    sectorRef.current = NATIVE_CINDER_SKIRMISH_WORLD;
    flightRef.current = sortie;
    terminalStageRef.current = null;
    pausedRef.current = false;
    dockedRef.current = false;
    setDebrief(null);
    setPaused(false);
    setDocked(false);
    setHud(readHud(sortie, NATIVE_CINDER_SKIRMISH_WORLD));
    setStatus("Native Cinder skirmish launched · Orbital sector combat · local / no rewards.");
  };
  const recoverAtStation = () => {
    if (!debrief || !rendererRef.current) return;
    clearInput(bus);
    const moored = createNativeCinderStationMooring(shipId);
    sectorRef.current = CINDER_ASTEROID_SECTOR;
    flightRef.current = moored;
    pausedRef.current = false;
    dockedRef.current = true;
    setPaused(false);
    setDocked(true);
    setHud(readHud(moored, CINDER_ASTEROID_SECTOR));
    setStatus("Local debrief recovery at Cinder Ring · no server location or reward was written.");
  };

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controls = busRef.current;
    if (!controls) return;

    clearInput(controls);
    controls.orbital = true;
    controls.leftStickFlight = true;
    pausedRef.current = false;
    const resumedFlight = pendingResumeSnapshotRef.current;
    pendingResumeSnapshotRef.current = null;
    sectorRef.current = CINDER_ASTEROID_SECTOR;
    terminalStageRef.current = null;
    setDebrief(null);
    dockedRef.current = resumedFlight !== null;
    setPaused(false);
    setDocked(resumedFlight !== null);

    let flight = resumedFlight ?? createFlight(shipId, CINDER_ASTEROID_SECTOR);
    flightRef.current = flight;
    let renderer: OrbitalNativeFlightRenderer | null = null;
    let raf = 0;
    let previous = 0;
    let lastHud = 0;
    let accumulator = 0;
    let disposed = false;
    try {
      renderer = createOrbitalNativeFlightRenderer({
        canvas,
        sector: CINDER_ASTEROID_SECTOR,
        shipId,
        factionColor: faction === "ussf" ? [0.34, 0.76, 1] : [1, 0.62, 0.26],
      });
      rendererRef.current = renderer;
      setStatus(resumedFlight
        ? "Returned from local training · restored the same docked Cinder flight · no rewards."
        : `Orbital simulation active · Cinder asteroid sector · ${CINDER_ASTEROID_SECTOR.rocks.length} collision-matched bodies · no rewards`);
    } catch (error) {
      setStatus(`Flight preview unavailable: ${error instanceof Error ? error.message : "renderer initialization failed"}`);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!FLIGHT_KEYS.has(event.code)) return;
      event.preventDefault();
      controls.keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!FLIGHT_KEYS.has(event.code)) return;
      event.preventDefault();
      controls.keys.delete(event.code);
    };
    const resetControls = () => {
      clearInput(controls);
      accumulator = 0;
    };
    const onVisibility = () => {
      if (document.hidden) resetControls();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", resetControls);
    document.addEventListener("visibilitychange", onVisibility);

    const frame = (now: number) => {
      if (disposed || !renderer) return;
      raf = requestAnimationFrame(frame);
      if (!previous) previous = now;
      const frameSeconds = Math.min(Math.max(0, (now - previous) / 1000), 0.1);
      previous = now;
      if (!pausedRef.current && !dockedRef.current) {
        accumulator = Math.min(accumulator + frameSeconds, FIXED_STEP * 4);
        let steps = 0;
        while (accumulator >= FIXED_STEP && steps < 4) {
          const input = readOrbitalPreviewInput(controls);
          const activeFlight = flightRef.current;
          if (!activeFlight) break;
          const activeSector = sectorRef.current;
          stepFlight(activeFlight, input, FIXED_STEP, activeSector);
          accumulator -= FIXED_STEP;
          steps++;
          if ((activeFlight.stage === "complete" || activeFlight.stage === "destroyed")
            && terminalStageRef.current !== activeFlight.stage) {
            terminalStageRef.current = activeFlight.stage;
            setDebrief({
              outcome: activeFlight.stage,
              hull: activeFlight.hull,
              hits: activeFlight.hits,
              collisions: activeFlight.collisions,
              elapsed: activeFlight.elapsed,
            });
          }
        }
      } else {
        accumulator = 0;
      }
      const activeFlight = flightRef.current;
      if (!activeFlight) return;
      renderer.render(activeFlight);
      if (now - lastHud > 120) {
        setHud(readHud(activeFlight, sectorRef.current));
        lastHud = now;
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetControls);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInput(controls);
      flightRef.current = null;
      rendererRef.current = null;
      dockedRef.current = false;
      renderer?.dispose();
    };
  }, [enabled, faction, shipId, run]);

  const dockAtStation = () => {
    const flight = flightRef.current;
    if (!flight || !rendererRef.current || !evaluateNativeCinderDock(flight).eligible) return;
    clearInput(bus);
    flight.velocity.x = 0;
    flight.velocity.y = 0;
    flight.velocity.z = 0;
    dockedRef.current = true;
    setDocked(true);
    setHud(readHud(flight));
    setStatus("Docking complete · local Cinder Ring station · no account changes or rewards.");
  };
  const undockFromStation = () => {
    if (!dockedRef.current) return;
    clearInput(bus);
    dockedRef.current = false;
    setDocked(false);
    setStatus("Undocked · continuing the same local Cinder sector flight.");
  };

  return (
    <section className="uv-renderer-proof" aria-label="Orbital local flight preview">
      <div className="uv-renderer-proof__heading">
        <div>
          <b>ORBITAL FLIGHT PREVIEW</b>
          <small>Shared fixed-step flight sim · Cinder asteroid field · local / no rewards</small>
        </div>
        <button type="button" data-testid="button-orbital-preview-toggle" onClick={() => {
          if (enabled) {
            setEnabled(false);
            setDocked(false);
          } else {
            enterFlight();
          }
        }}>
          {enabled ? "EXIT FLIGHT" : "ENTER FLIGHT"}
        </button>
      </div>
      {enabled ? (
        <>
          <div className="uv-flight-hud" data-testid="orbital-preview-hud" aria-live="off">
            <span>SPEED <b>{hud.speed.toFixed(1)} M/S</b></span>
            <span>HULL <b>{Math.round(hud.hull)}%</b></span>
            <span>ENERGY <b>{Math.round(hud.energy)}%</b></span>
            <span>MISSILES <b>{hud.missiles}</b></span>
            <span>LOCK <b>{Math.round(hud.lock)}%</b></span>
            <span>RANGE <b>{Math.round(hud.range)} M</b></span>
            {hud.targetHull !== null ? <span>TARGET <b>{Math.round(hud.targetHull)}% HULL</b></span> : null}
            <span>OBJECTIVE <b>{hud.objective.toUpperCase()}</b></span>
            <span>PHASE <b>{hud.stage}</b></span>
          </div>
          <canvas ref={canvasRef} className="uv-renderer-proof__canvas" aria-label="Orbital flight scene with player ship and Cinder asteroids" />
          <p className="uv-renderer-proof__status" data-testid="status-orbital-preview" role="status">{status}</p>
          <div className={`uv-dock-panel${docked ? " uv-dock-panel--docked" : ""}`} data-testid="orbital-cinder-dock-state" aria-live="polite">
            <div>
              <b>{docked ? "DOCKED · CINDER RING" : "CINDER RING · DOCK APPROACH"}</b>
              <small>
                {docked
                  ? "Station entry is local only. Online location and operation access remain server-validated."
                  : `${DOCK_COPY[hud.dockReason]} · ${Math.round(hud.range)} M · ${hud.dockSpeed.toFixed(1)} M/S · ${Math.round(hud.dockHeading)}°`}
              </small>
            </div>
            {docked
              ? <button type="button" data-testid="button-orbital-preview-undock" onClick={undockFromStation}>UNDOCK</button>
              : <button type="button" data-testid="button-orbital-preview-dock" disabled={!hud.canDock} onClick={dockAtStation}>DOCK</button>}
          </div>
          {docked ? (
            <section className="uv-station-console" aria-label="Cinder Ring station activities" data-testid="orbital-station-console">
              <div>
                <b>STATION ACTIVITY CONSOLE</b>
                <p>Launch a native Cinder skirmish in the Orbital sector simulation, or use the legacy Arena fallback. Both are local and no-reward.</p>
              </div>
              <button type="button" data-testid="button-cinder-native-skirmish" onClick={launchNativeSkirmish}>
                LAUNCH NATIVE CINDER SKIRMISH
              </button>
              <button type="button" data-testid="button-cinder-local-training" onClick={launchTraining}>
                ARENA FALLBACK · COMPATIBILITY
              </button>
              <a href={servicesHref} data-testid="link-cinder-account-operations">
                OPEN SERVER OPERATIONS
                <small>Sign-in and server-side location checks apply. This local dock grants no access or rewards.</small>
              </a>
            </section>
          ) : null}
          {debrief ? (
            <section className="uv-sortie-debrief" aria-label="Local sortie debrief" data-testid="orbital-native-debrief" role="status">
              <div>
                <b>CINDER SORTIE · {debrief.outcome === "complete" ? "COMPLETE" : "CRAFT LOST"}</b>
                <small>HITS {debrief.hits} · COLLISIONS {debrief.collisions} · HULL {Math.round(debrief.hull)}% · {Math.floor(debrief.elapsed)} SEC · NO REWARDS</small>
              </div>
              {!docked ? (
                <button type="button" data-testid="button-cinder-debrief-recover" onClick={recoverAtStation}>
                  RECOVER AT STATION · LOCAL RESET
                </button>
              ) : null}
            </section>
          ) : null}
          <div className="uv-flight-control-deck">
            <div className="uv-flight-stick-wrap">
              <PilotFlightStick
                label="Left thumb flight"
                testId="stick-orbital-preview-flight"
                size="rust-disc"
                className="pilot-rust-disc-stick"
                description="Drag up for thrust, down for reverse, left or right to turn. Double-tap an edge for vector thrust."
                onAxis={(x, y) => { bus.leftX = x; bus.leftY = y; }}
                onPulse={(pulse) => pulseVectorManeuver(bus, pulse)}
              />
              <small>FLIGHT · THRUST / TURN</small>
            </div>
            <div className="uv-flight-action-grid" aria-label="Flight actions">
              <HoldButton bus={bus} control="ShiftLeft" label="BOOST" testId="button-orbital-preview-boost" accent />
              <HoldButton bus={bus} control="KeyR" label="LOCK" testId="button-orbital-preview-lock" />
              <HoldButton bus={bus} control="Space" label="FIRE" testId="button-orbital-preview-fire" accent />
              <HoldButton bus={bus} control="KeyB" label="BRAKE" testId="button-orbital-preview-brake" />
              <button type="button" className="uv-flight-action" data-testid="button-orbital-preview-missile" disabled={!hud.missileReady}
                aria-label={hud.missileReady ? "Fire guided missile" : "Missile requires full target lock"}
                onClick={() => { bus.missilePulse = true; }}>MISSILE</button>
              <button type="button" className="uv-flight-action" data-testid="button-orbital-preview-countermeasure" onClick={() => { bus.countermeasurePulse = true; }}>FLARE</button>
              <small className="uv-flight-action-hint" data-testid="text-orbital-preview-weapon-help">HOLD LOCK TO 100% BEFORE MISSILE · FLARE CLEARS GUIDED FIRE</small>
            </div>
            <div className="uv-flight-stick-wrap">
              <small>AIM · PITCH / LIVE ROLL</small>
              <PilotFlightStick
                label="Right thumb aim"
                testId="stick-orbital-preview-aim"
                size="rust-disc"
                className="pilot-rust-disc-stick"
                onAxis={(x, y) => { bus.rightX = x; bus.rightY = y; }}
                onCircularRollInput={(input) => setCircularRollControl(bus, input)}
              />
            </div>
          </div>
          <div className="uv-flight-preview-footer">
            <button type="button" className="uv-renderer-proof__clock" data-testid="button-orbital-preview-pause" disabled={docked} onClick={() => setPaused((value) => !value)}>
              {paused ? "RESUME FLIGHT" : "PAUSE FLIGHT"}
            </button>
            <button type="button" className="uv-flight-action" data-testid="button-orbital-preview-restart" onClick={() => {
              sectorRef.current = CINDER_ASTEROID_SECTOR;
              terminalStageRef.current = null;
              setDebrief(null);
              setRun((value) => value + 1);
            }}>
              RESTART SORTIE
            </button>
            <p className="uv-renderer-proof__scope">
              Keyboard: W/S thrust, A/D yaw, I/K pitch, Q/E roll, Z/X strafe, C/V vertical, Shift boost, B brake, Space fire, R lock, M missile. The native renderer reads the same local Orbital sector state as flight and collision; this preview has no account persistence, multiplayer authority, or rewards.
            </p>
          </div>
        </>
      ) : <p className="uv-renderer-proof__status" data-testid="status-orbital-preview">{status}</p>}
    </section>
  );
}
