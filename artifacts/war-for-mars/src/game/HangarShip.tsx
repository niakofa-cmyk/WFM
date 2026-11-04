import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildOrbitalShip } from "./orbital-visuals";
import { SHIPS, type Faction, type ShipId } from "./ships";

type HangarShipProps = { ship: ShipId; faction: Faction; isSaved?: boolean };

/**
 * Lightweight hangar display for the already-saved hull. Pointer gestures are
 * scoped to the canvas so surrounding operation and loadout controls remain usable.
 */
export function HangarShip({ ship, faction, isSaved = true }: HangarShipProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.className = "absolute inset-0 h-full w-full touch-none";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `3D display of ${SHIPS[ship].name}. Drag or use arrow keys to rotate the ${isSaved ? "saved hull" : "unsaved hull preview"}.`);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(4.4, 3.3, 6.7);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xc5d9e5, 0x171c22, 2.1));
    const key = new THREE.DirectionalLight(0xffd7a0, 2.4);
    key.position.set(-4, 6, 5);
    scene.add(key);
    const fill = new THREE.PointLight(faction === "accord" ? 0xffad52 : 0x76c9ff, 18, 12, 2);
    fill.position.set(3, 1.8, -2);
    scene.add(fill);

    const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x28323a, metalness: 0.78, roughness: 0.42 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.12, 48), platformMaterial);
    platform.position.y = -1.18;
    scene.add(platform);
    const rimMaterial = new THREE.MeshBasicMaterial({ color: faction === "accord" ? 0xe0a15a : 0x78bfff, transparent: true, opacity: 0.72 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.018, 6, 80), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -1.1;
    scene.add(rim);
    const floor = new THREE.GridHelper(18, 24, 0x83939c, 0x58646d);
    (Array.isArray(floor.material) ? floor.material : [floor.material]).forEach((material) => {
      material.transparent = true;
      material.opacity = 0.16;
    });
    floor.position.y = -1.26;
    scene.add(floor);

    const hull = buildOrbitalShip(ship);
    hull.scale.setScalar(0.84);
    hull.position.y = -0.05;
    scene.add(hull);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let pointerX: number | null = null;
    let pointerY: number | null = null;
    let dragX = 0;
    let dragY = 0;
    const onPointerDown = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (pointerX === null || pointerY === null) return;
      dragX += (event.clientX - pointerX) * 0.008;
      dragY = THREE.MathUtils.clamp(dragY + (event.clientY - pointerY) * 0.006, -0.45, 0.45);
      pointerX = event.clientX;
      pointerY = event.clientY;
      hull.rotation.set(dragY, dragX, 0);
      renderer.render(scene, camera);
    };
    const onPointerUp = () => { pointerX = pointerY = null; };
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 0.28 : 0.12;
      if (event.key === "ArrowLeft") dragX -= step;
      else if (event.key === "ArrowRight") dragX += step;
      else if (event.key === "ArrowUp") dragY = THREE.MathUtils.clamp(dragY - step, -0.45, 0.45);
      else if (event.key === "ArrowDown") dragY = THREE.MathUtils.clamp(dragY + step, -0.45, 0.45);
      else return;
      event.preventDefault();
      hull.rotation.set(dragY, dragX, 0);
      renderer.render(scene, camera);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("keydown", onKeyDown);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let raf = 0;
    let lastTime = 0;
    const draw = (time: number) => {
      if (!visible || document.visibilityState === "hidden") {
        raf = 0;
        return;
      }
      if (!reducedMotion.matches) {
        const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
        if (pointerX === null) hull.rotation.y += dt * 0.17;
        hull.position.y = -0.05 + Math.sin(time * 0.0007) * 0.025;
      }
      lastTime = time;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(draw);
    };
    const start = () => {
      if (!visible || document.visibilityState === "hidden") return;
      if (reducedMotion.matches) {
        renderer.render(scene, camera);
        return;
      }
      if (!raf) raf = window.requestAnimationFrame(draw);
    };
    const stop = () => { if (raf) window.cancelAnimationFrame(raf); raf = 0; };
    const visibility = () => document.visibilityState === "hidden" ? stop() : start();
    const motionPreference = () => {
      stop();
      start();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    });
    intersection.observe(host);
    document.addEventListener("visibilitychange", visibility);
    reducedMotion.addEventListener("change", motionPreference);
    start();

    return () => {
      stop();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      reducedMotion.removeEventListener("change", motionPreference);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("keydown", onKeyDown);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ship, faction, isSaved]);

  return (
    <div
      ref={hostRef}
      className="hangar-ship-stage relative isolate min-h-[250px] w-full overflow-hidden sm:min-h-[340px]"
      data-testid="hangar-ship-stage"
      data-ship-id={ship}
      role="group"
      aria-label={`Hangar display of ${isSaved ? "saved" : "unsaved"} ${SHIPS[ship].name} spacecraft. Drag or focus and use arrow keys to inspect.`}
    >
      <div className="hangar-stage-grid absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 font-hud text-[9px] tracking-[0.22em] text-muted">
        DRAG TO INSPECT · {isSaved ? "SAVED HULL" : "UNSAVED PREVIEW"}
      </div>
      {failed ? (
        <p role="status" className="absolute inset-0 z-10 grid place-items-center px-6 text-center font-hud text-xs tracking-[0.18em] text-muted">
          3D DISPLAY UNAVAILABLE · {SHIPS[ship].name.toUpperCase()} HULL DATA READY
        </p>
      ) : null}
    </div>
  );
}
