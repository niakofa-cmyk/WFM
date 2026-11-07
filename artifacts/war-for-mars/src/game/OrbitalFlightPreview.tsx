import { useEffect, useRef, useState } from "react";
import { PilotFlightStick } from "./PilotFlightStick";
import { clearInput, createBus, pulseVectorManeuver, setCircularRollControl, type Bus } from "./input";
import { CINDER_ASTEROID_SECTOR, createFlight, flightObjective, stepFlight, type FlightState } from "./flight-sector";
import { readOrbitalPreviewInput } from "./orbital-flight-preview-input";
import { createOrbitalNativeFlightRenderer, type OrbitalNativeFlightRenderer } from "./orbital-native-flight-renderer";
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
};

function readHud(state: FlightState): HudState {
  const objective = flightObjective(state, CINDER_ASTEROID_SECTOR);
  return {
    speed: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
    energy: state.energy,
    hull: state.hull,
    missiles: state.missiles,
    lock: state.lock,
    hits: state.hits,
    stage: state.stage.toUpperCase(),
    range: Math.hypot(
      objective.position.x - state.position.x,
      objective.position.y - state.position.y,
      objective.position.z - state.position.z,
    ),
    objective: objective.label,
  };
}

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
export function OrbitalFlightPreview({ shipId, faction }: { shipId: ShipId; faction: Faction }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busRef = useRef<Bus | null>(null);
  const pausedRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState("Native renderer idle · no GPU resources allocated.");
  const [hud, setHud] = useState<HudState>({
    speed: 0, energy: 100, hull: 100, missiles: 3, lock: 0, hits: 0, stage: "RELAY", range: 0,
    objective: "Investigate damaged relay",
  });

  if (!busRef.current) {
    const bus = createBus("arc");
    bus.orbital = true;
    bus.leftStickFlight = true;
    busRef.current = bus;
  }
  const bus = busRef.current;
  pausedRef.current = paused;

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
    setPaused(false);

    let flight = createFlight(shipId, CINDER_ASTEROID_SECTOR);
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
        factionColor: faction === "ussf" ? [0.34, 0.76, 1] : [1, 0.62, 0.26],
      });
      setStatus(`Orbital simulation active · Cinder asteroid sector · ${CINDER_ASTEROID_SECTOR.rocks.length} collision-matched bodies · no rewards`);
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
      if (!pausedRef.current) {
        accumulator = Math.min(accumulator + frameSeconds, FIXED_STEP * 4);
        let steps = 0;
        while (accumulator >= FIXED_STEP && steps < 4) {
          const input = readOrbitalPreviewInput(controls);
          stepFlight(flight, input, FIXED_STEP, CINDER_ASTEROID_SECTOR);
          accumulator -= FIXED_STEP;
          steps++;
        }
      } else {
        accumulator = 0;
      }
      renderer.render(flight);
      if (now - lastHud > 120) {
        setHud(readHud(flight));
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
      renderer?.dispose();
    };
  }, [enabled, faction, shipId, run]);

  return (
    <section className="uv-renderer-proof" aria-label="Orbital local flight preview">
      <div className="uv-renderer-proof__heading">
        <div>
          <b>ORBITAL FLIGHT PREVIEW</b>
          <small>Shared fixed-step flight sim · Cinder asteroid field · local / no rewards</small>
        </div>
        <button type="button" data-testid="button-orbital-preview-toggle" onClick={() => setEnabled((value) => !value)}>
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
            <span>OBJECTIVE <b>{hud.objective.toUpperCase()}</b></span>
            <span>PHASE <b>{hud.stage}</b></span>
          </div>
          <canvas ref={canvasRef} className="uv-renderer-proof__canvas" aria-label="Orbital flight scene with player ship and Cinder asteroids" />
          <p className="uv-renderer-proof__status" data-testid="status-orbital-preview" role="status">{status}</p>
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
              <button type="button" className="uv-flight-action" data-testid="button-orbital-preview-missile" onClick={() => { bus.missilePulse = true; }}>MISSILE</button>
              <button type="button" className="uv-flight-action" data-testid="button-orbital-preview-countermeasure" onClick={() => { bus.countermeasurePulse = true; }}>FLARE</button>
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
            <button type="button" className="uv-renderer-proof__clock" data-testid="button-orbital-preview-pause" onClick={() => setPaused((value) => !value)}>
              {paused ? "RESUME FLIGHT" : "PAUSE FLIGHT"}
            </button>
            <button type="button" className="uv-flight-action" data-testid="button-orbital-preview-restart" onClick={() => setRun((value) => value + 1)}>
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
