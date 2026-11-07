import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import type * as THREE_TYPES from "three";
import { SHIPS, ROSTER, type ShipId } from "./ships";
import { FACTION_PALETTE } from "./faction-palette";
import { ShipIllustration } from "./ShipIllustration";
import { parseTrainingShipPreset, resolveInitialTrainingShip } from "./flight-preset";
import { sfxDive, unlockAudio } from "./audio";
import { combatLockCue } from "./combat-readout";
import {
  canLock, createFlight, stepFlight, flightObjective, flightForward, vectorLength,
  RUST_DISC_SECTOR, type FlightInput, type FlightSector, type FlightState,
} from "./flight-sector";
import { neutralFlightControls, toSectorFlightInput, type FlightControlFrame } from "./flight-control";
import { PilotActionButton } from "./PilotActionButton";
import { PilotFlightStick } from "./PilotFlightStick";
import { COORDINATED_BANK, mapFlightStickAxes, MANEUVER_PULSE_DURATION_MS, type ManeuverPulse } from "./pilot-stick-gestures";
import { AdaptiveResolutionController, FramePacingMonitor, type FramePacingWindow } from "./flight-performance";
import {
  createLocalPerformanceRecorder,
  readBrowserHeap,
  readLocalPerformanceDeviceInfo,
  type BrowserHeapReading,
  type LocalPerformanceDeviceInfo,
  type LocalPerformanceSummary,
} from "./local-performance";
import { LocalPerformanceReport } from "./LocalPerformanceReport";
import type {
  IronEclipseCommandRequest, IronEclipseSnapshot, IronEclipseSubsystemId, IronEclipseOrder,
  SectorCommandRequest, SectorEvidencePickup, SectorEvidenceRecoveryRequest, SectorFactionContact,
  SectorMission, SectorSnapshot, SectorTacticalCommand, SectorTransponderRequest,
} from "./sector-missions";
import { SECTOR_INPUT_INTERVAL_MS, holdInput, sanitizeInput, slotLabel } from "./sector-client";
import { CINDER_ASTEROID_OPERATION_ID, localTrainingSector } from "./sector-navigation";
import { useLeaveWorldOperationInstance } from "@workspace/api-client-react";
import { createOrbitalRuntime, getGameModeDefinition } from "@workspace/orbital-sim";

/**
 * RUST DISC — local flight trainer. Pure client-side vertical slice.
 * No network, no storage, no rewards, no progression. Sim lives in flight-sector.ts.
 */

/**
 * Optional server-authoritative transport. When present the component never
 * simulates: it renders snapshots, transmits FlightInput, and cannot restart.
 */
export type ExpeditionTransport = {
  snapshotRef: MutableRefObject<SectorSnapshot | null>;
  latencyRef: MutableRefObject<number | null>;
  sendInput: (input: FlightInput) => void;
  sendCommand: (command: SectorCommandRequest | IronEclipseCommandRequest | SectorTransponderRequest | SectorEvidenceRecoveryRequest) => boolean;
  notice: string;
  mission: SectorMission;
  connection: "connected" | "reconnecting" | "lost";
  onExit: () => void;
};
type CrewRow = { slot: number; shipId: ShipId; connected: boolean; hull: number; own: boolean; host: boolean; stage: FlightState["stage"] };

type Phase = "briefing" | "flight" | "summary" | "unsupported";
type Quality = "low" | "high";
type ThreeModule = typeof import("./three-flight-runtime");
type PerformanceReadout = { window: FramePacingWindow; scale: number; rttMs: number | null; heap: BrowserHeapReading | null };
type LocalPerformanceCaptureReport = {
  device: LocalPerformanceDeviceInfo;
  summary: LocalPerformanceSummary;
  capturedAt: string;
};
type CombatTargetReadout = {
  name: string; affiliation: string; distance: number; hull: number; maxHull: number;
  lockable: boolean; lockHeld: boolean;
};
type Hud = {
  speed: number; throttle: number; hull: number; energy: number; missiles: number; lock: number;
  objective: string; distance: number; stage: FlightState["stage"]; elapsed: number; droneHull: number;
  target: CombatTargetReadout | null; hits: number;
  flare: number; incoming: number; camera: "chase" | "cockpit";
  vectorDriftAvailable: boolean; drifting: boolean; crew: CrewRow[];
  tacticalCommandsAvailable: boolean; command: SectorTacticalCommand | null;
  factionContact: SectorFactionContact | null;
  evidence: Array<SectorEvidencePickup & { distanceMeters: number }>;
  operation: IronEclipseSnapshot | null;
};

const STEP = 1 / 60;
const MAX_CATCHUP = 5;
const LOCAL_PERFORMANCE_SAMPLE_SECONDS = 60;
const RUST_DISC_LOCAL_RUNTIME = createOrbitalRuntime(getGameModeDefinition("rust-disc-local"));
const STAGE_LABEL: Record<FlightState["stage"], string> = {
  relay: "PHASE 1 / SURVEY", drone: "PHASE 2 / ENGAGE", extract: "PHASE 3 / EXTRACT",
  complete: "SORTIE COMPLETE", destroyed: "HULL LOST",
};

// ---------- Hull silhouettes (extruded from roster plates, nose toward -Z) ----------
const POLY: Partial<Record<ShipId, number[]>> = {
  mandjet: [60,14,74,34,80,52,112,26,92,62,112,98,78,76,70,100,50,100,42,76,8,98,28,62,8,26,40,52,46,34],
  shakuna: [60,8,65,40,76,46,112,36,100,52,108,56,90,66,96,72,68,76,66,104,60,112,54,104,52,76,24,72,30,66,12,56,20,52,8,36,44,46,55,40],
  sundara: [60,4,66,30,70,70,70,104,66,112,54,112,50,104,50,70,54,30],
  tripura: [60,10,80,38,68,38,86,62,70,62,92,90,28,90,50,62,34,62,52,38,40,38],
  duskbreaker: [60,6,68,22,70,50,98,66,104,84,70,82,72,102,64,110,56,110,48,102,50,82,16,84,22,66,50,50,52,22],
  sentinel: [46,30,74,30,74,48,114,48,114,72,74,72,74,90,46,90,46,72,6,72,6,48,46,48],
  glide: [60,4,74,58,104,104,72,96,60,112,48,96,16,104,46,58],
};
const S = 40;

function hullShape(three: ThreeModule, id: ShipId): THREE_TYPES.Shape {
  const shape = new three.Shape();
  if (id === "splitter") {
    shape.absarc(0, 0, 48 / S, 0, Math.PI * 2, false);
    const hole = new three.Path();
    hole.absarc(0, 0, 30 / S, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return shape;
  }
  const p = POLY[id]!;
  for (let i = 0; i < p.length; i += 2) {
    const x = (p[i]! - 60) / S, y = (p[i + 1]! - 60) / S;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function buildHull(three: ThreeModule, id: ShipId, track: (d: { dispose(): void }) => void): THREE_TYPES.Group {
  const pal = FACTION_PALETTE[SHIPS[id].faction];
  const g = new three.Group();
  const geo = new three.ExtrudeGeometry(hullShape(three, id), { depth: 0.26, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 1 });
  geo.rotateX(Math.PI / 2); geo.translate(0, 0.13, 0);
  const hullMat = new three.MeshStandardMaterial({ color: pal.hull, metalness: 0.55, roughness: 0.5, flatShading: true });
  const trim = new three.MeshStandardMaterial({ color: pal.glow, emissive: pal.glow, emissiveIntensity: 0.9, roughness: 0.4 });
  const canopyMat = new three.MeshStandardMaterial({ color: 0x1a2028, metalness: 0.9, roughness: 0.15 });
  [geo, hullMat, trim, canopyMat].forEach(track);
  g.add(new three.Mesh(geo, hullMat));
  const spine = new three.BoxGeometry(0.16, 0.12, 2.0); track(spine);
  const sp = new three.Mesh(spine, trim); sp.position.set(0, 0.24, 0.1); sp.scale.set(1, 1, id === "splitter" ? 0.4 : 1); g.add(sp);
  const canopy = new three.SphereGeometry(0.22, 12, 8); track(canopy);
  const c = new three.Mesh(canopy, canopyMat); c.scale.set(1, 0.6, 1.8); c.position.set(0, 0.3, -0.45); g.add(c);
  const engineGeo = new three.SphereGeometry(0.16, 10, 8); track(engineGeo);
  const engMat = new three.MeshBasicMaterial({ color: pal.glow, transparent: true, opacity: 0.9 }); track(engMat);
  const plumeGeo = new three.ConeGeometry(0.16, 1.6, 10, 1, true); plumeGeo.rotateX(-Math.PI / 2); plumeGeo.translate(0, 0, 0.8); track(plumeGeo);
  const plumeMat = new three.MeshBasicMaterial({ color: pal.glow, transparent: true, opacity: 0.45, blending: three.AdditiveBlending, depthWrite: false }); track(plumeMat);
  const engines = new three.Group(); engines.name = "engines";
  for (const x of id === "sundara" ? [0] : [-0.28, 0.28]) {
    const e = new three.Mesh(engineGeo, engMat); e.position.set(x, 0.15, 1.3); engines.add(e);
    const pl = new three.Mesh(plumeGeo, plumeMat); pl.position.set(x, 0.15, 1.35); pl.name = "plume"; engines.add(pl);
  }
  g.add(engines);
  return g;
}

function marsTexture(three: ThreeModule): THREE_TYPES.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const x = c.getContext("2d")!;
  const grd = x.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#6b3a26"); grd.addColorStop(0.5, "#9a4e2e"); grd.addColorStop(1, "#5a2c1e");
  x.fillStyle = grd; x.fillRect(0, 0, 512, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(${rnd() > 0.5 ? "40,18,12" : "190,120,80"},${0.06 + rnd() * 0.12})`;
    x.beginPath(); x.ellipse(rnd() * 512, rnd() * 256, 6 + rnd() * 50, 3 + rnd() * 14, rnd() * 3, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = "rgba(235,225,210,0.55)"; x.fillRect(0, 0, 512, 10); x.fillRect(0, 248, 512, 8);
  const t = new three.CanvasTexture(c); t.colorSpace = three.SRGBColorSpace; return t;
}

function rockGeometry(three: ThreeModule): THREE_TYPES.BufferGeometry {
  const g = new three.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position as THREE_TYPES.BufferAttribute;
  const v = new three.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + 0.16 * Math.sin(v.x * 4.1 + v.y * 2.3) * Math.cos(v.z * 3.7) + 0.07 * Math.sin(v.y * 9 + v.x * 7);
    v.multiplyScalar(n); pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

// ---------------------------------------------------------------------------

export function RustDiscFlight({ onExit, expedition, expeditionHref }: { onExit?: () => void; expedition?: ExpeditionTransport; expeditionHref?: string }) {
  const [, setLocation] = useLocation();
  const net = !!expedition;
  const ironEclipse = net && expedition?.mission.id === "iron-eclipse";
  const trainingSearch = typeof window !== "undefined" ? window.location.search : "";
  const localSector = localTrainingSector(trainingSearch);
  const specialistOperation = new URLSearchParams(trainingSearch).get("operation") === CINDER_ASTEROID_OPERATION_ID;
  const instanceCandidate = new URLSearchParams(trainingSearch).get("instanceId") ?? "";
  const operationInstanceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(instanceCandidate)
    ? instanceCandidate
    : null;
  const leaveOperation = useLeaveWorldOperationInstance();
  const [hangarPresetShip] = useState<ShipId | null>(() => parseTrainingShipPreset(trainingSearch));
  const expeditionRef = useRef(expedition);
  expeditionRef.current = expedition;
  const [phase, setPhase] = useState<Phase>(net ? "flight" : "briefing");
  const [threeModule, setThreeModule] = useState<ThreeModule | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [shipId, setShipId] = useState<ShipId>(() => {
    const snap = expedition?.snapshotRef.current;
    const serverShip = snap?.pilots.find(p => p.slot === snap.ownSlot)?.shipId;
    return resolveInitialTrainingShip(trainingSearch, serverShip);
  });
  const [quality, setQuality] = useState<Quality>(() =>
    typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false) ? "low" : "high");
  const [runId, setRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [performanceReadout, setPerformanceReadout] = useState<PerformanceReadout | null>(null);
  const [localPerformanceCapturing, setLocalPerformanceCapturing] = useState(false);
  const [localPerformanceProgress, setLocalPerformanceProgress] = useState(0);
  const [localPerformanceReport, setLocalPerformanceReport] = useState<LocalPerformanceCaptureReport | null>(null);
  const [summary, setSummary] = useState<FlightState | null>(null);
  const [failure, setFailure] = useState("");

  const mountRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapOpenRef = useRef(false);
  const pilotMarkerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const markerRef = useRef<HTMLDivElement>(null);
  const droneMarkerRef = useRef<HTMLDivElement>(null);
  const evidenceMarkerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const inputRef = useRef<FlightControlFrame>(neutralFlightControls(0.35));
  const pulseRef = useRef({ missile: false, countermeasure: false });
  const pausedRef = useRef(false);
  const performanceOpenRef = useRef(false);
  const performanceReadoutRef = useRef<PerformanceReadout | null>(null);
  const localPerformanceRecorderRef = useRef<ReturnType<typeof createLocalPerformanceRecorder> | null>(null);
  const localPerformanceDeviceRef = useRef<LocalPerformanceDeviceInfo | null>(null);
  const localPerformanceStartElapsedRef = useRef(0);
  const cameraModeRef = useRef<"chase" | "cockpit">("chase");
  const keysRef = useRef(new Set<string>());
  const reducedMotion = useRef(typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false));
  mapOpenRef.current = mapOpen;

  const resetControls = useCallback(() => {
    const t = inputRef.current.throttle;
    inputRef.current = neutralFlightControls(t);
    pulseRef.current = { missile: false, countermeasure: false };
    keysRef.current.clear();
    window.dispatchEvent(new Event("wfm-flight-reset"));
  }, []);

  const setPausedBoth = useCallback((p: boolean) => {
    pausedRef.current = p; setPaused(p);
    if (p) { resetControls(); expeditionRef.current?.sendInput(holdInput()); }
  }, [resetControls]);

  const finishLocalPerformanceCapture = useCallback(() => {
    const recorder = localPerformanceRecorderRef.current;
    if (!recorder) return;
    setLocalPerformanceReport({
      device: localPerformanceDeviceRef.current ?? readLocalPerformanceDeviceInfo(),
      summary: recorder.finish(),
      capturedAt: new Date().toISOString(),
    });
    localPerformanceRecorderRef.current = null;
    localPerformanceDeviceRef.current = null;
    setLocalPerformanceCapturing(false);
    setPerformanceOpen(false);
    performanceOpenRef.current = false;
    setPausedBoth(true);
  }, [setPausedBoth]);

  const startLocalPerformanceCapture = () => {
    if (net || phase !== "flight") return;
    localPerformanceRecorderRef.current = createLocalPerformanceRecorder(LOCAL_PERFORMANCE_SAMPLE_SECONDS);
    localPerformanceDeviceRef.current = readLocalPerformanceDeviceInfo();
    localPerformanceStartElapsedRef.current = hud?.elapsed ?? 0;
    setLocalPerformanceProgress(0);
    setLocalPerformanceReport(null);
    setLocalPerformanceCapturing(true);
    performanceOpenRef.current = true;
    setPerformanceOpen(true);
    setPausedBoth(false);
  };

  const exit = useCallback(() => {
    pausedRef.current = true; resetControls();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    try { screen.orientation?.unlock?.(); } catch { /* unsupported */ }
    expeditionRef.current?.sendInput(holdInput());
    if (operationInstanceId && specialistOperation) {
      void leaveOperation.mutateAsync({ instanceId: operationInstanceId }).catch(() => undefined);
    }
    if (expeditionRef.current) expeditionRef.current.onExit(); else if (onExit) onExit(); else setLocation("/");
  }, [leaveOperation, onExit, operationInstanceId, resetControls, setLocation, specialistOperation]);

  const launch = useCallback(() => {
    if (!webglAvailable()) {
      setFailure("This browser could not create a WebGL context. Enable hardware acceleration in browser settings, close other 3D tabs, or update Chrome, then try again.");
      setPhase("unsupported"); return;
    }
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: "hide" })
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape"))
        .catch(() => undefined);
    }
    inputRef.current = neutralFlightControls(0.35);
    cameraModeRef.current = "chase";
    setSummary(null); setHud(null); setPortraitDismissed(false);
    setRendererReady(false);
    pausedRef.current = false; setPaused(false);
    setRunId(r => r + 1); setPhase("flight");
  }, []);

  // Portrait detection
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(mq.matches);
    update(); mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const portraitBlock = phase === "flight" && portrait && !portraitDismissed;
  useEffect(() => { if (portraitBlock) setPausedBoth(true); }, [portraitBlock, setPausedBoth]);
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    try { screen.orientation?.unlock?.(); } catch { /* unsupported */ }
  }, []);

  useEffect(() => {
    if (phase !== "flight" || threeModule) return;
    let active = true;
    void import("./three-flight-runtime").then((module) => {
      if (active) setThreeModule(module);
    }).catch(() => {
      if (!active) return;
      setFailure("The 3D flight systems could not load. Check your connection and try again.");
      setPhase("unsupported");
    });
    return () => { active = false; };
  }, [phase, threeModule]);

  // ---------- Renderer + loop ----------
  useEffect(() => {
    if (phase !== "flight" || !threeModule) return;
    const THREE = threeModule;
    const mount = mountRef.current; if (!mount) return;
    inputRef.current = neutralFlightControls(0.35);
    let summaryTimer: number | undefined;
    const disposables: { dispose(): void }[] = [];
    const track = (d: { dispose(): void }) => { disposables.push(d); };
    let renderer: THREE_TYPES.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: quality === "high", powerPreference: "high-performance" });
    } catch {
      setFailure("WebGL initialisation failed on this device. Try the LOW quality setting, enable hardware acceleration, or use a recent Chrome build.");
      setPhase("unsupported"); return;
    }
    // On touch devices, lower internal resolution avoids spending GPU time on
    // high-DPI subpixels while preserving the same scene and control layout.
    const dprCap = quality === "high" ? 2 : 1;
    const basePixelRatio = Math.min(window.devicePixelRatio || 1, dprCap);
    const framePacing = new FramePacingMonitor();
    const adaptiveResolution = new AdaptiveResolutionController();
    renderer.setPixelRatio(basePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x0a0710);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    let rendererReadySent = false;
    const markRendererReady = () => {
      if (rendererReadySent) return;
      rendererReadySent = true;
      setRendererReady(true);
    };
    let lost = false;
    const onLost = (e: Event) => { e.preventDefault(); lost = true; setFailure("The GPU dropped the 3D context (common when memory is tight). Return to briefing and relaunch on LOW quality."); setPhase("unsupported"); };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    const netMode = !!expeditionRef.current;
    const sector = expeditionRef.current?.mission.sector ?? localSector;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a0f10, quality === "high" ? 0.0011 : 0.0014);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 6000);

    scene.add(new THREE.HemisphereLight(0xe8c6a8, 0x12141c, 0.55));
    const sun = new THREE.DirectionalLight(0xffe2c0, 2.4); sun.position.set(-300, 200, 200); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x78a8d8, 0.6); rim.position.set(200, -80, -300); scene.add(rim);

    // Operation Iron Eclipse: authority remains in the snapshot; these meshes
    // are only a 3D reading of the server's current positions and subsystem state.
    const capital = new THREE.Group();
    const capitalHullMat = new THREE.MeshStandardMaterial({ color: 0x51463f, metalness: 0.78, roughness: 0.58, flatShading: true });
    const capitalTrimMat = new THREE.MeshStandardMaterial({ color: 0xe0a15a, metalness: 0.52, roughness: 0.34, emissive: 0x9b4f25, emissiveIntensity: 0.48 });
    const capitalDarkMat = new THREE.MeshStandardMaterial({ color: 0x232a31, metalness: 0.82, roughness: 0.44 });
    [capitalHullMat, capitalTrimMat, capitalDarkMat].forEach(track);
    const capitalParts: [THREE_TYPES.BufferGeometry, THREE_TYPES.Material, [number, number, number], [number, number, number]?][] = [
      [new THREE.BoxGeometry(34, 13, 92), capitalHullMat, [0, 0, 0]],
      [new THREE.BoxGeometry(57, 3.5, 25), capitalHullMat, [0, -1, 20]],
      [new THREE.BoxGeometry(48, 5, 23), capitalDarkMat, [0, 7, -5]],
      [new THREE.BoxGeometry(22, 9, 28), capitalHullMat, [0, 3, -29]],
      [new THREE.BoxGeometry(5, 8, 72), capitalTrimMat, [0, 8, 3]],
      [new THREE.BoxGeometry(48, 2, 4), capitalTrimMat, [0, 0, 15]],
      [new THREE.BoxGeometry(2, 3, 18), capitalTrimMat, [-17, 2, -17]],
      [new THREE.BoxGeometry(2, 3, 18), capitalTrimMat, [17, 2, -17]],
      [new THREE.CylinderGeometry(3.2, 4.6, 20, 8), capitalDarkMat, [-10, 0, 52], [Math.PI / 2, 0, 0]],
      [new THREE.CylinderGeometry(3.2, 4.6, 20, 8), capitalDarkMat, [10, 0, 52], [Math.PI / 2, 0, 0]],
    ];
    for (const [geo, mat, pos, rot] of capitalParts) {
      track(geo);
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...pos);
      if (rot) mesh.rotation.set(...rot);
      capital.add(mesh);
    }
    capital.visible = false;
    scene.add(capital);
    const operationSubsystems = new Map<string, THREE_TYPES.Group>();
    const operationWing = new Map<string, { group: THREE_TYPES.Group; shipId: ShipId }>();
    const subsystemGeo = new THREE.OctahedronGeometry(4, 0); track(subsystemGeo);
    const subsystemActiveMat = new THREE.MeshStandardMaterial({ color: 0xff7a5c, emissive: 0xb63420, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.45 });
    const subsystemDisabledMat = new THREE.MeshStandardMaterial({ color: 0x69736f, emissive: 0x29332f, emissiveIntensity: 0.15, metalness: 0.3, roughness: 0.8 });
    [subsystemActiveMat, subsystemDisabledMat].forEach(track);
    const subsystemRingGeo = new THREE.TorusGeometry(7, 0.35, 6, 28); track(subsystemRingGeo);
    const wingOperationVisible = !!ironEclipse;
    if (wingOperationVisible) {
      for (const id of ["point-defense", "shield-array", "reactor"] as const) {
        const group = new THREE.Group();
        const marker = new THREE.Mesh(subsystemGeo, subsystemActiveMat); group.add(marker);
        const ring = new THREE.Mesh(subsystemRingGeo, subsystemActiveMat); ring.rotation.x = Math.PI / 2; group.add(ring);
        operationSubsystems.set(id, group); group.visible = false; scene.add(group);
      }
    }

    // Mars + thin haze
    const marsTex = marsTexture(THREE); track(marsTex);
    const marsGeo = new THREE.SphereGeometry(1200, 48, 32); track(marsGeo);
    const marsMat = new THREE.MeshStandardMaterial({ map: marsTex, roughness: 1, metalness: 0, fog: false }); track(marsMat);
    const mars = new THREE.Mesh(marsGeo, marsMat); mars.position.set(-1550, 450, -3200); mars.rotation.z = 0.35; scene.add(mars);
    if (netMode && sector.planet) {
      // Physical SECTOR_MARS sphere: same centre/radius the server collides against.
      const P = sector.planet; mars.position.set(P.position.x, P.position.y, P.position.z); mars.scale.setScalar(P.radius / 1200);
    }
    const hazeGeo = new THREE.SphereGeometry(1240, 48, 32); track(hazeGeo);
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0xe08a5a, transparent: true, opacity: 0.12, side: THREE.BackSide, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }); track(hazeMat);
    const haze = new THREE.Mesh(hazeGeo, hazeMat); haze.position.copy(mars.position); haze.scale.copy(mars.scale); scene.add(haze);

    // Stars
    const starCount = quality === "high" ? 2400 : 1100;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 4200;
      const s = Math.sqrt(1 - u * u);
      starPos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
    }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3)); track(starGeo);
    const starMat = new THREE.PointsMaterial({ color: 0xe6dccb, size: 2.2, sizeAttenuation: false, fog: false }); track(starMat);
    const stars = new THREE.Points(starGeo, starMat); scene.add(stars);

    // Dust particles near player for speed sense
    const dustCount = quality === "high" ? 500 : 220;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i++) dustPos[i] = (Math.random() - 0.5) * 160;
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3)); track(dustGeo);
    const dustMat = new THREE.PointsMaterial({ color: 0xc89a78, size: 0.35, transparent: true, opacity: 0.55 }); track(dustMat);
    const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

    // Instanced asteroid field — exact RUST_DISC_SECTOR positions/radii
    const rockGeo = rockGeometry(THREE); track(rockGeo);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a4a36, roughness: 0.95, metalness: 0.08, flatShading: true }); track(rockMat);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, sector.rocks.length);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
    sector.rocks.forEach((r, i) => {
      e4.set(i * 1.7, i * 0.9, i * 2.3); q4.setFromEuler(e4);
      m4.compose(new THREE.Vector3(r.position.x, r.position.y, r.position.z), q4, new THREE.Vector3(r.radius, r.radius, r.radius));
      rocks.setMatrixAt(i, m4);
      rocks.setColorAt(i, new THREE.Color().setHSL(0.04 + (i % 4) * 0.008, 0.35, 0.22 + (i % 3) * 0.04));
    });
    rocks.instanceMatrix.needsUpdate = true; scene.add(rocks);

    // Damaged relay
    const relay = new THREE.Group();
    const R = sector.relay; relay.position.set(R.x, R.y, R.z);
    const relayMat = new THREE.MeshStandardMaterial({ color: 0x6e6a64, metalness: 0.7, roughness: 0.55, flatShading: true }); track(relayMat);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x2a3446, metalness: 0.4, roughness: 0.3, emissive: 0x0c1830 }); track(panelMat);
    const mastGeo = new THREE.CylinderGeometry(0.8, 1.2, 14, 8); track(mastGeo);
    relay.add(new THREE.Mesh(mastGeo, relayMat));
    const dishGeo = new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3); track(dishGeo);
    const dish = new THREE.Mesh(dishGeo, relayMat); dish.position.y = 7; dish.rotation.x = 1.9; relay.add(dish);
    const panelGeo = new THREE.BoxGeometry(10, 0.2, 3.4); track(panelGeo);
    const pA = new THREE.Mesh(panelGeo, panelMat); pA.position.set(-7, -2, 0); pA.rotation.z = 0.2; relay.add(pA);
    const pB = new THREE.Mesh(panelGeo, panelMat); pB.position.set(6.4, -4, 0.6); pB.rotation.set(0.5, 0.3, -0.7); relay.add(pB);
    const beaconGeo = new THREE.SphereGeometry(0.7, 10, 8); track(beaconGeo);
    const relayLightMat = new THREE.MeshBasicMaterial({ color: 0xe0a15a }); track(relayLightMat);
    const relayLight = new THREE.Mesh(beaconGeo, relayLightMat); relayLight.position.y = 7.6; relay.add(relayLight);
    const zoneGeo = new THREE.SphereGeometry(24, 24, 16); track(zoneGeo);
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xe6dccb, wireframe: true, transparent: true, opacity: 0.06 }); track(zoneMat);
    const relayZone = new THREE.Mesh(zoneGeo, zoneMat); relay.add(relayZone);
    relay.rotation.set(0.3, 0.6, 0.25);
    scene.add(relay);

    // Training drone (hostile marker red, independent of faction palette)
    const drone = new THREE.Group();
    const droneGeo = new THREE.OctahedronGeometry(2.6, 0); track(droneGeo);
    const droneMat = new THREE.MeshStandardMaterial({ color: 0x3c3432, metalness: 0.6, roughness: 0.4, emissive: 0xc45c48, emissiveIntensity: 0.25, flatShading: true }); track(droneMat);
    drone.add(new THREE.Mesh(droneGeo, droneMat));
    const ringGeo = new THREE.TorusGeometry(4.2, 0.18, 6, 32); track(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xc45c48 }); track(ringMat);
    const droneRing = new THREE.Mesh(ringGeo, ringMat); drone.add(droneRing);
    scene.add(drone);

    // Extraction beacon
    const X = sector.extraction;
    const beacon = new THREE.Group(); beacon.position.set(X.x, X.y, X.z);
    const pal = FACTION_PALETTE[SHIPS[shipId].faction];
    const exRingGeo = new THREE.TorusGeometry(26, 0.5, 6, 64); track(exRingGeo);
    const exMat = new THREE.MeshBasicMaterial({ color: pal.glow, transparent: true, opacity: 0.3 }); track(exMat);
    const exRing = new THREE.Mesh(exRingGeo, exMat); beacon.add(exRing);
    const exRing2 = new THREE.Mesh(exRingGeo, exMat); exRing2.rotation.y = Math.PI / 2; beacon.add(exRing2);
    const colGeo = new THREE.CylinderGeometry(0.6, 0.6, 400, 8, 1, true); track(colGeo);
    const colMat = new THREE.MeshBasicMaterial({ color: pal.glow, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }); track(colMat);
    beacon.add(new THREE.Mesh(colGeo, colMat));
    scene.add(beacon);

    // Player ship
    const ship = buildHull(THREE, shipId, track);
    scene.add(ship);
    const engines = ship.getObjectByName("engines")!;

    // Projectile pool
    const boltGeo = new THREE.BoxGeometry(0.18, 0.18, 3.2); track(boltGeo);
    const missileGeo = new THREE.ConeGeometry(0.35, 1.8, 8); missileGeo.rotateX(-Math.PI / 2); track(missileGeo);
    const friendlyMat = new THREE.MeshBasicMaterial({ color: pal.glow }); track(friendlyMat);
    const hostileMat = new THREE.MeshBasicMaterial({ color: 0xff7a5c }); track(hostileMat);
    const pool: THREE_TYPES.Mesh[] = [];
    for (let i = 0; i < 64; i++) { const m = new THREE.Mesh(boltGeo, friendlyMat); m.visible = false; scene.add(m); pool.push(m); }

    // Sim (local) or authoritative snapshot (network)
    const ownPilot = () => { const sn = expeditionRef.current?.snapshotRef.current; return sn?.pilots.find(p => p.slot === sn.ownSlot); };
    let state: FlightState = netMode ? (ownPilot()?.flight ?? createFlight(shipId, sector)) : createFlight(shipId);
    const others = new Map<number, { group: THREE_TYPES.Group; shipId: ShipId; engines: THREE_TYPES.Object3D }>();
    const remoteProjectiles: FlightState["projectiles"] = [];
    const seenPilots = new Set<number>();
    const seenWing = new Set<string>();
    let projectiles = state.projectiles;
    let inputTimer: number | undefined;
    if (netMode) {
      inputTimer = window.setInterval(() => {
        const t = expeditionRef.current; if (!t) return;
        if (pausedRef.current || document.hidden || t.connection !== "connected") { t.sendInput(holdInput()); return; }
        keyInput();
        const inp = inputRef.current;
        t.sendInput(sanitizeInput(toSectorFlightInput({ ...inp, missile: inp.missile || pulseRef.current.missile, countermeasure: inp.countermeasure || pulseRef.current.countermeasure })));
        pulseRef.current = { missile: false, countermeasure: false };
      }, SECTOR_INPUT_INTERVAL_MS);
    }
    const camPos = new THREE.Vector3(0, 4, 84);
    const camLook = new THREE.Vector3();
    const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    let shake = 0, lastHull = state.hull, lastHud = 0, raf = 0, last = performance.now(), acc = 0, ended = false;

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
      camera.aspect = w / h; camera.fov = w / h < 1 ? 82 : 68; camera.updateProjectionMatrix();
      camera.userData.lastProjectionFov = camera.fov;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    const place = (el: HTMLDivElement | null, p: { x: number; y: number; z: number }, show: boolean) => {
      if (!el) return;
      if (!show) { el.style.opacity = "0"; return; }
      tmpV.set(p.x, p.y, p.z).project(camera);
      let x = tmpV.x, y = tmpV.y;
      const behind = tmpV.z > 1;
      if (behind) { x = -x; y = -y; }
      const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
      if (off) { const k = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.86, 1e-3); x /= k; y /= k; if (behind) { x = x === 0 ? 0.92 : x; } }
      el.style.opacity = "1";
      el.style.transform = `translate(${(x * 0.5 + 0.5) * mount.clientWidth}px, ${(-y * 0.5 + 0.5) * mount.clientHeight}px)`;
      el.dataset.offscreen = off ? "1" : "0";
    };

    const keyInput = () => {
      const k = keysRef.current, inp = inputRef.current;
      const vectorDriftAvailable = !netMode ||
        expeditionRef.current?.snapshotRef.current?.capabilities?.vectorDrift === true;
      inp.drift = vectorDriftAvailable && k.has("KeyG");
      if (k.size === 0) return;
      const axis = (a: string, b: string) => (k.has(a) ? 1 : 0) - (k.has(b) ? 1 : 0);
      const p = axis("KeyS", "KeyW") || axis("ArrowDown", "ArrowUp");
      const y = axis("KeyD", "KeyA") || axis("ArrowRight", "ArrowLeft");
      const r = axis("KeyE", "KeyQ");
      if (p) inp.pitch = -p; if (y) inp.yaw = y; if (r) inp.roll = r; else if (y) inp.roll = y * COORDINATED_BANK;
      if (k.has("KeyR")) inp.throttle = Math.min(1, inp.throttle + STEP * 0.8);
      if (k.has("KeyF")) inp.throttle = Math.max(0, inp.throttle - STEP * 0.8);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (lost) return;
      const frameIntervalMs = Math.max(0, now - last);
      let dt = frameIntervalMs / 1000; last = now;
      dt = Math.min(dt, 0.25);
      const frameWindow = framePacing.record(now);
      if (frameWindow) {
        const nextScale = adaptiveResolution.update(frameWindow, now);
        if (nextScale !== null) renderer.setPixelRatio(basePixelRatio * nextScale);
        const readout = {
          window: frameWindow,
          scale: adaptiveResolution.currentScale,
          rttMs: expeditionRef.current?.latencyRef.current ?? null,
          heap: readBrowserHeap(),
        };
        performanceReadoutRef.current = readout;
        if (performanceOpenRef.current) setPerformanceReadout(readout);
      }
      const blend = netMode && !reducedMotion.current ? 1 - Math.exp(-dt * 16) : 1;
      if (netMode) {
        // Authoritative render: keep updating even while local controls are paused.
        const snap = expeditionRef.current?.snapshotRef.current;
        const own = snap?.pilots.find(p => p.slot === snap.ownSlot);
        if (own) state = own.flight;
        remoteProjectiles.length = 0;
        seenPilots.clear();
        for (const p of snap?.pilots ?? []) {
          for (const pr of p.flight.projectiles) {
            if (remoteProjectiles.length < 64) remoteProjectiles.push(pr);
          }
          if (p.slot === snap!.ownSlot) continue;
          seenPilots.add(p.slot);
          let o = others.get(p.slot);
          if (!o || o.shipId !== p.shipId) {
            if (o) scene.remove(o.group);
            const group = buildHull(THREE, p.shipId, track); scene.add(group);
            o = { group, shipId: p.shipId, engines: group.getObjectByName("engines")! };
            group.position.set(p.flight.position.x, p.flight.position.y, p.flight.position.z);
            others.set(p.slot, o);
          }
          o.group.visible = p.flight.stage !== "destroyed";
          tmpV.set(p.flight.position.x, p.flight.position.y, p.flight.position.z);
          o.group.position.lerp(tmpV, blend);
          tmpQ.set(p.flight.orientation.x, p.flight.orientation.y, p.flight.orientation.z, p.flight.orientation.w);
          o.group.quaternion.slerp(tmpQ, blend);
          o.engines.visible = p.connected;
        }
        for (const [slot, o] of others) if (!seenPilots.has(slot)) { scene.remove(o.group); others.delete(slot); }
        projectiles = remoteProjectiles;
      } else if (pausedRef.current || ended) {
        acc = 0;
        renderer.render(scene, camera);
        markRendererReady();
        return;
      }
      const authoritativeOperation = ironEclipse
        ? expeditionRef.current?.snapshotRef.current?.operation ?? null
        : null;
      if (authoritativeOperation) {
        const op = authoritativeOperation;
        capital.visible = true;
        capital.position.set(op.capitalPosition.x, op.capitalPosition.y, op.capitalPosition.z);
        for (const subsystem of op.subsystems) {
          let group = operationSubsystems.get(subsystem.id);
          if (!group) {
            group = new THREE.Group();
            const marker = new THREE.Mesh(subsystemGeo, subsystemActiveMat); group.add(marker);
            const ring = new THREE.Mesh(subsystemRingGeo, subsystemActiveMat); ring.rotation.x = Math.PI / 2; group.add(ring);
            operationSubsystems.set(subsystem.id, group); scene.add(group);
          }
          group.visible = true;
          group.position.set(subsystem.position.x, subsystem.position.y, subsystem.position.z);
          const mat = subsystem.disabled ? subsystemDisabledMat : subsystemActiveMat;
          if (group.userData.disabled !== subsystem.disabled) {
            group.children.forEach(child => { (child as THREE_TYPES.Mesh).material = mat; });
            group.userData.disabled = subsystem.disabled;
          }
          group.scale.setScalar(subsystem.id === op.target ? 1.45 : 1);
        }
        for (const [id, group] of operationSubsystems) {
          if (!op.subsystems.some(item => item.id === id)) group.visible = false;
        }
        seenWing.clear();
        for (const unit of op.wing) {
          seenWing.add(unit.id);
          let wingUnit = operationWing.get(unit.id);
          if (!wingUnit || wingUnit.shipId !== unit.shipId) {
            if (wingUnit) scene.remove(wingUnit.group);
            const group = buildHull(THREE, unit.shipId, track);
            group.scale.setScalar(2.2);
            scene.add(group);
            wingUnit = { group, shipId: unit.shipId };
            operationWing.set(unit.id, wingUnit);
          }
          wingUnit.group.visible = true;
          wingUnit.group.position.set(unit.position.x, unit.position.y, unit.position.z);
          wingUnit.group.rotation.y = 0;
          const enginesGroup = wingUnit.group.getObjectByName("engines");
          if (enginesGroup) enginesGroup.visible = unit.connected && unit.hull > 0;
        }
        for (const [id, unit] of operationWing) if (!seenWing.has(id)) unit.group.visible = false;
      } else {
        capital.visible = false;
        operationSubsystems.forEach(group => { group.visible = false; });
        operationWing.forEach(unit => { unit.group.visible = false; });
      }
      if (!netMode) acc += dt;
      let steps = 0;
      while (!netMode && acc >= STEP && steps < MAX_CATCHUP) {
        keyInput();
        const inp = inputRef.current;
        const tickInput: FlightInput = toSectorFlightInput({ ...inp, missile: inp.missile || pulseRef.current.missile, countermeasure: inp.countermeasure || pulseRef.current.countermeasure });
        stepFlight(state, tickInput, STEP, sector, RUST_DISC_LOCAL_RUNTIME.runtimeId);
        pulseRef.current = { missile: false, countermeasure: false };
        acc -= STEP; steps++;
      }
      if (steps === MAX_CATCHUP) acc = 0;

      if (mapOpenRef.current && mapCanvasRef.current) {
        drawFlightMap(mapCanvasRef.current, state, sector, expeditionRef.current?.snapshotRef.current?.evidence ?? []);
      }

      // Visual sync
      if (!netMode) projectiles = state.projectiles;
      if (!netMode && localPerformanceRecorderRef.current) {
        const recorder = localPerformanceRecorderRef.current;
        const sampleSeconds = Math.max(0, state.elapsed - localPerformanceStartElapsedRef.current);
        const nonActive = pausedRef.current || state.stage === "complete" || state.stage === "destroyed";
        recorder.recordFrame({
          timestampMs: now,
          frameIntervalMs,
          gameSeconds: sampleSeconds,
          pageVisible: !document.hidden,
          phase: nonActive ? "post-match" : "active-play",
        });
        if (frameWindow) {
          recorder.recordMemorySample(sampleSeconds, readBrowserHeap());
          setLocalPerformanceProgress(sampleSeconds);
        }
        if (recorder.isTargetReached()) finishLocalPerformanceCapture();
      }
      tmpV.set(state.position.x, state.position.y, state.position.z); ship.position.lerp(tmpV, blend);
      tmpQ.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w); ship.quaternion.slerp(tmpQ, blend);
      const inp = inputRef.current;
      const thrust = 0.35 + inp.throttle * (inp.boost && state.energy > 2 ? 2.2 : 1);
      let plumeIndex = 0;
      engines.children.forEach(c => {
        if (c.name !== "plume") return;
        const pulse = 0.95 + Math.sin(state.elapsed * 23 + plumeIndex++ * 1.7) * 0.05;
        c.scale.set(1, 1, thrust * pulse);
      });

      const d = state.drone.position;
      drone.position.set(d.x, d.y, d.z);
      drone.visible = state.drone.hull > 0;
      drone.rotation.y += reducedMotion.current ? 0 : 0.01;
      droneRing.rotation.x = state.elapsed * 1.3;
      droneMat.emissiveIntensity = state.stage === "drone" ? 0.6 + 0.3 * Math.sin(state.elapsed * 6) : 0.15;
      relayLightMat.color.setHex(state.stage === "relay" ? (Math.sin(state.elapsed * 5) > 0 ? 0xe0a15a : 0x2a1a10) : pal.glow);
      zoneMat.opacity = state.stage === "relay" ? 0.08 : 0.02;
      exMat.opacity = state.stage === "extract" ? 0.55 + 0.25 * Math.sin(state.elapsed * 4) : 0.12;
      exRing.rotation.z = state.elapsed * 0.3;

      let incomingCount = 0;
      for (let i = 0; i < pool.length; i++) {
        const m = pool[i]!, p = projectiles[i];
        if (!p) { m.visible = false; continue; }
        if (p.hostile) incomingCount++;
        m.visible = true;
        m.geometry = p.guided ? missileGeo : boltGeo;
        m.material = p.hostile ? hostileMat : friendlyMat;
        m.position.set(p.position.x, p.position.y, p.position.z);
        tmpV.set(p.position.x + p.velocity.x, p.position.y + p.velocity.y, p.position.z + p.velocity.z);
        m.lookAt(tmpV);
      }

      // Camera
      if (state.hull < lastHull) shake = reducedMotion.current ? 0 : 0.6;
      lastHull = state.hull;
      const fwd = flightForward(state.orientation);
      tmpQ.copy(ship.quaternion);
      const cockpit = cameraModeRef.current === "cockpit";
      ship.visible = !cockpit;
      const offset = cockpit ? tmpV.set(0, 0.5, -0.9) : tmpV.set(0, 2.4, 9.5);
      offset.applyQuaternion(tmpQ).add(ship.position);
      if (cockpit) camPos.copy(offset); else camPos.lerp(offset, reducedMotion.current ? 1 : 0.18);
      camera.position.copy(camPos);
      if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.88; }
      camera.up.set(0, 1, 0).applyQuaternion(tmpQ);
      camLook.set(ship.position.x + fwd.x * 30, ship.position.y + fwd.y * 30, ship.position.z + fwd.z * 30);
      camera.lookAt(camLook);
      const sp = vectorLength(state.velocity);
      const targetFov = (camera.aspect < 1 ? 82 : 68) + (reducedMotion.current ? 0 : Math.min(14, sp * 0.08));
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 5));
      if (Math.abs(camera.fov - camera.userData.lastProjectionFov) > 0.15) {
        camera.updateProjectionMatrix();
        camera.userData.lastProjectionFov = camera.fov;
      }
      dust.position.set(Math.round(state.position.x / 160) * 160, Math.round(state.position.y / 160) * 160, Math.round(state.position.z / 160) * 160);
      stars.position.copy(camera.position); mars.rotation.y += reducedMotion.current ? 0 : 0.00004;

      renderer.render(scene, camera);
      markRendererReady();

      const snapNow = netMode ? expeditionRef.current?.snapshotRef.current : null;
      const obj = flightObjective(state, sector);
      const activeSubsystem = authoritativeOperation?.subsystems.find(item => item.id === authoritativeOperation.target);
      const objectiveLabel = !ironEclipse ? obj.label
        : state.stage === "relay" ? "Rendezvous at the squadron beacon"
          : state.stage === "drone" ? `Disable ${activeSubsystem?.label.toLowerCase() ?? "the capital subsystem"}`
            : state.stage === "extract" ? "Break contact and reach extraction"
              : obj.label;
      place(markerRef.current, obj.position, state.stage !== "complete" && state.stage !== "destroyed");
      place(droneMarkerRef.current, d, state.stage === "drone" && state.drone.hull > 0);
      const evidenceSites = snapNow?.evidence ?? [];
      for (let i = 0; i < evidenceMarkerRefs.current.length; i++) {
        const site = evidenceSites[i];
        place(evidenceMarkerRefs.current[i] ?? null, site?.position ?? state.position,
          !!site && site.state !== "recovered" && site.state !== "unavailable");
      }
      let mi = 0;
      for (const [slot, o] of others) {
        const el = pilotMarkerRefs.current[mi++]; if (!el) continue;
        place(el, o.group.position, o.group.visible);
        const label = slotLabel(slot);
        if (el.textContent !== label) { el.textContent = label; el.style.color = FACTION_PALETTE[SHIPS[o.shipId].faction].accent; }
      }
      for (; mi < pilotMarkerRefs.current.length; mi++) place(pilotMarkerRefs.current[mi] ?? null, d, false);

      if (now - lastHud > 120) {
        lastHud = now;
        const dx = obj.position.x - state.position.x, dy = obj.position.y - state.position.y, dz = obj.position.z - state.position.z;
        const selectedSubsystem = authoritativeOperation?.subsystems.find(item => item.id === authoritativeOperation.target);
        const targetActive = state.stage === "drone" && state.drone.hull > 0;
        const targetPosition = selectedSubsystem?.position ?? state.drone.position;
        const targetDx = targetPosition.x - state.position.x;
        const targetDy = targetPosition.y - state.position.y;
        const targetDz = targetPosition.z - state.position.z;
        const targetMaxHull = selectedSubsystem?.maxHull ?? expeditionRef.current?.mission.sector.droneHull ?? RUST_DISC_SECTOR.droneHull ?? 60;
        const evidence = (snapNow?.evidence ?? []).map((site) => ({
          ...site,
          distanceMeters: vectorLength({
            x: site.position.x - state.position.x,
            y: site.position.y - state.position.y,
            z: site.position.z - state.position.z,
          }),
        }));
        setHud({
          speed: sp, throttle: inp.throttle, hull: state.hull, energy: state.energy, missiles: state.missiles,
          lock: state.lock, objective: objectiveLabel, distance: Math.sqrt(dx * dx + dy * dy + dz * dz), stage: state.stage,
          target: targetActive ? {
            name: selectedSubsystem?.label ?? (expeditionRef.current?.mission.id === "pale-beacons" ? "ROAMING PATROL LEAD" : "TRAINING DRONE"),
            affiliation: selectedSubsystem ? "HOSTILE CAPITAL" : "HOSTILE CONTACT",
            distance: Math.sqrt(targetDx * targetDx + targetDy * targetDy + targetDz * targetDz),
            hull: selectedSubsystem?.hull ?? state.drone.hull,
            maxHull: targetMaxHull,
            lockable: canLock(state, sector),
            lockHeld: inp.lock,
          } : null,
          hits: state.hits,
          elapsed: state.elapsed, droneHull: state.drone.hull, flare: state.flareCooldown,
          incoming: incomingCount, camera: cameraModeRef.current,
          vectorDriftAvailable: !netMode || snapNow?.capabilities?.vectorDrift === true,
          drifting: inp.drift === true,
          tacticalCommandsAvailable: snapNow?.capabilities?.tacticalCommands === true,
          factionContact: snapNow?.factionContact ?? null,
          command: snapNow?.command ?? null,
          evidence,
          operation: ironEclipse ? snapNow?.operation ?? null : null,
          crew: snapNow ? snapNow.pilots.map(p => ({ slot: p.slot, shipId: p.shipId, connected: p.connected, hull: p.flight.hull, own: p.slot === snapNow.ownSlot, host: p.slot === snapNow.hostSlot, stage: p.flight.stage })) : [],
        });
      }
      if (!netMode && (state.stage === "complete" || state.stage === "destroyed")) {
        if (localPerformanceRecorderRef.current) finishLocalPerformanceCapture();
        ended = true;
        summaryTimer = window.setTimeout(() => { setSummary({ ...state, projectiles: [] }); setPhase("summary"); }, 900);
      }
    };
    raf = requestAnimationFrame(frame);

    // Pause on hidden/blur, reset controls
    const onHidden = () => { if (document.hidden) setPausedBoth(true); };
    const onBlur = () => setPausedBoth(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyP") { if (!e.repeat) setPausedBoth(!pausedRef.current); return; }
      if (pausedRef.current) return;
      const inp = inputRef.current;
      if (["Space", "ShiftLeft", "ShiftRight", "KeyX", "KeyL", "KeyG", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
      if (e.code === "Space") inp.fire = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") inp.boost = true;
      if (e.code === "KeyX") inp.brake = true;
      if (e.code === "KeyL") inp.lock = true;
      if (e.code === "KeyG" && (!netMode || expeditionRef.current?.snapshotRef.current?.capabilities?.vectorDrift === true)) inp.drift = true;
      if (e.code === "KeyM") pulseRef.current.missile = true;
      if (e.code === "KeyC") pulseRef.current.countermeasure = true;
      if (e.code === "KeyV" && !e.repeat) cameraModeRef.current = cameraModeRef.current === "chase" ? "cockpit" : "chase";
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      const inp = inputRef.current;
      if (e.code === "Space") inp.fire = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") inp.boost = false;
      if (e.code === "KeyX") inp.brake = false;
      if (e.code === "KeyL") inp.lock = false;
      if (e.code === "KeyG") inp.drift = false;
      if (["KeyW", "KeyS", "ArrowUp", "ArrowDown"].includes(e.code)) inp.pitch = 0;
      if (["KeyA", "KeyD", "ArrowLeft", "ArrowRight"].includes(e.code)) inp.yaw = 0;
      if (["KeyQ", "KeyE"].includes(e.code)) inp.roll = 0;
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(raf);
      if (inputTimer !== undefined) window.clearInterval(inputTimer);
      expeditionRef.current?.sendInput(holdInput());
      if (summaryTimer !== undefined) window.clearTimeout(summaryTimer);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      rocks.dispose();
      disposables.forEach(d => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      inputRef.current = neutralFlightControls();
      keysRef.current.clear();
    };
  }, [phase, runId, shipId, quality, setPausedBoth, threeModule, finishLocalPerformanceCapture]);

  const restart = () => {
    const wasCapturing = Boolean(localPerformanceRecorderRef.current);
    if (wasCapturing) finishLocalPerformanceCapture();
    resetControls();
    launch();
    if (wasCapturing) setPausedBoth(true);
  };
  const toBriefing = () => {
    if (localPerformanceRecorderRef.current) finishLocalPerformanceCapture();
    resetControls(); pausedRef.current = true; setPhase("briefing");
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    try { screen.orientation?.unlock?.(); } catch { /* unsupported */ }
  };
  const toggleCam = () => { cameraModeRef.current = cameraModeRef.current === "chase" ? "cockpit" : "chase"; };
  const togglePerformance = () => {
    const next = !performanceOpenRef.current;
    performanceOpenRef.current = next;
    setPerformanceOpen(next);
    if (next) setPerformanceReadout(performanceReadoutRef.current);
  };

  // ---------- Render ----------
  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden bg-[#0a0710] text-bone" style={{ touchAction: phase === "flight" ? "none" : "pan-y" }} data-testid="screen-flight">
      {phase === "briefing" ? (
        <Briefing shipId={shipId} hangarPresetShip={hangarPresetShip} setShipId={setShipId} quality={quality} setQuality={setQuality} onLaunch={launch} onExit={exit} expeditionHref={expeditionHref} specialistOperation={specialistOperation} />
      ) : null}

      {phase === "flight" ? (
        <>
          <div ref={mountRef} className="absolute inset-0" data-testid="canvas-flight" />
          {!rendererReady ? (
            <div role="status" aria-live="polite" data-testid="status-flight-engine-loading"
              className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-[#0a0710]/95 px-6 text-center">
              <div className="border border-[#e0a15a]/50 bg-[#13161c]/95 px-6 py-5">
                <div className="font-hud text-xs tracking-[0.26em] text-[#e0a15a]">INITIALIZING FLIGHT SYSTEMS</div>
                <div className="mt-2 text-sm text-[#c8c1b4]">Loading the 3D flight engine…</div>
              </div>
            </div>
          ) : null}
          <div ref={markerRef} className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0">
            <ObjectiveMarker label={hud?.objective ?? ""} distance={hud?.distance ?? 0} />
          </div>
          <div ref={droneMarkerRef} className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0">
            <div className="absolute left-0 top-0 h-10 w-10 -translate-x-1/2 -translate-y-1/2 border-2 border-[#ff7a5c]" style={{ transform: `translate(-50%,-50%) rotate(${45 * (1 - (hud?.lock ?? 0))}deg)` }} />
          </div>
          {(hud?.evidence ?? []).map((site, index) => (
            <div key={site.id} ref={(element) => { evidenceMarkerRefs.current[index] = element; }}
              className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0" data-testid={`marker-evidence-${site.id}`}>
              <EvidenceMarker title={site.title} distance={site.distanceMeters} state={site.state} />
            </div>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} ref={el => { pilotMarkerRefs.current[i] = el; }} data-testid={`marker-pilot-${i}`}
              className="pointer-events-none absolute left-0 top-0 -ml-8 -mt-6 w-16 text-center font-hud text-[10px] tracking-[0.2em] opacity-0" />
          ))}
          {hud ? <FlightHud hud={hud} shipId={shipId}
            droneMax={hud.operation?.subsystems.find(item => item.id === hud.operation?.target)?.maxHull ?? expedition?.mission.sector.droneHull ?? 60}
            onTransponder={mode => expedition?.sendCommand({ type: "sector_transponder", mode }) ?? false}
            transponderDisabled={expedition?.connection !== "connected"} /> : null}
          {net && hud ? <CrewStrip crew={hud.crew} mission={expedition!.mission.title} command={hud.command} /> : null}
          {net && !ironEclipse && hud?.tacticalCommandsAvailable && hud.crew.some(c => c.own && c.host) ? (
            <SquadOrders crew={hud.crew} command={hud.command} notice={expedition!.notice}
              disabled={expedition!.connection !== "connected"} onCommand={expedition!.sendCommand} />
          ) : null}
          {ironEclipse && hud?.operation ? (
            <IronEclipsePanel operation={hud.operation} notice={expedition!.notice}
              disabled={expedition!.connection !== "connected" || !hud.crew.some(c => c.own && c.host)}
              onCommand={expedition!.sendCommand} />
          ) : null}
          {net && expedition!.connection !== "connected" ? (
            <div role="alert" className="pointer-events-none absolute inset-x-0 top-16 z-[5] mx-auto w-fit border-l-2 border-[#ff7a5c] bg-[#140d12]/90 px-4 py-2 font-hud text-xs tracking-[0.2em] text-[#ff7a5c]" data-testid="status-net-connection">
              {expedition!.connection === "reconnecting" ? "LINK INTERRUPTED · RECONNECTING · HOLDING POSITION" : "LINK LOST · THE SERVER CONTINUES WITHOUT YOU"}
            </div>
          ) : null}
          {performanceOpen ? (
            <div className="pointer-events-none absolute right-3 top-3 z-30 w-44 border border-spectral/50 bg-[#080b12]/90 px-3 py-2 font-mono text-[10px] leading-relaxed text-bone shadow-xl sm:right-5 sm:top-5 sm:w-52"
              data-testid="panel-flight-performance" role="status" aria-label="Flight performance diagnostics">
              <p className="font-hud tracking-[0.16em] text-spectral">FLIGHT DIAGNOSTICS</p>
              {performanceReadout ? (
                <>
                  <p>{performanceReadout.window.fps.toFixed(0)} FPS · P95 ≈ {performanceReadout.window.p95FrameMs.toFixed(1)} ms</p>
                  {localPerformanceCapturing ? (
                    <p>SAMPLE {Math.min(LOCAL_PERFORMANCE_SAMPLE_SECONDS, Math.floor(localPerformanceProgress))}/{LOCAL_PERFORMANCE_SAMPLE_SECONDS} ACTIVE SEC</p>
                  ) : null}
                  <p>LONG FRAMES {performanceReadout.window.longFrameCount}/s · RES {Math.round(performanceReadout.scale * 100)}%</p>
                  <p>NETWORK RTT {net ? performanceReadout.rttMs === null ? "MEASURING" : `${performanceReadout.rttMs} ms` : "LOCAL ONLY"}</p>
                  <p>JS HEAP {performanceReadout.heap
                    ? `${(performanceReadout.heap.usedBytes / 1048576).toFixed(1)} / ${(performanceReadout.heap.totalBytes / 1048576).toFixed(1)} MiB`
                    : "UNAVAILABLE"}</p>
                </>
              ) : <p>CALIBRATING · 1 SECOND</p>}
            </div>
          ) : null}
          <TouchControls inputRef={inputRef} pulseRef={pulseRef} disabled={paused}
            missileReady={Boolean(hud?.target && hud.lock >= 1 && hud.missiles > 0)} missiles={hud?.missiles ?? 0} incoming={hud?.incoming ?? 0}
            onPause={() => setPausedBoth(true)} onCamera={toggleCam} onMap={() => setMapOpen(true)} throttle={hud?.throttle ?? 0.35}
            vectorDriftAvailable={hud?.vectorDriftAvailable ?? false} />
          {net && hud?.evidence.length ? (
            <EvidenceRecoveryControl
              evidence={hud.evidence}
              disabled={paused || expedition!.connection !== "connected"}
              onRecover={() => expedition!.sendCommand({ type: "sector_recover_evidence" })}
            />
          ) : null}
          {mapOpen && hud ? (
            <div className="pilot-map-backdrop absolute inset-0 z-20 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Rust Disc tactical map">
              <div className="pilot-map-panel">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-hud text-xs tracking-[0.24em] text-solar">RUST DISC · SECTOR MAP</p>
                    <p className="mt-1 font-hud text-sm tracking-wider text-bone">{hud.objective.toUpperCase()} · {Math.round(hud.distance)}M</p>
                  </div>
                  <PilotActionButton icon="pause" label="Close sector map" testId="button-close-tactical-map" onActivate={() => setMapOpen(false)} />
                </div>
                <canvas ref={mapCanvasRef} width={320} height={320} className="pilot-map-canvas" aria-label="Sector map showing your ship, rocks, relay, extraction, hostile patrol, and recoverable evidence" />
                <div className="pilot-map-legend font-hud text-[10px] tracking-widest">
                  <span><i className="pilot-map-key pilot-map-friendly" /> PILOT</span>
                  <span><i className="pilot-map-key pilot-map-hostile" /> ACTIVE HOSTILE</span>
                  <span><i className="pilot-map-key pilot-map-objective" /> MISSION</span>
                  <span><i className="pilot-map-key pilot-map-evidence" /> RECOVERABLE INTEL</span>
                </div>
                <p className="mt-2 text-center font-hud text-[9px] tracking-widest text-muted">MAP OPEN · FLIGHT SIMULATION CONTINUES</p>
              </div>
            </div>
          ) : null}
          {paused && !portraitBlock ? (
            <Overlay translucent={net} title={net ? "CONTROLS PAUSED" : "HOLDING POSITION"} sub={net
              ? "Your hull is transmitting neutral throttle and brake. The expedition server keeps running and your crew keeps flying; you are still visible and can take damage."
              : "Local trainer paused. Nothing online is waiting on you."}>
              <OverlayButton primary onClick={() => setPausedBoth(false)} testId="button-resume">{net ? "RESUME CONTROLS" : "RESUME"}</OverlayButton>
              {net ? null : <OverlayButton onClick={restart} testId="button-restart">RESTART SORTIE</OverlayButton>}
              <OverlayButton onClick={toggleCam} testId="button-camera">TOGGLE CHASE / COCKPIT</OverlayButton>
              <OverlayButton onClick={togglePerformance} testId="button-flight-performance">
                {performanceOpen ? "HIDE PERFORMANCE HUD" : "SHOW PERFORMANCE HUD"}
              </OverlayButton>
              {!net && !localPerformanceCapturing ? (
                <OverlayButton onClick={startLocalPerformanceCapture} testId="button-start-rust-disc-performance-sample">
                  START 60S LOCAL FLIGHT SAMPLE
                </OverlayButton>
              ) : null}
              {!net && localPerformanceCapturing ? (
                <OverlayButton onClick={finishLocalPerformanceCapture} testId="button-stop-rust-disc-performance-sample">
                  STOP & VIEW PARTIAL REPORT
                </OverlayButton>
              ) : null}
              {net ? null : <OverlayButton onClick={toBriefing} testId="button-briefing">BACK TO BRIEFING</OverlayButton>}
              <OverlayButton onClick={exit} testId="button-exit">{net ? "LEAVE EXPEDITION" : "EXIT TO COMMAND"}</OverlayButton>
              <p className="mt-2 font-hud text-[10px] tracking-[0.2em] text-muted">KEYS: W/S PITCH · A/D YAW · Q/E ROLL · R/F THROTTLE · SHIFT BOOST · X BRAKE · G DRIFT · SPACE GUNS · L LOCK · M MISSILE · C FLARE · V CAMERA · P PAUSE</p>
            </Overlay>
          ) : null}
          {portraitBlock ? (
            <Overlay translucent={net} title="ROTATE TO LANDSCAPE" sub={net ? "Controls held at neutral while in portrait. The server and your crew continue." : "The trainer flies sideways. Your sortie is paused locally until you turn the phone."}>
              <div className="mx-auto my-2 h-16 w-10 animate-pulse rounded-sm border-2 border-spectral" style={{ transform: "rotate(90deg)" }} />
              <OverlayButton onClick={() => { setPortraitDismissed(true); setPausedBoth(false); }} testId="button-fly-portrait">FLY IN PORTRAIT ANYWAY</OverlayButton>
              {net ? <OverlayButton onClick={exit} testId="button-portrait-exit">LEAVE EXPEDITION</OverlayButton> : <OverlayButton onClick={toBriefing} testId="button-portrait-briefing">BACK TO BRIEFING</OverlayButton>}
            </Overlay>
          ) : null}
        </>
      ) : null}

      {phase === "summary" && summary ? (
        <Summary s={summary} onRestart={restart} onBriefing={toBriefing} onExit={exit} />
      ) : null}

      {localPerformanceReport && !net ? (
        <div
          className="pointer-events-auto absolute inset-0 z-[80] overflow-y-auto bg-[#07090c]/95 px-3 py-4 sm:px-6 sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Rust Disc local flight performance report"
          data-testid="rust-disc-performance-report"
        >
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => setLocalPerformanceReport(null)}
              className="min-h-11 border border-bone/30 px-4 font-hud text-xs tracking-widest text-bone"
              data-testid="button-close-rust-disc-performance-report"
            >
              CLOSE REPORT · RETURN TO PAUSE
            </button>
            <LocalPerformanceReport
              device={localPerformanceReport.device}
              summary={localPerformanceReport.summary}
              capturedAt={localPerformanceReport.capturedAt}
              title="Rust Disc local no-reward flight frame pacing sample"
              buttonClassName="mt-3 min-h-11 bg-solar px-5 font-hud text-xs tracking-widest text-void"
            />
          </div>
        </div>
      ) : null}

      {phase === "unsupported" ? (
        <Overlay title="3D FLIGHT UNAVAILABLE" sub={failure}>
          <OverlayButton primary onClick={() => { setQuality("low"); setPhase(net ? "flight" : "briefing"); }} testId="button-retry-low">RETRY ON LOW QUALITY</OverlayButton>
          <OverlayButton onClick={exit} testId="button-unsupported-exit">EXIT TO COMMAND</OverlayButton>
        </Overlay>
      ) : null}
    </div>
  );
}

export default RustDiscFlight;

// ---------- Briefing ----------
function Briefing(props: {
  shipId: ShipId; hangarPresetShip: ShipId | null; setShipId: (s: ShipId) => void; quality: Quality; setQuality: (q: Quality) => void;
  onLaunch: () => void; onExit: () => void; expeditionHref?: string; specialistOperation: boolean;
}) {
  const def = SHIPS[props.shipId];
  const pal = FACTION_PALETTE[def.faction];
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "radial-gradient(120% 90% at 80% 110%, #5a2a1c 0%, #1c1016 45%, #0a0710 100%)" }}>
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl gap-5 p-4 md:grid-cols-[1.1fr_1fr] md:p-8">
        <section className="flex flex-col">
          <div className="flex items-center justify-between">
            <p className="font-hud text-[11px] tracking-[0.3em] text-muted">{props.specialistOperation ? "CINDER RING · LEGACY FLIGHT ADAPTER" : "LOCAL TRAINER · NO REWARDS · OFFLINE"}</p>
            <button onClick={props.onExit} className="min-h-11 border border-bone/25 px-3 font-hud text-xs tracking-widest" data-testid="button-briefing-exit">EXIT</button>
          </div>
          <h1 className="mt-4 font-hud text-5xl leading-[0.9] tracking-tight md:text-7xl">{props.specialistOperation ? <>CINDER<br />RING</> : <>RUST<br />DISC</>}</h1>
          <p className="mt-2 font-hud text-sm tracking-[0.25em] text-solar">{props.specialistOperation ? "ASTEROID BELT · FLIGHT CIRCUIT" : "MARS HIGH ORBIT · TRAINING SORTIE"}</p>
          {props.specialistOperation ? <p className="mt-3 max-w-xl border-l-2 border-solar/60 pl-3 text-sm leading-relaxed text-muted">A distinct legacy flight-simulation operation hosted at a navigable universe destination. This is local practice only; no live match, spectator feed, account write, or reward is active.</p> : null}
          <ol className="mt-6 space-y-3 border-l-2 border-bone/20 pl-4 text-sm">
            <li><span className="font-hud tracking-widest text-bone">01 SURVEY</span><span className="block text-muted">A relay went quiet inside the debris disc. Fly within 24m to pull its log.</span></li>
            <li><span className="font-hud tracking-widest text-bone">02 ENGAGE</span><span className="block text-muted">After the relay, center the hostile contact in your reticle. Hold GUNS for primary fire; hold LOCK until confirmed, then tap MSL. Flares clear incoming rounds.</span></li>
            <li><span className="font-hud tracking-widest text-bone">03 EXTRACT</span><span className="block text-muted">Reach the beacon ring. Rocks are solid and the drone cannot shoot through them.</span></li>
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="font-hud text-xs tracking-widest text-muted">RENDER</span>
            {(["low", "high"] as const).map(q => (
              <button key={q} onClick={() => props.setQuality(q)} data-testid={`button-quality-${q}`}
                className={`min-h-11 px-4 font-hud text-xs tracking-widest ${props.quality === q ? "bg-bone text-void" : "border border-bone/25"}`}>
                {q === "low" ? "LOW · BATTERY" : "HIGH · DETAIL"}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Results stay on this device and are discarded when you leave. Credits, ranks and loadouts are untouched.</p>
          {props.expeditionHref ? (
            <Link href={props.expeditionHref} data-testid="link-expedition" className="mt-4 block border-l-2 border-spectral bg-spectral/10 px-3 py-2">
              <span className="block font-hud text-sm tracking-[0.2em] text-spectral">CO-OP SECTOR EXPEDITION</span>
              <span className="block text-xs text-muted">Sign in and fly 1-8 pilots on a server-run sector. Three missions, persisted progress.</span>
            </Link>
          ) : null}
        </section>
        <section className="flex flex-col">
          <div className="relative aspect-square max-h-[42vh] w-full self-center md:max-h-none" style={{ filter: `drop-shadow(0 0 18px ${pal.accent}55)` }}>
            <ShipIllustration ship={props.shipId} caption={false} />
          </div>
          <p className="font-hud text-3xl leading-none" style={{ color: pal.accent }}>{def.name.toUpperCase()}</p>
          <p className="font-hud text-xs tracking-[0.25em] text-muted">{def.faction === "ussf" ? "USSF" : "THE ACCORD"} · {def.role.toUpperCase()} · TOP {Math.round(def.maxSpeed * 2.5)} M/S</p>
          <dl className="mt-3 grid grid-cols-3 gap-px border border-bone/15 bg-bone/10 font-hud">
            {([
              ["SHIELD", def.shield],
              ["HULL", def.hull],
              ["THRUST", def.accel],
              ["PULSE DMG", def.shotDmg],
              ["SHOT RATE", `${(1 / def.fireInterval).toFixed(1)}/s`],
              ["ULT CD", `${def.ultCd}s`],
            ] as const).map(([label, value]) => (
              <div key={label} className="bg-[#0a0710]/90 px-2 py-2">
                <dt className="text-[9px] tracking-[0.16em] text-muted">{label}</dt>
                <dd className="text-base leading-tight">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 font-hud text-[10px] tracking-[0.16em] text-muted">
            SPECIAL SYSTEM · {def.ultName.toUpperCase()}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted" data-testid="text-training-loadout-scope">
            {props.hangarPresetShip === props.shipId
              ? "Preselected from the Hangar launch link. "
              : "Local training configuration. "}
            Changing hulls here affects this sortie only; it never overwrites the saved Hangar loadout.
          </p>
          {(["ussf", "accord"] as const).map(f => (
            <div key={f} className="mt-3">
              <p className="mb-1 font-hud text-[10px] tracking-[0.3em]" style={{ color: FACTION_PALETTE[f].accent }}>{f === "ussf" ? "USSF" : "THE ACCORD"}</p>
              <div className="grid grid-cols-4 gap-1">
                {ROSTER[f].map(id => (
                  <button key={id} onClick={() => props.setShipId(id)} data-testid={`button-hull-${id}`}
                    className="min-h-12 border px-1 font-hud text-[11px] tracking-wider"
                    style={{ borderColor: id === props.shipId ? FACTION_PALETTE[f].accent : "rgba(230,225,214,0.18)", background: id === props.shipId ? `${FACTION_PALETTE[f].accent}22` : "transparent" }}>
                    {SHIPS[id].name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={props.onLaunch} data-testid="button-launch"
            className="mt-5 min-h-14 font-hud text-lg tracking-[0.3em] text-void" style={{ background: pal.accent }}>
            LAUNCH
          </button>
        </section>
      </div>
    </div>
  );
}

// ---------- HUD ----------
function Bar({ label, value, color, testId }: { label: string; value: number; color: string; testId: string }) {
  return (
    <div className="w-28 md:w-36" data-testid={testId}>
      <div className="flex justify-between font-hud text-[10px] tracking-[0.2em]"><span className="text-muted">{label}</span><span>{Math.round(value)}</span></div>
      <div className="h-1.5 bg-bone/15"><div className="h-full origin-left" style={{ background: color, transform: `scaleX(${Math.max(0, value) / 100})` }} /></div>
    </div>
  );
}

function CrewStrip({ crew, mission, command }: { crew: CrewRow[]; mission: string; command: SectorTacticalCommand | null }) {
  return (
    <div className="pointer-events-none absolute left-3 top-16 w-40 font-hud" data-testid="panel-crew">
      <p className="truncate text-[9px] tracking-[0.25em] text-muted">{mission.toUpperCase()} · SERVER</p>
      {command ? <p className="mt-1 border-l border-solar pl-1.5 text-[9px] leading-snug text-solar" data-testid="status-crew-order">{describeSectorCommand(command)}</p> : null}
      <ul className="mt-1 space-y-0.5">
        {crew.map(c => {
          const accent = FACTION_PALETTE[SHIPS[c.shipId].faction].accent;
          return (
            <li key={c.slot} className="flex items-center gap-1.5 text-[10px] tracking-[0.15em]" style={{ opacity: c.connected ? 1 : 0.45 }}>
              <span className="h-2 w-1" style={{ background: accent }} />
              <span className={c.own ? "text-bone" : "text-bone/75"}>{slotLabel(c.slot)}{c.own ? " · YOU" : ""}{c.host ? " · H" : ""}</span>
              <span className="ml-auto" style={{ color: c.stage === "destroyed" ? "#ff7a5c" : accent }}>{!c.connected ? "LINK" : c.stage === "destroyed" ? "DOWN" : Math.round(c.hull)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FlightHud({ hud, shipId, droneMax, onTransponder, transponderDisabled }: {
  hud: Hud; shipId: ShipId; droneMax: number;
  onTransponder: (mode: SectorTransponderRequest["mode"]) => boolean;
  transponderDisabled: boolean;
}) {
  const pal = FACTION_PALETTE[SHIPS[shipId].faction];
  const t = Math.floor(hud.elapsed);
  return (
    <div className="pointer-events-none absolute inset-0 font-hud">
      <div className="absolute left-1/2 top-2 -translate-x-1/2 text-center">
        <p className="text-[10px] tracking-[0.3em] text-muted">{STAGE_LABEL[hud.stage]} · {String(Math.floor(t / 60)).padStart(2, "0")}:{String(t % 60).padStart(2, "0")}</p>
        <p className="mt-0.5 text-xs tracking-[0.15em]" data-testid="text-objective">{hud.objective.toUpperCase()} · {Math.round(hud.distance)}M</p>
        {hud.stage === "drone" ? <p className="text-[9px] tracking-[0.2em] text-[#ff7a5c]">{hud.target?.name ?? "DRONE"} {Math.round(hud.droneHull)} / {droneMax}</p> : null}
        {hud.incoming > 0 ? <p className="mt-1 animate-pulse text-[10px] tracking-[0.3em] text-[#ff7a5c]" data-testid="status-incoming">INCOMING {hud.incoming}</p> : null}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[3.8rem] z-[4] w-56 -translate-x-1/2 text-center" data-testid="panel-combat-target">
        {hud.target ? (
          <>
            <div className="flex items-center justify-between gap-2 font-hud text-[9px] tracking-[0.18em]">
              <span className="truncate text-[#ff7a5c]">{hud.target.affiliation} · {hud.target.name}</span>
              <span className="shrink-0 text-bone">{Math.round(hud.target.distance)}M</span>
            </div>
            <div className="mt-1 h-0.5 bg-bone/15" role="progressbar" aria-label={`${hud.target.name} hull`} aria-valuemin={0} aria-valuemax={hud.target.maxHull} aria-valuenow={hud.target.hull}>
              <div className="h-full bg-[#ff7a5c]" style={{ width: `${Math.max(0, Math.min(100, hud.target.hull / Math.max(1, hud.target.maxHull) * 100))}%` }} />
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[8px] tracking-[0.12em]">
              <span className="text-bone/80">{combatLockCue({ targetActive: true, canAcquire: hud.target.lockable, lockHeld: hud.target.lockHeld, lock: hud.lock })}</span>
              {hud.hits > 0 ? <span className="shrink-0 text-solar">HITS {hud.hits}</span> : null}
            </div>
          </>
        ) : (
          <p className="font-hud text-[9px] tracking-[0.14em] text-muted" data-testid="status-no-combat-target">
            {combatLockCue({ targetActive: false, canAcquire: false, lockHeld: false, lock: hud.lock })}
          </p>
        )}
        {hud.factionContact ? (
          <div className="pointer-events-auto mt-1 flex items-center justify-between gap-2 border-t border-bone/15 pt-1 font-hud text-[8px] tracking-[0.14em]" data-testid="status-faction-contact">
            <span className={hud.factionContact.action === "intercept" || hud.factionContact.action === "request_reinforcements" ? "text-[#ff7a5c]" : "text-solar"}>
              {hud.factionContact.action === "none" ? "NO SENSOR CONTACT"
                : hud.factionContact.action === "scan" ? "SCOUT INVESTIGATING"
                : hud.factionContact.action === "shadow" ? `${hud.factionContact.actorFaction.toUpperCase()} PATROL SHADOWING`
                : hud.factionContact.action === "challenge" ? "IFF CHALLENGE"
                : hud.factionContact.action === "warn" ? "WARNING ISSUED"
                : hud.factionContact.action === "intercept" ? "INTERCEPTING"
                : "REINFORCEMENTS REQUESTED"}
            </span>
            <button type="button" disabled={transponderDisabled}
              aria-label={hud.factionContact.transponder === "broadcast" ? "Silence identification transponder" : "Broadcast identification transponder"}
              aria-pressed={hud.factionContact.transponder === "broadcast"}
              data-testid="button-transponder-toggle"
              onClick={() => onTransponder(hud.factionContact!.transponder === "broadcast" ? "silent" : "broadcast")}
              className="min-h-7 border border-solar/50 px-2 text-solar disabled:opacity-40">
              IFF {hud.factionContact.transponder === "broadcast" ? "TX" : "DARK"}
            </button>
          </div>
        ) : null}
      </div>
      <div className="absolute left-3 top-2 space-y-1">
        <Bar label="HULL" value={hud.hull} color={hud.hull < 30 ? "#ff7a5c" : "#e6e1d6"} testId="status-hull" />
        <Bar label="ENERGY" value={hud.energy} color={pal.accent} testId="status-energy" />
      </div>
      <div className="absolute right-3 top-2 text-right text-[9px] tracking-[0.16em]">
        <p data-testid="text-speed"><span className="text-2xl tracking-normal">{Math.round(hud.speed)}</span> M/S</p>
        <p className="text-muted">THR {Math.round(hud.throttle * 100)}% · MSL {hud.missiles}</p>
        {hud.drifting ? <p className="text-solar" data-testid="status-vector-drift">VECTOR DRIFT ACTIVE</p> : null}
        {hud.flare > 0 ? <p className="text-[#ff7a5c]">FLARE {Math.ceil(hud.flare)}S</p> : null}
      </div>
      <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-0 h-2 w-px bg-bone/70" /><div className="absolute bottom-0 left-1/2 h-2 w-px bg-bone/70" />
        <div className="absolute left-0 top-1/2 h-px w-2 bg-bone/70" /><div className="absolute right-0 top-1/2 h-px w-2 bg-bone/70" />
        {hud.lock > 0 ? <div className="absolute -inset-3 rounded-full border-2" style={{ borderColor: hud.lock >= 1 ? "#ff7a5c" : pal.accent, opacity: 0.4 + hud.lock * 0.6 }} /> : null}
      </div>
      {hud.lock >= 1 ? <p className="absolute left-1/2 top-[58%] -translate-x-1/2 text-xs tracking-[0.3em] text-[#ff7a5c]">LOCKED · TAP MISSILE</p> : null}
    </div>
  );
}

function drawFlightMap(
  canvas: HTMLCanvasElement,
  state: FlightState,
  sector: FlightSector,
  evidence: readonly SectorEvidencePickup[] = [],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = Math.min(canvas.width, canvas.height);
  const center = size / 2;
  const radius = center - 14;
  const scale = radius / Math.max(1, sector.radius);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#080b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(center, center);
  ctx.strokeStyle = "rgba(230,225,214,.16)";
  ctx.lineWidth = 1;
  for (const ring of [0.33, 0.66, 1]) {
    ctx.beginPath();
    ctx.arc(0, 0, radius * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  const point = (x: number, z: number) => [x * scale, z * scale] as const;
  ctx.fillStyle = "rgba(141,135,124,.65)";
  for (const rock of sector.rocks) {
    const [x, y] = point(rock.position.x, rock.position.z);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, rock.radius * scale), 0, Math.PI * 2);
    ctx.fill();
  }
  const marker = (position: { x: number; z: number }, color: string, shape: "square" | "circle") => {
    const [x, y] = point(position.x - state.position.x, position.z - state.position.z);
    ctx.fillStyle = color;
    if (shape === "square") ctx.fillRect(x - 5, y - 5, 10, 10);
    else {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  marker(sector.relay, "#55d7ef", "square");
  marker(sector.extraction, "#e0a15a", "square");
  if (state.stage === "drone" && state.drone.hull > 0) marker(state.drone.position, "#ff7a5c", "circle");
  for (const site of evidence) {
    if (site.state !== "recovered" && site.state !== "unavailable") marker(site.position, "#b9a4ff", "square");
  }
  ctx.save();
  ctx.rotate(Math.atan2(
    2 * (state.orientation.w * state.orientation.y + state.orientation.x * state.orientation.z),
    1 - 2 * (state.orientation.y * state.orientation.y + state.orientation.z * state.orientation.z),
  ));
  ctx.fillStyle = "#f3eee5";
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function describeSectorCommand(command: SectorTacticalCommand): string {
  if (command.order === "attack") return "ORDER · ATTACK HOSTILE DRONE";
  const target = slotLabel(command.targetSlot);
  if (command.order === "defend") return `ORDER · DEFEND ${target}`;
  if (command.order === "escort") return `ORDER · ESCORT ${target}`;
  return `ORDER · REGROUP ON ${target}`;
}

function SquadOrders({ crew, command, notice, disabled, onCommand }: {
  crew: CrewRow[]; command: SectorTacticalCommand | null; notice: string; disabled: boolean;
  onCommand: (request: SectorCommandRequest) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(-1);
  const wingmates = crew.filter(pilot => !pilot.own && pilot.connected);
  const targetSlot = wingmates.some(pilot => pilot.slot === selectedSlot)
    ? selectedSlot : wingmates[0]?.slot ?? -1;
  const [sendError, setSendError] = useState("");
  useEffect(() => { if (notice) setOpen(true); }, [notice]);
  const issue = (request: SectorCommandRequest) => {
    setSendError("");
    if (!onCommand(request)) setSendError("ORDER NOT SENT · LINK UNAVAILABLE");
  };
  return (
    <div className="pointer-events-auto absolute right-2 top-32 z-[8] w-52 font-hud sm:right-4 sm:top-28" data-testid="panel-squad-orders">
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
        className="min-h-10 w-full border border-solar/60 bg-void/90 px-3 text-[10px] tracking-[0.2em] text-solar"
        data-testid="button-squad-orders">
        {open ? "CLOSE ORDERS" : "SQUAD ORDERS"}
      </button>
      {open ? (
        <section className="mt-1 border border-bone/25 bg-void/95 p-2 shadow-xl" aria-label="Tactical squad orders">
          <p className="mb-2 text-[9px] tracking-[0.15em] text-muted">HOST AUTHORITY · FLIGHT CONTINUES</p>
          <label className="mb-2 block text-[9px] tracking-[0.12em] text-muted">
            WINGMATE
            <select value={String(targetSlot)} onChange={event => setSelectedSlot(Number(event.target.value))}
              disabled={disabled || wingmates.length === 0}
              className="mt-1 min-h-9 w-full border border-bone/25 bg-void px-2 text-[10px] text-bone"
              data-testid="select-squad-target">
              {wingmates.length === 0 ? <option value="-1">NO CONNECTED WINGMATES</option> :
                wingmates.map(pilot => <option key={pilot.slot} value={pilot.slot}>{slotLabel(pilot.slot)}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" disabled={disabled} onClick={() => issue({ type: "sector_command", order: "attack" })}
              className="min-h-10 border border-[#ff7a5c]/60 bg-[#ff7a5c]/10 px-1 text-[9px] tracking-wider disabled:opacity-40"
              data-testid="button-order-attack">ATTACK DRONE</button>
            <button type="button" disabled={disabled || targetSlot < 0} onClick={() => issue({ type: "sector_command", order: "defend", targetSlot })}
              className="min-h-10 border border-bone/30 px-1 text-[9px] tracking-wider disabled:opacity-40"
              data-testid="button-order-defend">DEFEND PILOT</button>
            <button type="button" disabled={disabled || targetSlot < 0} onClick={() => issue({ type: "sector_command", order: "escort", targetSlot })}
              className="min-h-10 border border-bone/30 px-1 text-[9px] tracking-wider disabled:opacity-40"
              data-testid="button-order-escort">ESCORT PILOT</button>
            <button type="button" disabled={disabled} onClick={() => issue({ type: "sector_command", order: "regroup" })}
              className="min-h-10 border border-spectral/60 bg-spectral/10 px-1 text-[9px] tracking-wider disabled:opacity-40"
              data-testid="button-order-regroup">REGROUP</button>
          </div>
          {command ? <p className="mt-2 text-[9px] leading-snug text-solar" data-testid="text-current-order">{describeSectorCommand(command)}</p> : null}
          {sendError || notice ? <p role="status" className="mt-2 text-[9px] leading-snug text-[#ff7a5c]">{sendError || notice}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

const OP_PHASE_LABEL: Record<IronEclipseSnapshot["phase"], string> = {
  engage: "ENGAGE", capital: "CAPITAL ASSAULT", extract: "EXTRACTION",
  complete: "OPERATION COMPLETE", failed: "OPERATION FAILED",
};
const OP_ORDER_LABEL: Record<IronEclipseOrder, string> = {
  attack: "ATTACK", defend: "DEFEND", escort: "ESCORT", regroup: "REGROUP",
};
const OP_OBJECTIVES: [keyof IronEclipseSnapshot["objectives"], string][] = [
  ["primary", "PRIMARY · DISABLE THE CAPITAL"],
  ["shieldArray", "OPTIONAL · SHIELD ARRAY"],
  ["wingSurvival", "OPTIONAL · WING SURVIVAL"],
];

function IronEclipsePanel({ operation, notice, disabled, onCommand }: {
  operation: IronEclipseSnapshot; notice: string; disabled: boolean;
  onCommand: ExpeditionTransport["sendCommand"];
}) {
  const [open, setOpen] = useState(true);
  const [sendError, setSendError] = useState("");
  const pointDefenseDisabled = operation.subsystems.some(item => item.id === "point-defense" && item.disabled);
  const available = operation.subsystems.filter(item => !item.disabled && item.hull > 0 &&
    (item.id !== "reactor" || pointDefenseDisabled));
  const orderDisabled = disabled || operation.phase === "complete" || operation.phase === "failed";
  const targetDisabled = orderDisabled || operation.phase !== "capital" || available.length === 0;
  const target = operation.subsystems.find(item => item.id === operation.target);
  const issue = (packet: IronEclipseCommandRequest) => {
    if (disabled) return;
    setSendError("");
    if (!onCommand(packet)) setSendError("COMMAND NOT SENT · LINK UNAVAILABLE");
  };
  const setTarget = (id: IronEclipseSubsystemId) =>
    issue({ type: "iron_eclipse_target", target: id });
  const issueOrder = (order: IronEclipseOrder) =>
    issue({ type: "iron_eclipse_order", order });
  return (
    <aside className="pointer-events-auto absolute right-2 top-16 z-[8] w-[min(17rem,calc(100vw-1rem))] font-hud sm:right-4 sm:top-28" data-testid="panel-iron-eclipse">
      <button type="button" aria-expanded={open} aria-controls="iron-eclipse-controls" onClick={() => setOpen(value => !value)}
        className="min-h-11 w-full border border-solar/70 bg-[#11151a]/95 px-3 text-left text-[10px] tracking-[0.22em] text-solar"
        data-testid="button-operation-panel">
        <span className="flex items-center justify-between"><span>IRON ECLIPSE · {OP_PHASE_LABEL[operation.phase]}</span><span aria-hidden="true">{open ? "−" : "+"}</span></span>
      </button>
      {open ? (
        <section id="iron-eclipse-controls" aria-label="Operation Iron Eclipse status and tactical controls" className="mt-1 max-h-[48dvh] overflow-y-auto border border-bone/25 bg-[#11151a]/95 p-2.5 shadow-xl sm:max-h-[62dvh]">
          <p className="mb-1 text-[9px] tracking-[0.2em] text-muted">{disabled ? "VIEW ONLY · FLIGHT CONTINUES" : "HOST AUTHORITY · FLIGHT CONTINUES"}</p>
          <p className="mb-1 text-[8px] tracking-[0.1em] text-bone/55" data-testid="text-capital-position">
            CAPITAL POSITION · X {Math.round(operation.capitalPosition.x)} / Y {Math.round(operation.capitalPosition.y)} / Z {Math.round(operation.capitalPosition.z)}
          </p>
          <ul className="space-y-1 border-y border-bone/10 py-2" aria-label="Operation objective outcomes">
            {OP_OBJECTIVES.map(([key, label]) => {
              const status = operation.objectives[key];
              return <li key={key} className="flex items-center justify-between gap-2 text-[9px] tracking-[0.1em]" data-testid={`status-operation-objective-${key}`}>
                <span className="text-bone/75">{label}</span>
                <span className={status === "complete" ? "text-solar" : status === "missed" ? "text-[#ff9a7f]" : "text-muted"}>
                  {status === "complete" ? "COMPLETE" : status === "missed" ? "MISSED" : "PENDING"}
                </span>
              </li>;
            })}
          </ul>
          <ul className="mt-2 space-y-1" aria-label="Capital subsystem integrity">
            {operation.subsystems.map(system => {
              const pct = system.maxHull > 0 ? Math.max(0, Math.min(100, system.hull / system.maxHull * 100)) : 0;
              return <li key={system.id} aria-label={`${system.label}, ${system.disabled ? "disabled" : `${Math.round(system.hull)} of ${system.maxHull} hull`}, position X ${Math.round(system.position.x)}, Y ${Math.round(system.position.y)}, Z ${Math.round(system.position.z)}`} className="border-l-2 border-[#ff7a5c]/70 bg-bone/[0.035] px-2 py-1" data-testid={`status-subsystem-${system.id}`}>
                <div className="flex items-center justify-between gap-2 text-[9px] tracking-[0.12em]">
                  <span>{system.label}</span>
                  <span className={system.disabled ? "text-muted" : "text-[#ff9a7f]"}>{system.disabled ? "DISABLED" : `${Math.round(system.hull)} / ${system.maxHull}`}</span>
                </div>
                <div className="mt-1 h-1 bg-bone/15"><div className={`h-full ${system.disabled ? "bg-muted" : "bg-[#ff7a5c]"}`} style={{ width: `${pct}%` }} /></div>
                <p className="mt-1 text-[7px] leading-tight text-bone/40">X {Math.round(system.position.x)} · Y {Math.round(system.position.y)} · Z {Math.round(system.position.z)}</p>
              </li>;
            })}
          </ul>
          <div className="mt-2 grid grid-cols-3 gap-1" aria-label="AI wing status">
            {operation.wing.map(unit => {
              const ship = SHIPS[unit.shipId];
              const factionColor = FACTION_PALETTE[ship.faction].accent;
              const pct = unit.maxHull > 0 ? Math.max(0, Math.min(100, unit.hull / unit.maxHull * 100)) : 0;
              return <div key={unit.id} className="min-w-0 border border-bone/15 px-1.5 py-1" data-testid={`status-wing-${unit.id}`} aria-label={`${ship.name}, ${Math.round(unit.hull)} of ${unit.maxHull} hull, ${unit.connected ? "connected" : "disconnected"}, position X ${Math.round(unit.position.x)}, Y ${Math.round(unit.position.y)}, Z ${Math.round(unit.position.z)}`}>
                <p className="truncate text-[8px] tracking-[0.08em]" style={{ color: factionColor }}>{ship.name.toUpperCase()}</p>
                <p className="text-[8px] text-bone/65">{unit.connected ? "LINK" : "NO LINK"} · {Math.round(unit.hull)}/{unit.maxHull}</p>
                <p className="text-[7px] leading-tight text-bone/45">X {Math.round(unit.position.x)} · Y {Math.round(unit.position.y)} · Z {Math.round(unit.position.z)}</p>
                <div className="mt-1 h-1 bg-bone/15"><div className="h-full" style={{ width: `${pct}%`, background: factionColor }} /></div>
              </div>;
            })}
          </div>
          <div className="mt-2 border-t border-bone/10 pt-2">
            <div className="flex items-center justify-between gap-2 text-[9px] tracking-[0.12em]" data-testid="text-operation-command">
              <span className="text-muted">SERVER TARGET</span>
              <span className="text-solar">{target?.label ?? "NO TARGET"}</span>
            </div>
            <p className="mt-1 text-[9px] tracking-[0.12em] text-bone/75" data-testid="text-operation-order">WING ORDER · {OP_ORDER_LABEL[operation.order]}</p>
            <label className="mt-2 block text-[9px] tracking-[0.12em] text-muted" htmlFor="operation-target">CAPITAL SUBSYSTEM</label>
            <select id="operation-target" value={operation.target ?? ""} disabled={targetDisabled}
              onChange={event => setTarget(event.target.value as IronEclipseSubsystemId)}
              className="mt-1 min-h-10 w-full border border-bone/25 bg-[#0b0e12] px-2 text-[10px] text-bone disabled:opacity-45"
              data-testid="select-operation-target">
              {!operation.target && available.length > 0 ? <option value="" disabled>SELECT A SUBSYSTEM</option> : null}
              {target && !available.some(item => item.id === target.id)
                ? <option value={target.id} disabled>{target.label} · INACTIVE</option> : null}
              {available.length ? available.map(system => <option key={system.id} value={system.id}>{system.label}</option>)
                : <option value="">NO ACTIVE SUBSYSTEMS</option>}
            </select>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {(["attack", "defend", "escort", "regroup"] as const).map(order => (
                <button key={order} type="button" disabled={orderDisabled} onClick={() => issueOrder(order)}
                  className={`min-h-10 border px-1 text-[9px] tracking-[0.15em] disabled:opacity-40 ${order === "attack" ? "border-[#ff7a5c]/60 bg-[#ff7a5c]/10 text-[#ff9a7f]" : order === "regroup" ? "border-spectral/60 bg-spectral/10 text-spectral" : "border-bone/25 text-bone"}`}
                  data-testid={`button-operation-order-${order}`}>{OP_ORDER_LABEL[order]}</button>
              ))}
            </div>
            {sendError || notice ? <p role="status" className="mt-2 text-[9px] leading-snug text-[#ff9a7f]">{sendError || notice}</p> : null}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function ObjectiveMarker({ label, distance }: { label: string; distance: number }) {
  return (
    <div className="absolute left-0 top-0 flex -translate-x-1/2 -translate-y-2.5 flex-col items-center">
      <div className="h-5 w-5 rotate-45 border-2 border-solar" />
      <span className="mt-1 whitespace-nowrap font-hud text-[10px] tracking-[0.2em] text-solar">{label ? `${Math.round(distance)}M` : ""}</span>
    </div>
  );
}

function EvidenceMarker({ title, distance, state }: {
  title: string; distance: number; state: SectorEvidencePickup["state"];
}) {
  return (
    <div className="absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
      <div className={`h-5 w-5 rotate-45 border-2 ${state === "recovering" ? "border-solar" : "border-[#b9a4ff]"}`} />
      <span className="mt-1 whitespace-nowrap border border-[#b9a4ff]/50 bg-[#080b12]/85 px-1.5 py-0.5 font-hud text-[8px] tracking-[0.14em] text-[#d4c8ff]">
        {title} · {Math.round(distance)}M
      </span>
    </div>
  );
}

function EvidenceRecoveryControl({ evidence, disabled, onRecover }: {
  evidence: Array<SectorEvidencePickup & { distanceMeters: number }>;
  disabled: boolean;
  onRecover: () => boolean;
}) {
  const next = [...evidence]
    .filter((site) => site.state !== "recovered")
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  return (
    <section className="pointer-events-auto absolute bottom-[calc(env(safe-area-inset-bottom)+7.4rem)] left-1/2 z-10 w-[min(21rem,calc(100vw-7rem))] -translate-x-1/2 border border-[#b9a4ff]/45 bg-[#080b12]/90 p-2 shadow-lg"
      data-testid="panel-evidence-recovery" aria-live="polite">
      <p className="font-hud text-[9px] tracking-[0.2em] text-[#d4c8ff]">IN-FLIGHT EVIDENCE</p>
      {!next ? (
        <p className="mt-1 text-xs text-solar">ALL SIGNAL RECORDS SECURED</p>
      ) : (
        <>
          <p className="mt-1 truncate text-[10px] tracking-wider text-bone">{next.title}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-hud text-[9px] tracking-widest text-muted">
              {next.state === "recovering" ? "ARCHIVING…" :
                next.state === "unavailable" ? (next.distanceMeters <= 55 ? "ARCHIVE LINK · RETRY AVAILABLE" : `${Math.round(next.distanceMeters)}M · CLOSE IN`) :
                  next.distanceMeters <= 55 ? "RECOVERY RANGE" : `${Math.round(next.distanceMeters)}M · CLOSE IN`}
            </span>
            <button type="button" disabled={disabled ||
              (next.state !== "available" && next.state !== "unavailable") || next.distanceMeters > 55}
              onClick={onRecover} data-testid="button-recover-evidence"
              className="min-h-9 border border-[#b9a4ff]/70 bg-[#b9a4ff]/15 px-3 font-hud text-[9px] tracking-[0.16em] text-[#eeeaff] disabled:cursor-not-allowed disabled:opacity-40">
              {next.state === "unavailable" ? "RETRY" : "RECOVER"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Touch controls ----------
function TouchControls({ inputRef, pulseRef, disabled, missileReady, missiles, incoming, onPause, onCamera, onMap, throttle, vectorDriftAvailable }: {
  inputRef: MutableRefObject<FlightControlFrame>; pulseRef: MutableRefObject<{ missile: boolean; countermeasure: boolean }>;
  disabled: boolean; missileReady: boolean; missiles: number; incoming: number; onPause: () => void; onCamera: () => void; onMap: () => void; throttle: number; vectorDriftAvailable: boolean;
}) {
  const flightAxes = useRef({ x: 0, y: 0 });
  const aimAxes = useRef({ x: 0, y: 0 });
  const pulseTimers = useRef<{ vertical: ReturnType<typeof setTimeout> | null; strafe: ReturnType<typeof setTimeout> | null }>({ vertical: null, strafe: null });
  const [maneuversOpen, setManeuversOpen] = useState(false);
  const applyOrientation = () => {
    const flight = mapFlightStickAxes(flightAxes.current.x, flightAxes.current.y);
    const aim = mapFlightStickAxes(aimAxes.current.x, aimAxes.current.y);
    inputRef.current.yaw = Math.max(-1, Math.min(1, flight.yaw + aim.yaw));
    inputRef.current.pitch = Math.max(-1, Math.min(1, flight.pitch + aim.pitch));
    inputRef.current.roll = flight.roll;
  };
  const pulseManeuver = (pulse: ManeuverPulse) => {
    if (disabled) return;
    const prior = pulseTimers.current[pulse.axis];
    if (prior) clearTimeout(prior);
    inputRef.current[pulse.axis] = pulse.direction;
    unlockAudio();
    sfxDive();
    pulseTimers.current[pulse.axis] = setTimeout(() => {
      if (inputRef.current[pulse.axis] === pulse.direction) inputRef.current[pulse.axis] = 0;
      pulseTimers.current[pulse.axis] = null;
    }, MANEUVER_PULSE_DURATION_MS);
  };
  useEffect(() => {
    const reset = () => {
      flightAxes.current = { x: 0, y: 0 }; aimAxes.current = { x: 0, y: 0 };
      for (const axis of ["vertical", "strafe"] as const) {
        const timer = pulseTimers.current[axis];
        if (timer) clearTimeout(timer);
        pulseTimers.current[axis] = null;
      }
      inputRef.current.strafe = 0; inputRef.current.vertical = 0;
      inputRef.current.yaw = 0; inputRef.current.pitch = 0; inputRef.current.roll = 0;
      inputRef.current.fire = false; inputRef.current.lock = false;
      inputRef.current.boost = false; inputRef.current.brake = false; inputRef.current.drift = false;
    };
    window.addEventListener("wfm-flight-reset", reset);
    return () => {
      window.removeEventListener("wfm-flight-reset", reset);
      for (const timer of Object.values(pulseTimers.current)) if (timer) clearTimeout(timer);
    };
  }, [inputRef]);
  useEffect(() => {
    if (disabled) setManeuversOpen(false);
  }, [disabled]);

  const hold = (key: "fire" | "boost" | "brake" | "lock" | "drift", icon: "fire" | "boost" | "brake" | "aim" | "drift", label: string, testId: string, accent = false) => (
    <PilotActionButton icon={icon} label={label} testId={testId} disabled={disabled} accent={accent}
      onPress={() => { inputRef.current[key] = true; }}
      onRelease={() => { inputRef.current[key] = false; }}
      onActivate={() => {
        inputRef.current[key] = true;
        requestAnimationFrame(() => { inputRef.current[key] = false; });
      }} />
  );
  const thrust = () => {
    inputRef.current.throttle = 1;
    requestAnimationFrame(() => { inputRef.current.throttle = throttle; });
  };

  return (
    <div className="pointer-events-none absolute inset-0 font-hud">
      <div className="pointer-events-auto absolute right-3 top-2 flex gap-1.5">
        <PilotActionButton icon="camera" label="Toggle chase or cockpit camera" testId="button-camera-toggle" disabled={disabled} onActivate={onCamera} />
        <PilotActionButton icon="map" label="Open sector map" testId="button-tactical-map" disabled={disabled} onActivate={onMap} />
        <PilotActionButton icon="pause" label="Pause flight controls" testId="button-pause" onActivate={onPause} />
      </div>
      <div className="pointer-events-auto absolute bottom-4 left-3 flex items-end gap-2 sm:gap-3" data-testid="flight-controls-left">
        <div className="relative">
          <PilotFlightStick label="Left thumb flight" testId="stick-flight" size="rust-disc" disabled={disabled}
            onAxis={(x, y) => { flightAxes.current = { x, y }; applyOrientation(); }}
            onPulse={pulseManeuver} />
          <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] tracking-[0.16em] text-bone/65">FLIGHT · DOUBLE-TAP EDGE</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <PilotActionButton icon="thrust" label={`Hold thrust; current setting ${Math.round(throttle * 100)} percent`} testId="button-thrust"
            disabled={disabled} accent badge={`${Math.round(throttle * 100)}%`}
            onPress={() => { inputRef.current.throttle = 1; }}
            onRelease={() => { inputRef.current.throttle = throttle; }}
            onActivate={thrust} />
          <PilotActionButton icon="maneuver" label={maneuversOpen ? "Hide maneuver controls" : "Open maneuver controls"} testId="button-maneuvers"
            active={maneuversOpen} disabled={disabled} onActivate={() => setManeuversOpen(value => !value)} />
        </div>
      </div>
      <div className="pointer-events-auto absolute bottom-4 right-3 flex items-end gap-2 sm:gap-3" data-testid="flight-controls-right">
        <div className="flex flex-col items-center gap-2">
          {maneuversOpen ? (
            <div className="pilot-rust-maneuvers flex max-w-[48vw] flex-wrap justify-end gap-1.5" data-testid="pilot-maneuver-actions">
              {hold("brake", "brake", "Hold brake", "button-brake")}
              {hold("boost", "boost", "Hold boost", "button-boost")}
              {vectorDriftAvailable ? hold("drift", "drift", "Hold vector drift", "button-drift") : null}
              {incoming > 0 ? <PilotActionButton icon="flare" label="Launch countermeasure flare" testId="button-countermeasure" disabled={disabled}
                onActivate={() => { pulseRef.current.countermeasure = true; }} /> : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            {hold("lock", "aim", "Hold target lock", "button-lock")}
            <PilotActionButton icon="missile" label={missileReady ? `Launch missile, ${missiles} remaining` : "Missile requires a valid target lock"}
              testId="button-missile" disabled={disabled || !missileReady} accent badge={missiles}
              onActivate={() => { pulseRef.current.missile = true; }} />
            {hold("fire", "fire", "Hold primary guns", "button-fire", true)}
          </div>
        </div>
        <div className="relative">
          <PilotFlightStick label="Right thumb aim" testId="stick-aim" size="rust-disc" disabled={disabled}
            onAxis={(x, y) => { aimAxes.current = { x, y }; applyOrientation(); }} />
          <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] tracking-[0.2em] text-bone/65">AIM</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Overlays ----------
function Overlay({ title, sub, children, translucent }: { title: string; sub: string; children: ReactNode; translucent?: boolean }) {
  return (
    <div className={`absolute inset-0 z-10 flex items-center justify-center overflow-y-auto p-4 ${translucent ? "bg-[#0a0710]/45" : "bg-[#0a0710]/80 backdrop-blur-sm"}`}>
      <div className="w-full max-w-md border-l-2 border-solar bg-[#140d12]/90 p-5">
        <p className="font-hud text-2xl tracking-[0.12em]">{title}</p>
        <p className="mt-1 text-sm text-muted">{sub}</p>
        <div className="mt-4 flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

function OverlayButton({ children, onClick, primary, testId }: { children: ReactNode; onClick: () => void; primary?: boolean; testId: string }) {
  return (
    <button onClick={onClick} data-testid={testId}
      className={`min-h-12 px-4 text-left font-hud text-sm tracking-[0.2em] ${primary ? "bg-solar text-void" : "border border-bone/25"}`}>{children}</button>
  );
}

function Summary({ s, onRestart, onBriefing, onExit }: { s: FlightState; onRestart: () => void; onBriefing: () => void; onExit: () => void }) {
  const won = s.stage === "complete";
  const t = Math.floor(s.elapsed);
  const rows: [string, string][] = [
    ["PRIMARY OBJECTIVE", won ? "EXTRACTION COMPLETE" : "INCOMPLETE"],
    ["HULL", SHIPS[s.shipId].name.toUpperCase()],
    ["TIME", `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`],
    ["HULL REMAINING", `${Math.round(s.hull)}%`],
    ["RELAY LOGS", String(s.discoveries)],
    ["DRONE HITS", String(s.hits)],
    ["ROCK STRIKES", String(s.collisions)],
    ["MISSILES LEFT", String(s.missiles)],
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4" style={{ background: "radial-gradient(100% 80% at 50% 120%, #5a2a1c, #0a0710 70%)" }} data-testid="screen-flight-summary">
      <div className="w-full max-w-lg">
        <p className="font-hud text-xs tracking-[0.3em] text-muted">RUST DISC · LOCAL DEBRIEF</p>
        <h2 className={`font-hud text-5xl leading-none ${won ? "text-solar" : "text-[#ff7a5c]"}`} data-testid="text-flight-result">{won ? "EXTRACTED" : "HULL LOST"}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-y border-bone/20 py-3 font-hud text-sm">
          {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="tracking-[0.2em] text-muted">{k}</dt><dd className="text-right">{v}</dd></div>))}
        </dl>
        <p className="mt-3 text-xs text-muted" data-testid="text-no-rewards">Local practice only. No credits, rank, rewards or progress were recorded, and nothing was sent anywhere.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <OverlayButton primary onClick={onRestart} testId="button-summary-restart">FLY AGAIN</OverlayButton>
          <OverlayButton onClick={onBriefing} testId="button-summary-briefing">BRIEFING</OverlayButton>
          <OverlayButton onClick={onExit} testId="button-summary-exit">RETURN TO WFM</OverlayButton>
        </div>
      </div>
    </div>
  );
}
