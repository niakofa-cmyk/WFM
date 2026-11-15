import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { SHIPS, type Faction, type ShipId } from "./ships";
import {
  createOrbitalNativeHangarRenderer,
  type NativeHangarFrame,
  type OrbitalNativeHangarRenderer,
} from "./orbital-native-hangar-renderer";

type HangarInspectionView = "hull" | "engines" | "weapons";
type HangarDamageState = "intact" | "field" | "critical";
type HangarShipProps = { ship: ShipId; faction: Faction; isSaved?: boolean };

const INSPECTION_VIEWS: Array<{ id: HangarInspectionView; label: string }> = [
  { id: "hull", label: "HULL" },
  { id: "engines", label: "ENGINES" },
  { id: "weapons", label: "WEAPONS" },
];
const DAMAGE_STATES: Array<{ id: HangarDamageState; label: string }> = [
  { id: "intact", label: "INTACT" },
  { id: "field", label: "FIELD" },
  { id: "critical", label: "CRITICAL" },
];
const clampPitch = (pitch: number) => Math.max(-0.45, Math.min(0.45, pitch));

/**
 * Orbital-native 3D hangar inspection. The renderer uses the shared native
 * hull geometry and WebGL2 pipeline; it does not create a Three.js scene.
 */
export function HangarShip({ ship, faction, isSaved = true }: HangarShipProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OrbitalNativeHangarRenderer | null>(null);
  const refreshSceneRef = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<HangarInspectionView>("hull");
  const [damage, setDamage] = useState<HangarDamageState>("intact");
  const frameRef = useRef<NativeHangarFrame>({ view: "hull", damage: "intact", yaw: 0, pitch: 0, elapsedMs: 0 });

  const selectView = (next: HangarInspectionView) => {
    frameRef.current.view = next;
    setView(next);
    refreshSceneRef.current?.();
  };
  const selectDamage = (next: HangarDamageState) => {
    frameRef.current.damage = next;
    setDamage(next);
    refreshSceneRef.current?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: OrbitalNativeHangarRenderer;
    try {
      renderer = createOrbitalNativeHangarRenderer(canvas, ship, faction);
      rendererRef.current = renderer;
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let raf = 0;
    let lastTime = 0;
    let pointerX: number | null = null;
    let pointerY: number | null = null;
    let dragging = false;

    const render = () => {
      canvas.setAttribute(
        "aria-label",
        `Orbital 3D ${frameRef.current.view} inspection of ${SHIPS[ship].name}; ${frameRef.current.damage} presentation state. Drag or use arrow keys to rotate.`,
      );
      renderer.render(frameRef.current);
    };
    refreshSceneRef.current = render;
    const resize = () => render();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const draw = (time: number) => {
      if (!visible || document.visibilityState === "hidden" || reducedMotion.matches) {
        raf = 0;
        render();
        return;
      }
      const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
      frameRef.current.elapsedMs += dt * 1000;
      if (frameRef.current.view === "hull" && !dragging) frameRef.current.yaw += dt * 0.17;
      lastTime = time;
      render();
      raf = window.requestAnimationFrame(draw);
    };
    const start = () => {
      if (!visible || document.visibilityState === "hidden") return;
      if (reducedMotion.matches) {
        render();
        return;
      }
      if (!raf) {
        lastTime = 0;
        raf = window.requestAnimationFrame(draw);
      }
    };
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => document.visibilityState === "hidden" ? stop() : start();
    const onMotionPreference = () => { stop(); start(); };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onMotionPreference);

    const onPointerDown = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (pointerX === null || pointerY === null) return;
      frameRef.current.yaw += (event.clientX - pointerX) * 0.008;
      frameRef.current.pitch = clampPitch(frameRef.current.pitch + (event.clientY - pointerY) * 0.006);
      pointerX = event.clientX;
      pointerY = event.clientY;
      render();
    };
    const onPointerUp = () => {
      pointerX = pointerY = null;
      dragging = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 0.28 : 0.12;
      if (event.key === "ArrowLeft") frameRef.current.yaw -= step;
      else if (event.key === "ArrowRight") frameRef.current.yaw += step;
      else if (event.key === "ArrowUp") frameRef.current.pitch = clampPitch(frameRef.current.pitch - step);
      else if (event.key === "ArrowDown") frameRef.current.pitch = clampPitch(frameRef.current.pitch + step);
      else return;
      event.preventDefault();
      render();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("keydown", onKeyDown);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onMotionPreference);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("keydown", onKeyDown);
      if (refreshSceneRef.current === render) refreshSceneRef.current = null;
      if (rendererRef.current === renderer) rendererRef.current = null;
      renderer.dispose();
    };
  }, [ship, faction]);

  return (
    <div
      className="hangar-ship-stage relative isolate min-h-[250px] w-full overflow-hidden sm:min-h-[340px]"
      data-testid="hangar-ship-stage"
      data-ship-id={ship}
      data-inspection-view={view}
      data-damage-view={damage}
      role="group"
      aria-label={`Hangar display of ${isSaved ? "saved" : "unsaved"} ${SHIPS[ship].name} spacecraft. Drag or focus and use arrow keys to inspect.`}
    >
      <div className="hangar-stage-grid absolute inset-0" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        tabIndex={0}
        role="img"
        aria-label={`Orbital 3D display of ${SHIPS[ship].name}`}
      />
      <div className="absolute left-2 right-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1">
        <div role="group" aria-label="Inspect ship components" className="flex gap-1">
          {INSPECTION_VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`hangar-view-${option.id}`}
              aria-pressed={view === option.id}
              title={`Inspect ${option.label.toLowerCase()}`}
              disabled={failed}
              onClick={() => selectView(option.id)}
              className={`rounded-sm border px-2 py-1 font-hud text-[8px] tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-40 ${view === option.id ? "border-accent bg-black/70 text-white" : "border-white/20 bg-black/40 text-muted"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Presentation-only damage view" className="flex gap-1">
          {DAMAGE_STATES.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`hangar-damage-${option.id}`}
              aria-pressed={damage === option.id}
              title={`${option.label.toLowerCase()} presentation damage`}
              disabled={failed}
              onClick={() => selectDamage(option.id)}
              className={`rounded-sm border px-2 py-1 font-hud text-[8px] tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-40 ${damage === option.id ? "border-accent bg-black/70 text-white" : "border-white/20 bg-black/40 text-muted"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 font-hud text-[9px] tracking-[0.22em] text-muted">
        DRAG TO INSPECT · {isSaved ? "SAVED HULL" : "UNSAVED PREVIEW"}
      </div>
      {failed ? (
        <p role="status" className="absolute inset-0 z-10 grid place-items-center px-6 text-center font-hud text-xs tracking-[0.18em] text-muted">
          ORBITAL 3D DISPLAY UNAVAILABLE · {SHIPS[ship].name.toUpperCase()} HULL DATA READY
        </p>
      ) : null}
    </div>
  );
}
