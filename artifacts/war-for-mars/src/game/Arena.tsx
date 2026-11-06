import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { engineGain, isMuted, setMuted, sfxBoom, sfxCloak, sfxDive, sfxEmp, sfxFlare, sfxGuard, sfxHit, sfxJam, sfxMark, sfxPaint, sfxRam, sfxShot, unlockAudio } from "./audio";
import "./controls-probe";
import { clearInput, createBus, pulseVectorManeuver, readInput, readThrottle, setCircularRollControl, type Bus } from "./input";
import { gyroAim } from "./gyro";
import { acknowledgeInterruptedNotice } from "./interrupted-ack";
import { currentWingSocketUrl } from "./socket-endpoint";
import {
  CLIENT_RECONNECT_WINDOW_MS,
  SOCKET_HANDSHAKE_TIMEOUT_MS,
  nextReconnectDelayMs,
} from "./reconnect-policy";
import { addTrauma, decayTrauma, emitSparks, freshSpark, shakeMag, shakeNoise, tickSparks } from "./juice";
import type { LocalPerformanceFrame, LocalPerformanceVisibilityChange } from "./local-performance";
import { PRESET_NAME, SHIPS, type Faction, type Scheme, type ShipId } from "./ships";
import { matchChecksum } from "./sim-trace";
import { ARENA_R, aimYaw, createMatch, outcomeForTeam, outcomeReason, relayCallout, relaysHeld, step, wrap, type Craft, type Disc, type Goal, type Match, type Pace, type StepInput } from "./sim";
import type { TechId } from "./campaign";
import { battlefieldProfile } from "./battlefield";
import { createMarsLimb, createTheaterTextures } from "./theater-surfaces";
import { prepareOrbital } from "./orbital-sim";
import { orbitalAbilityAvailability } from "./orbital-abilities";
import { orbitalCameraPose } from "./orbital-camera";
import { targetSolution } from "./orbital-weapons";
import { addOrbitalEnvironment, buildOrbitalShip, createOrbitalDamageController, orbitalRock } from "./orbital-visuals";
import { countermeasureFeedbackLabel } from "./countermeasure-feedback";
import { PilotActionButton } from "./PilotActionButton";
import { PilotFlightStick } from "./PilotFlightStick";
import { isTargetHullCritical, targetFactionAccent, targetHullColor } from "./pilot-hud";
import {
  createOrbitalRuntime,
  getGameModeDefinition,
  isOrbitalRuntimeId,
  ORBITAL_RUNTIME_ID,
  type CombatRuntimeId,
  type GameModeId,
} from "@workspace/orbital-sim";
import {
  UNIVERSE_MODE_ID,
  cinderStationTransform,
  createUniverseSession,
  evaluateCinderDock,
  placeAtSpawn,
  universeFrozen,
  type DockEvaluation,
  type UniverseSession,
} from "./orbital-universe-session";
import { advanceLocalUniverseFlight, transitionLocalUniverse, type LocalUniverseCommand } from "./orbital-universe-runtime";
import { UniverseStationOverlay } from "./UniverseStationOverlay";

const WEAPON_EFFECT_COLORS: Record<"beam" | "pulse" | "heavy" | "precision" | "ion" | "swarm", { accord: number; ussf: number }> = {
  beam: { accord: 0xffb461, ussf: 0x7de6ff },
  pulse: { accord: 0xffd7a1, ussf: 0xbcecff },
  heavy: { accord: 0xff8b4f, ussf: 0x69cfff },
  precision: { accord: 0xffe2b2, ussf: 0xe0f7ff },
  ion: { accord: 0xffa86c, ussf: 0xa6aaff },
  swarm: { accord: 0xffc35e, ussf: 0x79f0e0 },
};

export type StrikeResult = {
  outcome: "win" | "loss" | "draw";
  kills: number;
  deaths: number;
  relays: number;
  reason: string;
};

export type WingRewardNotice = {
  status:
    | "awarded"
    | "not_eligible"
    | "daily_limit"
    | "disabled"
    | "unavailable";
  outcome: "win" | "loss" | "draw";
  gain: number;
  balanceAfter: number | null;
  revision: number | null;
  reason?: string;
};

export type OnlineSnapshot = {
  tick: number;
  time: number;
  players: Array<{ slotId: number; lastSeq: number; connected?: boolean; [key: string]: unknown }>;
  match: Match;
};

type RemotePose = { x: number; z: number; yaw: number; pitch: number; steer: number };
type RemoteFrame = { receivedAt: number; poses: Record<number, RemotePose> };

export type OnlineRoom = {
  socket: WebSocket;
  snapshot: OnlineSnapshot;
  roomId: string;
  slotId: number;
  team: 0 | 1;
  reconnectToken: string;
  name: string;
  getSessionToken: () => Promise<string | null>;
  sessionKey?: string;
};

type ArenaProps = {
  shipId: ShipId;
  faction: Faction;
  scheme: Scheme;
  refit: number;
  shieldMk2?: boolean;
  pace: Pace;
  goal: Goal;
  disc: Disc;
  allyCount: number;
  foeCount: number;
  objective: string;
  tech: TechId | null;
  serverSeed?: number;
  gyro: boolean;
  drilled: boolean;
  onDrill: () => void;
  onDone: (
    result: StrikeResult,
    replay: { seed: number; inputs: StepInput[]; checksums?: number[] },
    wingReward?: WingRewardNotice,
  ) => void;
  onNetworkExit: (reason: "server_restart" | "session_lost" | "authentication_failed" | "protocol_mismatch") => void;
  onGraphicsError?: (message: string) => void;
  onPerformanceFrame?: (frame: LocalPerformanceFrame) => void;
  onPerformanceVisibilityChange?: (change: LocalPerformanceVisibilityChange) => void;
  localEndurance?: boolean;
  online?: OnlineRoom;
  /** Required so every Arena caller states its runtime instead of silently falling back. */
  runtime: CombatRuntimeId;
  /** The operation contract is checked against the selected simulation at launch. */
  modeId: GameModeId;
  orbitalCampaign?: boolean;
  /**
   * Opt-in local Orbital universe profile: bounded offline exploration with a
   * physical Cinder Ring dock and a subordinate training activity. No rewards.
   */
  localUniverse?: { onExit: () => void; servicesHref: string };
};

const stagingTraceEnabled = import.meta.env.VITE_WFM_STAGING_DIAGNOSTICS === "true";

const IDLE: StepInput = {
  throttle: 0, yaw: 0, strafe: 0, pitch: 0, fire: false, ult: false,
  lock: false, evade: 0, preset: null,
};

function pilotCraft(match: Match, slotId: number): Craft {
  if (slotId === 0) return match.player;
  if (slotId < 5) return match.allies[slotId - 1] ?? match.player;
  return match.enemies[slotId - 5] ?? match.player;
}

function copyMatch(source: Match): Match {
  return JSON.parse(JSON.stringify(source)) as Match;
}

function captureRemoteFrame(snapshot: OnlineSnapshot): RemoteFrame {
  const poses: Record<number, RemotePose> = {};
  for (const player of snapshot.players) {
    if (!player.connected || player.slotId < 0 || player.slotId >= 10) continue;
    const craft = pilotCraft(snapshot.match, player.slotId);
    poses[player.slotId] = {
      x: craft.x,
      z: craft.z,
      yaw: craft.yaw,
      pitch: craft.pitch,
      steer: craft.steer,
    };
  }
  return { receivedAt: performance.now(), poses };
}

function interpolateRemotePose(frames: RemoteFrame[], slotId: number, now: number): RemotePose | null {
  if (!frames.length) return null;
  const renderAt = now - 66;
  let before = frames[0];
  let after = frames[frames.length - 1];
  for (let index = 0; index < frames.length - 1; index += 1) {
    if (renderAt <= frames[index + 1].receivedAt) {
      before = frames[index];
      after = frames[index + 1];
      break;
    }
  }
  const a = before.poses[slotId];
  const b = after.poses[slotId];
  if (!a) return b ?? null;
  if (!b) return a;
  const span = after.receivedAt - before.receivedAt;
  const t = span > 0 ? Math.max(0, Math.min(1, (renderAt - before.receivedAt) / span)) : 1;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: a.yaw + wrap(b.yaw - a.yaw) * t,
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    steer: a.steer + (b.steer - a.steer) * t,
  };
}

const DRILL = [
  "Burn forward. W, or the left stick.",
  "Nose left is A. Right is D.",
  "Fire. Space, or the gold button.",
  "Tap ENG, WEP, or DEF.",
];

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _x2 = new THREE.Vector3();
const _y2 = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _cameraUp = new THREE.Vector3();

function orient(obj: THREE.Object3D, yaw: number, pitch: number, steer: number) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  _fwd.set(-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp);
  if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _x.crossVectors(_up, _fwd);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_fwd, _x).normalize();
  const bank = -steer * 0.55;
  const cos = Math.cos(bank);
  const sin = Math.sin(bank);
  _tmp.crossVectors(_fwd, _x);
  _x2.copy(_x).multiplyScalar(cos).addScaledVector(_tmp, sin);
  _tmp.crossVectors(_fwd, _y);
  _y2.copy(_y).multiplyScalar(cos).addScaledVector(_tmp, sin);
  _basis.makeBasis(_x2, _y2, _fwd);
  obj.quaternion.setFromRotationMatrix(_basis);
}

function metal(color: number, emissive: number, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    metalness: 0.68,
    roughness: 0.36,
  });
}

function tag(mesh: THREE.Mesh, intensity: number, group: THREE.Group) {
  mesh.userData.baseE = intensity;
  group.add(mesh);
}

function buildShip(id: ShipId): THREE.Group {
  const g = new THREE.Group();
  const accord = SHIPS[id].faction === "accord";
  const hull = metal(accord ? 0x625044 : 0x71869c, accord ? 0x30261a : 0x14202c, 0.25);
  hull.metalness = accord ? 0.18 : 0.62;
  hull.roughness = accord ? 0.78 : 0.48;
  const hot = metal(accord ? 0xe0a15a : 0x78bfff, accord ? 0xe0a15a : 0x78bfff, 0.85);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 8), hot);
  nose.geometry.rotateX(Math.PI / 2);
  nose.position.z = 1.45;
  tag(nose, 0.85, g);

  if (id === "mandjet") {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.86, 28), hot);
    disc.position.z = -0.2;
    disc.rotation.y = Math.PI;
    tag(disc, 0.85, g);
    const wing = new THREE.BoxGeometry(1.4, 0.05, 0.48);
    const left = new THREE.Mesh(wing, hull);
    left.position.set(-1.2, 0.02, -0.05);
    left.rotation.y = -0.4;
    tag(left, 0.42, g);
    const right = new THREE.Mesh(wing.clone(), hull);
    right.position.set(1.2, 0.02, -0.05);
    right.rotation.y = 0.4;
    tag(right, 0.42, g);
  } else if (id === "shakuna") {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.7, 7), hull);
    body.geometry.rotateX(Math.PI / 2);
    tag(body, 0.42, g);
    const wing = new THREE.BoxGeometry(1.15, 0.04, 0.42);
    const left = new THREE.Mesh(wing, hot);
    left.position.set(-0.85, 0.12, -0.1);
    left.rotation.z = 0.35;
    left.rotation.y = -0.5;
    tag(left, 0.85, g);
    const right = new THREE.Mesh(wing.clone(), hot);
    right.position.set(0.85, 0.12, -0.1);
    right.rotation.z = -0.35;
    right.rotation.y = 0.5;
    tag(right, 0.85, g);
  } else if (id === "sundara") {
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 2.5, 10), hull);
    needle.geometry.rotateX(Math.PI / 2);
    tag(needle, 0.25, g);
    const fin = new THREE.BoxGeometry(0.7, 0.04, 0.28);
    const left = new THREE.Mesh(fin, hot);
    left.position.set(-0.28, 0, -0.7);
    tag(left, 0.85, g);
    const right = new THREE.Mesh(fin.clone(), hot);
    right.position.set(0.28, 0, -0.7);
    tag(right, 0.85, g);
  } else if (id === "tripura") {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38), hot);
    tag(core, 0.85, g);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72 + i * 0.18, 0.045, 8, 24), hull);
      ring.rotation.x = 0.4 + i * 0.5;
      ring.rotation.y = i * 0.7;
      tag(ring, 0.42, g);
    }
  } else if (id === "duskbreaker") {
    const fuse = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 1.7), hull);
    tag(fuse, 0.25, g);
    const wing = new THREE.BoxGeometry(1.5, 0.04, 0.55);
    const delta = new THREE.Mesh(wing, hot);
    delta.position.z = -0.1;
    tag(delta, 0.5, g);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.28), hull);
    tail.position.set(0, 0.2, -0.7);
    tag(tail, 0.25, g);
  } else if (id === "sentinel") {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.7), hull);
    tag(bus, 0.25, g);
    const panel = new THREE.BoxGeometry(1.3, 0.03, 0.45);
    const left = new THREE.Mesh(panel, hot);
    left.position.set(-0.95, 0, 0);
    tag(left, 0.7, g);
    const right = new THREE.Mesh(panel.clone(), hot);
    right.position.set(0.95, 0, 0);
    tag(right, 0.7, g);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), hot);
    dish.rotation.x = Math.PI / 2;
    dish.position.z = 0.55;
    tag(dish, 0.85, g);
  } else if (id === "splitter") {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), hot);
    tag(core, 0.85, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 28), hull);
    tag(ring, 0.25, g);
    const drone = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const a = new THREE.Mesh(drone, hot);
    a.position.set(0.95, 0.2, 0.2);
    tag(a, 0.85, g);
    const b = new THREE.Mesh(drone.clone(), hot);
    b.position.set(-0.7, -0.15, -0.3);
    tag(b, 0.85, g);
  } else {
    const dart = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.15, 6), hull);
    dart.geometry.rotateX(Math.PI / 2);
    tag(dart, 0.25, g);
    const stub = new THREE.BoxGeometry(0.7, 0.03, 0.22);
    const fins = new THREE.Mesh(stub, hot);
    fins.position.z = -0.55;
    tag(fins, 0.7, g);
  }

  const exhaust = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), hot);
  exhaust.position.z = -1.2;
  exhaust.name = "exhaust";
  tag(exhaust, 0.85, g);
  return g;
}

function paint(group: THREE.Group, craft: Craft) {
  group.visible = craft.alive;
  const flash = craft.hurtT > 1.55;
  const cloak = craft.cloak > 0;
  const blink = craft.guard > 0 && Math.sin(performance.now() * 0.02) > 0;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat || !("emissiveIntensity" in mat)) return;
    const base = (mesh.userData.baseE as number) ?? 0.4;
    mat.emissiveIntensity = flash ? 2.2 : base;
    const ghost = cloak || blink;
    mat.transparent = ghost;
    mat.opacity = cloak ? 0.16 : blink ? 0.4 : 1;
  });
  const exhaust = group.getObjectByName("exhaust");
  if (exhaust && craft.alive) {
    const s = 0.5 + Math.min(1.6, Math.abs(craft.speed) / 16);
    exhaust.scale.setScalar(s);
  }
}

function drawRadar(canvas: HTMLCanvasElement, match: Match, local: Craft = match.player, slotId = 0) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);
  ctx.strokeStyle = "rgba(224,161,90,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2);
  ctx.stroke();
  const scale = (w / 2 - 8) / ARENA_R;
  const pt = (x: number, z: number) => [w / 2 + x * scale, w / 2 + z * scale] as const;
  ctx.fillStyle = "rgba(141,135,124,0.75)";
  for (const rock of match.rocks) {
    const [x, y] = pt(rock.x, rock.z);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, rock.r * scale), 0, Math.PI * 2);
    ctx.fill();
  }
  const inverted = slotId >= 5;
  for (const relay of match.relays) {
    const [x, y] = pt(relay.x, relay.z);
    const own = inverted ? -relay.own : relay.own;
    ctx.fillStyle = own === 1 ? "#e0a15a" : own === -1 ? "#c45c48" : "#8d877c";
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  const friendlies = inverted ? match.enemies : match.allies;
  const hostiles = inverted ? [match.player, ...match.allies] : match.enemies;
  for (const ally of friendlies) {
    if (!ally.alive || ally.id === local.id) continue;
    const [x, y] = pt(ally.x, ally.z);
    ctx.fillStyle = "#e0a15a";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  for (const enemy of hostiles) {
    if (!enemy.alive || enemy.id === local.id) continue;
    const [x, y] = pt(enemy.x, enemy.z);
    ctx.fillStyle = "#c45c48";
    const s = enemy.ace ? 6 : 4;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (enemy.ace) {
      ctx.strokeStyle = "#e6e1d6";
      ctx.strokeRect(x - 5, y - 5, 10, 10);
    }
  }
  if (match.runner?.alive) {
    const [x, y] = pt(match.runner.x, match.runner.z);
    ctx.fillStyle = (match.runner.team === "you") !== inverted ? "#e0a15a" : "#c45c48";
    ctx.fillRect(x - 4, y - 5, 8, 10);
  }
  if (local.alive) {
    const [x, y] = pt(local.x, local.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-local.yaw);
    ctx.fillStyle = "#e6e1d6";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawContacts(canvas: HTMLCanvasElement, match: Match, local: Craft = match.player, slotId = 0) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (w < 2 || h < 2) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const player = local;
  if (!player.alive) return;
  const cx = w / 2;
  const cy = h / 2;
  const ring = Math.min(w, h) * 0.33;
  const hostiles = slotId >= 5 ? [match.player, ...match.allies] : match.enemies;
  for (const enemy of hostiles) {
    if (!enemy.alive) continue;
    const bearing = wrap(aimYaw(player.x, player.z, enemy.x, enemy.z) - player.yaw);
    const sx = cx - Math.sin(bearing) * ring;
    const sy = cy - Math.cos(bearing) * ring;
    const hot = match.painted.includes(enemy.id);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-bearing);
    ctx.strokeStyle = hot ? "#c45c48" : "rgba(15,229,212,0.9)";
    ctx.lineWidth = hot ? 2 : 1.25;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

export function Arena({
  shipId,
  faction,
  scheme,
  refit,
  shieldMk2 = false,
  pace,
  goal,
  disc,
  allyCount,
  foeCount,
  objective,
  tech,
  serverSeed,
  gyro,
  drilled,
  onDrill,
  onDone,
  onNetworkExit,
  onGraphicsError,
  onPerformanceFrame,
  onPerformanceVisibilityChange,
  localEndurance = false,
  online,
  runtime,
  modeId,
  orbitalCampaign = false,
  localUniverse,
}: ArenaProps) {
  const modeDefinition = getGameModeDefinition(modeId);
  const orbitalRuntime = isOrbitalRuntimeId(runtime)
    ? createOrbitalRuntime(modeDefinition, runtime)
    : null;
  if (modeDefinition.simulation.runtimeId !== runtime &&
      !(orbitalRuntime && modeDefinition.simulation.runtimeId === ORBITAL_RUNTIME_ID)) {
    throw new Error(`Mode ${modeId} is configured for ${modeDefinition.simulation.runtimeId}, not ${runtime}.`);
  }
  const orbital = orbitalRuntime !== null;
  if (isOrbitalRuntimeId(runtime) && !orbital) {
    throw new Error("Orbital runtime initialization failed.");
  }
  if (orbital && online) throw new Error("The canonical orbital runtime is not yet negotiated for this live room.");
  if (orbitalCampaign && !orbital) throw new Error("Campaign orbital rules require spatial flight.");
  if (localUniverse && (online || !orbital || orbitalCampaign || localEndurance || modeId !== UNIVERSE_MODE_ID)) {
    throw new Error("The local Orbital universe requires the offline orbital-universe-local profile.");
  }
  if (!localUniverse && modeId === UNIVERSE_MODE_ID) throw new Error("orbital-universe-local requires the localUniverse profile.");
  const universeTemplateRef = useRef<Match | null>(null);
  const universeRef = useRef<UniverseSession | null>(null);
  const [universe, setUniverse] = useState<UniverseSession | null>(() => {
    if (!localUniverse) return null;
    universeRef.current = universeRef.current ?? createUniverseSession();
    return universeRef.current;
  });
  const [dockState, setDockState] = useState<DockEvaluation | null>(null);
  const [glReady, setGlReady] = useState(false);
  const glReadyRef = useRef(false);
  const universeExitRef = useRef(localUniverse?.onExit);
  universeExitRef.current = localUniverse?.onExit;
  const telemetryRef = useRef<HTMLParagraphElement>(null);
  const missileRef = useRef<HTMLButtonElement>(null);
  const countermeasureRef = useRef<HTMLButtonElement>(null);
  const countermeasureFeedbackRef = useRef<HTMLParagraphElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);
  const hullRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const foeRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const pipRef = useRef<HTMLParagraphElement>(null);
  const wingRef = useRef<HTMLSpanElement>(null);
  const cageRef = useRef<HTMLParagraphElement>(null);
  const ultRef = useRef<HTMLButtonElement>(null);
  const lockRef = useRef<HTMLButtonElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const throttleMeterRef = useRef<HTMLDivElement>(null);
  const throttleFillRef = useRef<HTMLDivElement>(null);
  const throttleValueRef = useRef<HTMLSpanElement>(null);
  const boostRef = useRef<HTMLButtonElement>(null);
  const lockNameRef = useRef<HTMLParagraphElement>(null);
  const lockHpRef = useRef<HTMLDivElement>(null);
  const targetStatusRef = useRef<HTMLDivElement>(null);
  const targetFactionRef = useRef<HTMLSpanElement>(null);
  const targetNameRef = useRef<HTMLSpanElement>(null);
  const targetDistanceRef = useRef<HTMLSpanElement>(null);
  const targetShieldRef = useRef<HTMLDivElement>(null);
  const targetShieldValueRef = useRef<HTMLSpanElement>(null);
  const targetHullRef = useRef<HTMLDivElement>(null);
  const targetHullValueRef = useRef<HTMLSpanElement>(null);
  const targetLockRef = useRef<HTMLDivElement>(null);
  const targetLockValueRef = useRef<HTMLSpanElement>(null);
  const callRef = useRef<HTMLParagraphElement>(null);
  const relayRef = useRef<HTMLParagraphElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const hurtRef = useRef<HTMLDivElement>(null);
  const aheadRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const behindRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<HTMLParagraphElement>(null);
  const contactRef = useRef<HTMLCanvasElement>(null);
  const presetRefs = useRef<Array<HTMLButtonElement | null>>([null, null, null, null]);
  const busRef = useRef<Bus | null>(null);
  const matchRef = useRef<Match | null>(null);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const performanceFrameRef = useRef(onPerformanceFrame);
  performanceFrameRef.current = onPerformanceFrame;
  const performanceVisibilityRef = useRef(onPerformanceVisibilityChange);
  performanceVisibilityRef.current = onPerformanceVisibilityChange;
  const networkExitRef = useRef(onNetworkExit);
  networkExitRef.current = onNetworkExit;
  const slotIdRef = useRef(online?.slotId ?? 0);
  const reconnectTokenRef = useRef(online?.reconnectToken ?? "");
  const snapshotRef = useRef<OnlineSnapshot | null>(online?.snapshot ?? null);
  const wingRewardRef = useRef<WingRewardNotice | null>(null);
  const remoteFramesRef = useRef<RemoteFrame[]>([]);
  const activeSocketRef = useRef<WebSocket | null>(online?.socket ?? null);
  const joinedSocketRef = useRef<WebSocket | null>(online?.socket ?? null);
  const pendingInputsRef = useRef<Array<{ seq: number; input: StepInput }>>([]);
  const nextSeqRef = useRef(0);
  const [networkStatus, setNetworkStatus] = useState("");
  const [connectedPilots, setConnectedPilots] = useState(
    online?.snapshot.players.filter((player) => player.connected).length ?? 0,
  );
  const serverEndedRef = useRef(Boolean(online?.snapshot.match.over));
  const seedRef = useRef(1);
  const replayRef = useRef<StepInput[]>([]);
  // Staging diagnostics only: bit-exact state checksum after every applied step,
  // so a rejected claim can be traced to the first frame where the live Arena
  // and the reward server diverged.
  const checksumRef = useRef<number[]>([]);
  const gyroOn = useRef(gyro);
  const drillCb = useRef(onDrill);
  gyroOn.current = gyro;
  drillCb.current = onDrill;
  if (!busRef.current) busRef.current = createBus(scheme);
  busRef.current.orbital = orbital;
  busRef.current.leftStickFlight = orbital && !online;
  busRef.current.countermeasureEnabled = orbital && !orbitalCampaign;
  if (!matchRef.current) {
    const seed = serverSeed ?? ((Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1);
    seedRef.current = seed;
    replayRef.current = [];
    matchRef.current = online
      ? copyMatch(online.snapshot.match)
      : createMatch(shipId, faction, refit, pace, {
          goal, allyCount, foeCount, disc, tech, seed, shieldMk2, localEndurance,
          orbitalTraining: orbital && !orbitalCampaign,
          orbitalRulesVersion: orbitalRuntime?.rulesVersion,
        });
    if (orbital) {
      prepareOrbital(matchRef.current, orbitalRuntime!.rulesVersion);
    }
    checksumRef.current = stagingTraceEnabled && !online ? [matchChecksum(matchRef.current)] : [];
    if (localUniverse) {
      universeTemplateRef.current = copyMatch(matchRef.current);
      placeAtSpawn(matchRef.current.player);
    }
  }
  const dispatchUniverse = (event: LocalUniverseCommand) => {
    const session = universeRef.current;
    const match = matchRef.current;
    const template = universeTemplateRef.current;
    const bus = busRef.current;
    if (!session || !match || !template) return;
    const next = transitionLocalUniverse(match, template, session, event);
    if (next === session) return;
    if (bus) clearInput(bus);
    rollCameraStabilizationRef.current = 0;
    setMapOpen(false);
    setCountermeasureVisible(false);
    countermeasureVisibleRef.current = false;
    universeRef.current = next;
    setUniverse(next);
  };
  const [end, setEnd] = useState<StrikeResult | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const [muted, setMutedUi] = useState(false);
  const [paused, setPaused] = useState(false);
  const [shakeUi, setShakeUi] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [maneuversOpen, setManeuversOpen] = useState(false);
  const [countermeasureVisible, setCountermeasureVisible] = useState(false);
  const countermeasureVisibleRef = useRef(false);
  const countermeasureUntilRef = useRef(0);
  const rollCameraStabilizationRef = useRef(0);
  const [cameraMode, setCameraMode] = useState<"chase" | "cockpit">("chase");
  const cameraModeRef = useRef<"chase" | "cockpit">("chase");
  cameraModeRef.current = cameraMode;
  const pausedRef = useRef(false);
  const dispatchUniverseRef = useRef(dispatchUniverse);
  dispatchUniverseRef.current = dispatchUniverse;
  const shakeRef = useRef(true);
  const floatRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const unifiedOrbitalControls = orbital && !online;
  /** Combat-only HUD is hidden outside the training activity of the local universe. */
  const exploringHud = Boolean(localUniverse) && universe?.phase !== "training";
  const [coach, setCoach] = useState(drilled ? "" : DRILL[0]);
  const coachStep = useRef(drilled ? 4 : 0);
  const ship = SHIPS[online ? pilotCraft(matchRef.current!, online.slotId).ship : shipId];

  useEffect(() => {
    if (!online) return;
    slotIdRef.current = online.slotId;
    reconnectTokenRef.current = online.reconnectToken;
    let disposed = false;
    let retryTimer: number | null = null;
    let handshakeTimer: number | null = null;
    let retryAttempt = 0;
    let reconnectDeadline = 0;
    let socket = online.socket;
    const clearRetryTimer = () => {
      if (retryTimer != null) window.clearTimeout(retryTimer);
      retryTimer = null;
    };
    const clearHandshakeTimer = () => {
      if (handshakeTimer != null) window.clearTimeout(handshakeTimer);
      handshakeTimer = null;
    };
    const endInterruptedMatch = () => {
      disposed = true;
      clearRetryTimer();
      clearHandshakeTimer();
      activeSocketRef.current = null;
      joinedSocketRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      networkExitRef.current("session_lost");
    };

    const onMessage = (event: MessageEvent) => {
      const source = event.currentTarget as WebSocket;
      let packet: { type?: string; [key: string]: unknown };
      try {
        packet = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (packet.type === "joined") {
        const joinedSnapshot = packet.snapshot as OnlineSnapshot | undefined;
        if (!joinedSnapshot?.match) return;
        clearHandshakeTimer();
        retryAttempt = 0;
        reconnectDeadline = 0;
        joinedSocketRef.current = source;
        slotIdRef.current = Number(packet.slotId);
        reconnectTokenRef.current = String(packet.reconnectToken ?? reconnectTokenRef.current);
        try {
          sessionStorage.setItem(
            online.sessionKey ?? `wfm-room-${online.roomId}`,
            reconnectTokenRef.current,
          );
        } catch {
          // The live transport keeps its rotated capability if storage is unavailable.
        }
        snapshotRef.current = joinedSnapshot;
        remoteFramesRef.current = [captureRemoteFrame(joinedSnapshot)];
        setConnectedPilots(joinedSnapshot.players.filter((player) => player.connected).length);
        serverEndedRef.current = Boolean(joinedSnapshot.match.over);
        const acknowledged = joinedSnapshot.players[slotIdRef.current]?.lastSeq ?? 0;
        pendingInputsRef.current = pendingInputsRef.current.filter((entry) => entry.seq > acknowledged);
        setNetworkStatus("");
        return;
      }
      if (packet.type === "authenticated") {
        const join: { type: string; name: string; reconnectToken?: string } = {
          type: "join",
          name: online.name,
        };
        if (reconnectTokenRef.current) join.reconnectToken = reconnectTokenRef.current;
        try {
          source.send(JSON.stringify(join));
        } catch {
          source.close();
        }
        return;
      }
      if (packet.type === "wing_reward_pending") {
        setNetworkStatus("VERIFYING MATCH REWARD…");
        return;
      }
      if (packet.type === "wing_reward") {
        const status = packet.status;
        const outcome = packet.outcome;
        const gain = packet.gain;
        const balanceAfter = packet.balanceAfter;
        const revision = packet.revision;
        if (
          (status === "awarded" ||
            status === "not_eligible" ||
            status === "daily_limit" ||
            status === "disabled" ||
            status === "unavailable") &&
          (outcome === "win" || outcome === "loss" || outcome === "draw") &&
          typeof gain === "number" &&
          Number.isSafeInteger(gain) &&
          gain >= 0 &&
          (balanceAfter === null ||
            (typeof balanceAfter === "number" &&
              Number.isSafeInteger(balanceAfter))) &&
          (revision === null ||
            (typeof revision === "number" && Number.isSafeInteger(revision)))
        ) {
          wingRewardRef.current = {
            status,
            outcome,
            gain,
            balanceAfter,
            revision,
            ...(typeof packet.reason === "string"
              ? { reason: packet.reason }
              : {}),
          };
          setNetworkStatus("");
        }
        return;
      }
      if (packet.type === "error" && packet.reason === "authentication_required") {
        endInterruptedMatch();
        return;
      }
      if (packet.type === "snapshot") {
        const next = packet.snapshot as OnlineSnapshot | undefined;
        if (next?.match && Array.isArray(next.players)) {
          snapshotRef.current = next;
          remoteFramesRef.current.push(captureRemoteFrame(next));
          if (remoteFramesRef.current.length > 4) remoteFramesRef.current.shift();
          setConnectedPilots(next.players.filter((player) => player.connected).length);
          serverEndedRef.current = Boolean(next.match.over);
        }
        return;
      }
      if (packet.type === "interrupted") {
        disposed = true;
        clearRetryTimer();
        clearHandshakeTimer();
        activeSocketRef.current = null;
        joinedSocketRef.current = null;
        acknowledgeInterruptedNotice(source);
        networkExitRef.current(packet.reason === "server_restart" ? "server_restart" : "session_lost");
        return;
      }
      if (packet.type === "error") {
        if (packet.reason === "session_lost") {
          disposed = true;
          clearRetryTimer();
          clearHandshakeTimer();
          activeSocketRef.current = null;
          joinedSocketRef.current = null;
          if (source.readyState === WebSocket.OPEN || source.readyState === WebSocket.CONNECTING) source.close();
          networkExitRef.current("session_lost");
          return;
        }
        setNetworkStatus("ROOM SIGNAL LOST · RECONNECTING");
        source.close();
      }
    };

    if (online.snapshot?.match) {
      remoteFramesRef.current = [captureRemoteFrame(online.snapshot)];
    }

    const scheduleReconnect = () => {
      if (disposed || serverEndedRef.current) return;
      const now = performance.now();
      if (reconnectDeadline === 0) reconnectDeadline = now + CLIENT_RECONNECT_WINDOW_MS;
      const delay = nextReconnectDelayMs(retryAttempt++, reconnectDeadline, now);
      if (delay == null) {
        const remaining = Math.max(0, reconnectDeadline - now);
        retryTimer = window.setTimeout(endInterruptedMatch, remaining);
        return;
      }
      clearRetryTimer();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        if (disposed) return;
        try {
          const url = currentWingSocketUrl();
          url.searchParams.set("room", online.roomId.toLowerCase());
          connect(new WebSocket(url));
        } catch {
          scheduleReconnect();
        }
      }, delay);
    };

    const connect = (target: WebSocket) => {
      socket = target;
      activeSocketRef.current = target;
      target.addEventListener("message", onMessage);
      target.addEventListener("open", () => {
        if (target === online.socket) {
          joinedSocketRef.current = target;
          setNetworkStatus("");
          return;
        }
        void online.getSessionToken().then((token) => {
          if (target.readyState !== WebSocket.OPEN) return;
          if (!token) {
            endInterruptedMatch();
            return;
          }
          target.send(JSON.stringify({ type: "authenticate", token }));
        }).catch(endInterruptedMatch);
      });
      target.addEventListener("close", () => {
        target.removeEventListener("message", onMessage);
        if (handshakeTimer != null) window.clearTimeout(handshakeTimer);
        handshakeTimer = null;
        if (joinedSocketRef.current === target) joinedSocketRef.current = null;
        if (disposed || activeSocketRef.current !== target) return;
        activeSocketRef.current = null;
        if (serverEndedRef.current) return;
        setNetworkStatus("SIGNAL LOST · RECONNECTING");
        scheduleReconnect();
      });
      if (target === online.socket && target.readyState === WebSocket.OPEN) {
        // This socket was already admitted in the lobby before Arena mounted.
        joinedSocketRef.current = target;
        setNetworkStatus("");
      } else if (target.readyState !== WebSocket.CLOSED) {
        handshakeTimer = window.setTimeout(() => {
          if (activeSocketRef.current === target && joinedSocketRef.current !== target) {
            setNetworkStatus("ROOM SIGNAL LOST · RECONNECTING");
            target.close();
          }
        }, SOCKET_HANDSHAKE_TIMEOUT_MS);
      }
    };

    connect(socket);
    if (socket.readyState === WebSocket.CLOSED) {
      setNetworkStatus("SIGNAL LOST · RECONNECTING");
      scheduleReconnect();
    }
    return () => {
      disposed = true;
      clearRetryTimer();
      clearHandshakeTimer();
      socket.removeEventListener("message", onMessage);
      if (activeSocketRef.current === socket) {
        activeSocketRef.current = null;
        socket.close();
      }
    };
  }, [online]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const bus = busRef.current;
    const match = matchRef.current;
    if (!canvas || !bus || !match) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "WebGL unavailable";
      setGlError(message);
      onGraphicsError?.(message);
      return;
    }
    const look =
      match.disc === "beacon"
        ? { clear: 0x101820, fog: 0.0064, hemi: 0xd5e8f4, ground: 0x141c24, sun: 0xd7e7ff, mars: 0x6e4634, ring: 0x9fd4e8 }
        : match.disc === "night"
          ? { clear: 0x07060a, fog: 0.011, hemi: 0x6e5c68, ground: 0x0c0a10, sun: 0xc45c48, mars: 0x3a1612, ring: 0xc45c48 }
          : match.disc === "dust"
            ? { clear: 0x16110c, fog: 0.008, hemi: 0xe7d2b0, ground: 0x1c1610, sun: 0xe0a15a, mars: 0x8a3a24, ring: 0xe0a15a }
            : { clear: 0x07080d, fog: 0.0072, hemi: 0xc5d0dc, ground: 0x10141c, sun: 0xffc89a, mars: 0x8a3a24, ring: 0xe0a15a };
    renderer.setClearColor(look.clear, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.fog = orbital ? null : new THREE.FogExp2(look.clear, look.fog);
    const orbitalAssets = orbital ? addOrbitalEnvironment(scene) : null;
    if (localUniverse && orbitalAssets) {
      const stationPose = cinderStationTransform();
      orbitalAssets.station.position.set(stationPose.position.x, stationPose.position.y, stationPose.position.z);
      orbitalAssets.station.rotation.set(0, stationPose.rotationY, 0);
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(7.2, 0.08, 8, 72),
        new THREE.MeshBasicMaterial({ color: 0xe0a15a, transparent: true, opacity: 0.55, depthWrite: false }),
      );
      gate.name = "cinder-dock-gate";
      orbitalAssets.station.add(gate);
    }
    const makeShip = orbital ? buildOrbitalShip : buildShip;
    if (orbital) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 520);
    scene.add(new THREE.HemisphereLight(look.hemi, 0x1a100c, 0.9));
    scene.add(new THREE.AmbientLight(0x8a8174, 0.28));
    const sun = new THREE.DirectionalLight(look.sun, 1.7);
    sun.position.set(-50, 40, -20);
    scene.add(sun);
    const theaterTextures = createTheaterTextures();

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_R, 72),
      new THREE.MeshStandardMaterial({
        color: look.ground, roughness: 1, metalness: 0,
        map: theaterTextures.basalt, bumpMap: theaterTextures.basalt, bumpScale: 0.12,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.visible = !orbital;
    scene.add(floor);
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * ARENA_R, 0.05, Math.sin(a) * ARENA_R));
    }
    const boundary = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: look.ring }),
    );
    boundary.visible = !orbital;
    scene.add(boundary);
    const starPositions = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const r = 160 + Math.random() * 180;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPositions[i * 3 + 1] = r * Math.cos(ph) * 0.55;
      starPositions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xe6e1d6, size: 0.55 })));
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(28, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: theaterTextures.mars,
        bumpMap: theaterTextures.mars,
        bumpScale: 0.3,
        emissive: look.mars,
        emissiveIntensity: 0.16,
        roughness: 1,
        fog: false,
      }),
    );
    mars.position.set(-24, 6, -150);
    mars.visible = !orbital;
    scene.add(mars);
    const marsLimb = createMarsLimb(look.sun);
    marsLimb.position.copy(mars.position);
    scene.add(marsLimb);

    const rockMeshes: THREE.Object3D[] = [];
    for (const rock of match.rocks) {
      const mesh = orbital ? orbitalRock(rock.r, rock.x) : new THREE.Mesh(
        new THREE.DodecahedronGeometry(rock.r, 0),
        metal(0x3a342c, 0x140e0c, 0.08),
      );
      mesh.position.set(rock.x, orbital ? .9 : rock.r * 0.35, rock.z);
      mesh.rotation.set(rock.x, rock.z, 0);
      scene.add(mesh);
      rockMeshes.push(mesh);
    }

    const relayMats: THREE.MeshStandardMaterial[] = [];
    match.relays.forEach((relay) => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 3.4, 8), metal(0x2c2924, 0x000000, 0));
      pole.position.y = 1.7;
      const lampMat = metal(0x8d877c, 0x3a342c, 0.2);
      const lamp = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 24), lampMat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.y = 2.6;
      group.add(pole, lamp);
      group.position.set(relay.x, 0, relay.z);
      scene.add(group);
      relayMats.push(lampMat);
    });

    const scenePilot = pilotCraft(match, slotIdRef.current);
    const playerGroup = makeShip(scenePilot.ship);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.52, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0a15a, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = -0.82;
    marker.visible = !orbital;
    playerGroup.add(marker);
    scene.add(playerGroup);
    const allyGroups = match.allies.map((ally) => {
      const group = makeShip(ally.ship);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.28, 20),
        new THREE.MeshBasicMaterial({ color: 0xe6e1d6, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.82;
      group.add(ring);
      scene.add(group);
      return group;
    });
    const enemyGroups = match.enemies.map((enemy) => {
      const group = makeShip(enemy.ship);
      if (enemy.ace) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.45, 1.62, 24),
          new THREE.MeshBasicMaterial({ color: 0xc45c48, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.82;
        group.add(ring);
      }
      scene.add(group);
      return group;
    });
    const damageControllers = new Map<THREE.Group, ReturnType<typeof createOrbitalDamageController>>();
    if (orbital) {
      for (const group of [playerGroup, ...allyGroups, ...enemyGroups]) {
        damageControllers.set(group, createOrbitalDamageController(group));
      }
    }

    const cage = new THREE.Group();
    const cageBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.7, 4.4),
      metal(match.runner?.team === "you" ? 0xc4a36a : 0x8a3a32, 0x2a140c, 0.25),
    );
    const cageCabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 1.3), metal(0xe6e1d6, 0x3a342c, 0.15));
    cageCabin.position.set(0, 0.5, -1.15);
    cage.add(cageBody, cageCabin);
    cage.visible = false;
    scene.add(cage);

    const bulletGeo = new THREE.SphereGeometry(0.2, 6, 6);
    const bulletMeshes = Array.from({ length: 110 }, () => {
      const mesh = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: 0xffd7a1 }));
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });
    const bracket = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.055, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xe0a15a }),
    );
    bracket.rotation.x = Math.PI / 2;
    bracket.visible = false;
    scene.add(bracket);
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const flare = new THREE.Mesh(new THREE.ConeGeometry(3.4, 16, 16, 1, true), flareMat);
    flare.geometry.rotateX(Math.PI / 2);
    flare.visible = false;
    scene.add(flare);
    const flareCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffe1ad,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const flareCore = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), flareCoreMat);
    flareCore.visible = false;
    scene.add(flareCore);
    const empMat = new THREE.MeshBasicMaterial({
      color: 0xe0a15a,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const emp = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 40), empMat);
    emp.rotation.x = -Math.PI / 2;
    emp.visible = false;
    scene.add(emp);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xfff1d2,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 9), streakMat);
    streak.visible = false;
    scene.add(streak);
    const bursts: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      t: number;
      life: number;
      grow: number;
    }[] = [];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.62, 28), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      bursts.push({ mesh, mat, t: 0, life: 0.3, grow: 6 });
    }
    const burst = (x: number, z: number, color: number, life: number, grow: number, y = 0) => {
      let slot = bursts[0];
      for (const item of bursts) {
        if (item.t <= 0) {
          slot = item;
          break;
        }
        if (item.t < slot.t) slot = item;
      }
      slot.t = life;
      slot.life = life;
      slot.grow = grow;
      slot.mat.color.setHex(color);
      slot.mesh.position.set(x, orbital ? .9 + y : .4, z);
      if (orbital) slot.mesh.quaternion.copy(camera.quaternion);
      slot.mesh.scale.setScalar(0.4);
      slot.mesh.visible = true;
    };
    const SPARK_N = 48;
    const sparkPool = Array.from({ length: SPARK_N }, () => freshSpark());
    const sparkPos = new Float32Array(SPARK_N * 3);
    for (let i = 0; i < SPARK_N; i++) sparkPos[i * 3 + 1] = -40;
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparkPoints = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({
        color: 0xffe1b0,
        size: 0.38,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    scene.add(sparkPoints);
    const impactSparks = (x: number, z: number, count: number, speed: number, life: number, y = 0) => {
      const free = orbital ? sparkPool.filter((spark) => spark.life <= 0) : [];
      emitSparks(sparkPool, x, z, count, speed, life);
      for (const spark of free) if (spark.life > 0) spark.y += y + .2;
    };
    const debrisGeometry = new THREE.BoxGeometry(.4, .08, .7);
    const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x766b5d, metalness: .7, roughness: .6 });
    const debris = Array.from({ length: orbital ? 24 : 0 }, (_, i) => {
      const mesh = new THREE.Mesh(debrisGeometry, debrisMaterial);
      mesh.visible = false;
      scene.add(mesh);
      const angle = i * 2.39996;
      return { mesh, t: 0, velocity: new THREE.Vector3(Math.cos(angle) * (1 + i % 3), Math.sin(i * 4) * 2, Math.sin(angle) * (1 + i % 4)) };
    });
    const _pop = new THREE.Vector3();
    const pops = Array.from({ length: 6 }, () => ({ t: 0, x: 0, y: 0, z: 0, text: "" }));
    const popNumber = (text: string, x: number, z: number, y = 0) => {
      let slot = pops[0];
      for (const item of pops) {
        if (item.t <= 0) {
          slot = item;
          break;
        }
        if (item.t < slot.t) slot = item;
      }
      slot.t = 0.7;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.text = text;
    };

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.fov = w < h ? 74 : 58;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyP") {
        event.preventDefault();
        const next = !pausedRef.current;
        pausedRef.current = next;
        setPaused(next);
        return;
      }
      if (
        event.code === "Space" &&
        event.target instanceof HTMLButtonElement &&
        !event.target.hasAttribute("data-flight-fire")
      ) {
        return;
      }
      bus.keys.add(event.code);
      if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      bus.keys.delete(event.code);
    };
    const clearHeld = () => clearInput(bus);
    const onOrientationReset = () => { if (localUniverse) clearHeld(); };
    const onVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      performanceVisibilityRef.current?.({ timestampMs: performance.now(), visible });
      if (visible) return;
      clearHeld();
      if (!onlineRef.current) {
        pausedRef.current = true;
        setPaused(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      unlockAudio();
      canvas.setPointerCapture(event.pointerId);
      bus.fireCanvas = true;
    };
    const onPointerUp = () => {
      bus.fireCanvas = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearHeld);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("orientationchange", resize);
    window.addEventListener("orientationchange", onOrientationReset);
    window.visualViewport?.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.__controlsTest = {
      getYaw: () => pilotCraft(match, slotIdRef.current).yaw,
      getSpeed: () => {
        const craft = pilotCraft(match, slotIdRef.current);
        return craft.space
          ? Math.hypot(craft.space.vx, craft.space.vy, craft.space.vz)
          : craft.speed;
      },
      getFiring: () => bus.fireCanvas || bus.fireButton || bus.keys.has("Space"),
      setKeys: (codes: string[]) => {
        bus.override = new Set(codes);
      },
      setSteer: (value: number) => {
        bus.steerOverride = value;
      },
    };

    let alive = true;
    let raf = 0;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      alive = false;
      glReadyRef.current = false;
      setGlReady(false);
      cancelAnimationFrame(raf);
      engineGain(0);
      const message = "Graphics connection lost. Exit this flight and relaunch; no result has been submitted.";
      setGlError(message);
      onGraphicsError?.(message);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    let last = performance.now();
    let acc = 0;
    let onlineAcc = 0;
    let inputSeq = nextSeqRef.current;
    let trauma = 0;
    let hitstop = 0;
    let markT = 0;
    let callT = 0;
    let callName = "";
    const wrecks: { x: number; z: number; t: number }[] = [];
    const threats: { rel: number; t: number }[] = [];
    let paintOn = false;
    let paintClock = 0;
    let flareT = 0;
    let flareX = 0;
    let flareY = 0;
    let flareZ = 0;
    let flareYaw = 0;
    let countermeasureFeedbackUntil = 0;
    let streakT = 0;
    let streakX = 0;
    let streakZ = 0;
    let streakYaw = 0;
    let empT = 0;
    let empX = 0;
    let empZ = 0;
    let reported = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      shakeRef.current = false;
      setShakeUi(false);
    }
    const FIXED = 1 / 60;
    let lastDockKey = "";
    glReadyRef.current = true;
    setGlReady(true);

    const frame = (now: number) => {
      if (!alive) return;
      const frameIntervalMs = Math.max(0, now - last);
      const delta = Math.min(0.1, frameIntervalMs / 1000);
      last = now;
      const isOnline = Boolean(onlineRef.current);
      const held = isOnline ? false : pausedRef.current || hitstop > 0;
      if (held) {
        acc = 0;
        if (!pausedRef.current) hitstop = Math.max(0, hitstop - delta);
      } else acc += delta;
      if (!held && gyroOn.current) {
        const aim = gyroAim();
        bus.gyroYaw = aim.yaw;
        bus.gyroPitch = aim.pitch;
      } else {
        bus.gyroYaw = 0;
        bus.gyroPitch = 0;
      }
      const universePhase = localUniverse ? universeRef.current?.phase ?? "exploration" : null;
      const sample = isOnline || held || (orbital && acc < FIXED) || universePhase !== null && universePhase !== "training" ? IDLE : readInput(bus);
      const exploringUniverse = universePhase !== null && universePhase !== "training";
      for (const rockMesh of rockMeshes) rockMesh.visible = !exploringUniverse;
      if (exploringUniverse) {
        // Local universe exploration: player-only spatial flight, no AI, no clock, no rewards.
        if (universeFrozen(universePhase)) acc = 0;
        let steps = 0;
        const pilot = match.player;
        while (acc >= FIXED && steps < 5 && pilot.space) {
          advanceLocalUniverseFlight(match, universeRef.current!, readInput(bus), FIXED);
          acc -= FIXED;
          steps += 1;
        }
        if (universePhase === "exploration") {
          const dock = evaluateCinderDock(pilot);
          const key = `${dock.reason}:${Math.round(dock.distance)}:${dock.closure.toFixed(1)}:${Math.round(dock.headingDeg)}`;
          if (key !== lastDockKey) {
            lastDockKey = key;
            setDockState(dock);
          }
        }
        match.fx.length = 0;
      } else if (isOnline) {
        acc = 0;
        const authoritative = snapshotRef.current;
        if (authoritative) {
          snapshotRef.current = null;
          Object.assign(match, copyMatch(authoritative.match));
          const acknowledged = authoritative.players[slotIdRef.current]?.lastSeq ?? 0;
          pendingInputsRef.current = pendingInputsRef.current.filter((entry) => entry.seq > acknowledged);
          for (const pending of pendingInputsRef.current) {
            const pilot = pilotCraft(match, slotIdRef.current);
            if (slotIdRef.current === 0) step(match, pending.input, 1 / 30);
            else {
              pilot.human = pending.input;
              step(match, IDLE, 1 / 30);
            }
          }
        }
        onlineAcc += delta;
        let onlineSteps = 0;
        while (onlineAcc >= 1 / 30 && onlineSteps < 4 && !match.over) {
          const played = pausedRef.current ? IDLE : readInput(bus);
          const seq = ++inputSeq;
          nextSeqRef.current = seq;
          pendingInputsRef.current.push({ seq, input: played });
          if (replayRef.current.length < 22000) replayRef.current.push(played);
          const socket = activeSocketRef.current;
          if (socket?.readyState === WebSocket.OPEN && joinedSocketRef.current === socket) {
            try {
              socket.send(JSON.stringify({ type: "input", input: { ...played, seq } }));
            } catch {
              setNetworkStatus("SIGNAL LOST · RECONNECTING");
              socket.close();
            }
          }
          const pilot = pilotCraft(match, slotIdRef.current);
          if (slotIdRef.current === 0) step(match, played, 1 / 30);
          else {
            pilot.human = played;
            step(match, IDLE, 1 / 30);
          }
          onlineAcc -= 1 / 30;
          onlineSteps += 1;
        }
      } else {
        let first = true;
        let steps = 0;
        while (acc >= FIXED && steps < 5 && !match.over) {
          const played = first ? sample : { ...sample, ult: false, lock: false, evade: 0, preset: null, ...(orbital ? { inertial: false, missile: false, aimAssist: false } : {}) };
          if (replayRef.current.length < 22000) replayRef.current.push(played);
          step(match, played, FIXED);
          if (stagingTraceEnabled && checksumRef.current.length <= 22000) checksumRef.current.push(matchChecksum(match));
          first = false;
          acc -= FIXED;
          steps += 1;
        }
      }
      const drill = coachStep.current;
      if (drill < 4) {
        const controlledPilot = pilotCraft(match, slotIdRef.current);
        const moved = controlledPilot.speed > 2;
        const turned = Math.abs(controlledPilot.yaw) > 0.22;
        const fired = controlledPilot.fireCd > 0;
        const powered = match.presetCd > 0;
        const next =
          drill === 0 && moved ? 1 : drill === 1 && turned ? 2 : drill === 2 && fired ? 3 : drill === 3 && powered ? 4 : drill;
        if (next !== drill) {
          coachStep.current = next;
          setCoach(next >= 4 ? "" : DRILL[next]);
          if (next >= 4) drillCb.current();
        }
      }
      for (const ev of match.fx) {
        if (ev.k === "shot") {
          const effectColor = ev.visualEffect
            ? WEAPON_EFFECT_COLORS[ev.visualEffect][ev.faction ?? (ev.you ? "accord" : "ussf")]
            : ev.you ? 0xffd9a0 : 0xc45c48;
          burst(ev.x, ev.z, effectColor, 0.12, ev.big ? 5 : 2.4, ev.y);
          if (ev.you) sfxShot(ev.audioCue === "heavy" || ev.big);
        } else if (ev.k === "hit") {
          burst(ev.x, ev.z, ev.you ? 0xc45c48 : 0xffd9a0, 0.16, 3.2, ev.y);
          impactSparks(ev.x, ev.z, ev.you ? 10 : 6, ev.you ? 8 : 5, 0.28, ev.y);
          if (!ev.you && ev.dmg > 0) popNumber(String(Math.max(1, Math.round(ev.dmg))), ev.x, ev.z, ev.y);
          if (shakeRef.current) trauma = addTrauma(trauma, ev.you ? 0.34 : 0.08);
          if (ev.you && shakeRef.current) hitstop = Math.min(0.07, Math.max(hitstop, 0.03));
          if (ev.you) {
            sfxHit();
            threats.push({
              rel: wrap(aimYaw(pilotCraft(match, slotIdRef.current).x, pilotCraft(match, slotIdRef.current).z, ev.fromX, ev.fromZ) - pilotCraft(match, slotIdRef.current).yaw),
              t: 0.45,
            });
          }
        } else if (ev.k === "boom") {
          burst(ev.x, ev.z, 0xc45c48, 0.45, 14, ev.y);
          impactSparks(ev.x, ev.z, 16, 12, 0.42, ev.y);
          debris.forEach((fragment) => {
            fragment.t = 12;
            fragment.mesh.visible = true;
            fragment.mesh.position.set(ev.x, .9 + (ev.y ?? 0), ev.z);
          });
          sfxBoom();
          wrecks.push({ x: ev.x, z: ev.z, t: orbital ? 12 : 1.6 });
          if (shakeRef.current) {
            trauma = addTrauma(trauma, 0.7);
            hitstop = Math.min(0.08, Math.max(hitstop, 0.05));
          }
        } else if (ev.k === "ping") {
          sfxHit();
          markT = 0.14;
        } else if (ev.k === "down") {
          callT = 1.35;
          callName = `${ev.name.toUpperCase()} DOWN`;
        } else if (ev.k === "flare") {
          flareT = 0.9;
          flareX = ev.x;
          flareY = ev.y ?? 0;
          flareZ = ev.z;
          flareYaw = ev.yaw;
          if (countermeasureFeedbackRef.current) {
            countermeasureFeedbackRef.current.textContent = countermeasureFeedbackLabel(ev.decoyed ?? 0, ev.disrupted ?? 0);
            countermeasureFeedbackRef.current.hidden = false;
          }
          countermeasureFeedbackUntil = performance.now() + 2200;
          burst(ev.x, ev.z, 0xffd9a0, 0.35, 10);
          sfxFlare();
        } else if (ev.k === "dive" || ev.k === "ram") {
          streakT = ev.k === "ram" ? 0.28 : 0.2;
          streakX = ev.x;
          streakZ = ev.z;
          streakYaw = ev.yaw;
          streakMat.color.setHex(ev.k === "ram" ? 0xd5ecff : 0xffd9a0);
          if (ev.k === "ram") sfxRam();
          else sfxDive();
        } else if (ev.k === "cloak") {
          burst(ev.x, ev.z, 0x9fd7ff, 0.4, 7);
          sfxCloak();
        } else if (ev.k === "emp") {
          empT = 0.5;
          empX = ev.x;
          empZ = ev.z;
          sfxEmp();
        } else if (ev.k === "mark") {
          burst(ev.x, ev.z, 0xc45c48, 0.28, 5);
          sfxMark();
        } else if (ev.k === "guard") {
          burst(ev.x, ev.z, 0xe6e1d6, 0.36, 6);
          sfxGuard();
        } else if (ev.k === "jam") {
          burst(ev.x, ev.z, 0xc45c48, 0.4, 16);
          sfxJam();
        }
      }
      match.fx.length = 0;
      if (universePhase === "training" && match.over) {
        dispatchUniverseRef.current({
          type: "training-outcome",
        });
      } else if (!localUniverse && match.over && (!onlineRef.current || serverEndedRef.current) && !reported) {
        reported = true;
        setEnd({
          outcome: outcomeForTeam(match, slotIdRef.current >= 5 ? 1 : 0) ?? "draw",
          kills: match.kills,
          deaths: match.deaths,
          reason: orbital
            ? orbitalCampaign
              ? match.over === "win"
                ? "The defending wing is broken. The Contact signal is ready for server verification."
                : !match.player.alive
                  ? "Your fighter was lost before the Contact signal could be decoded."
                  : "The Contact signal faded before the defending wing was broken."
              : match.over === "win"
                ? "All defenders destroyed. Combat Lab complete — no credits or campaign rewards."
                : !match.player.alive
                  ? "Your ship was destroyed. Retry the no-reward training operation."
                  : "Operation time expired. Retry and eliminate all defenders."
            : outcomeReason(match, slotIdRef.current >= 5 ? 1 : 0),
          relays: slotIdRef.current >= 5
            ? match.relays.filter((relay) => relay.own === -1).length
            : relaysHeld(match),
        });
      }

      const player = pilotCraft(match, slotIdRef.current);
      playerGroup.position.set(player.x, 0.9, player.z);
      orient(playerGroup, player.yaw, player.pitch, player.steer);
      paint(playerGroup, player);
      match.allies.forEach((ally, index) => {
        const group = allyGroups[index];
        if (slotIdRef.current === index + 1) {
          const wingLead = match.player;
          const pose = interpolateRemotePose(remoteFramesRef.current, 0, now);
          group.visible = true;
          group.position.set(pose?.x ?? wingLead.x, 0.9, pose?.z ?? wingLead.z);
          orient(group, pose?.yaw ?? wingLead.yaw, pose?.pitch ?? wingLead.pitch, pose?.steer ?? wingLead.steer);
          paint(group, wingLead);
          return;
        }
        const slotId = index + 1;
        const pose = interpolateRemotePose(remoteFramesRef.current, slotId, now);
        group.position.set(pose?.x ?? ally.x, 0.9, pose?.z ?? ally.z);
        orient(group, pose?.yaw ?? ally.yaw, pose?.pitch ?? 0, pose?.steer ?? ally.steer);
        paint(group, ally);
      });
      match.enemies.forEach((enemy, index) => {
        const group = enemyGroups[index];
        if (slotIdRef.current === index + 5) {
          const wingLead = match.player;
          const pose = interpolateRemotePose(remoteFramesRef.current, 0, now);
          group.visible = true;
          group.position.set(pose?.x ?? wingLead.x, 0.9, pose?.z ?? wingLead.z);
          orient(group, pose?.yaw ?? wingLead.yaw, pose?.pitch ?? wingLead.pitch, pose?.steer ?? wingLead.steer);
          paint(group, wingLead);
          return;
        }
        const slotId = index + 5;
        const pose = interpolateRemotePose(remoteFramesRef.current, slotId, now);
        group.position.set(pose?.x ?? enemy.x, 0.9, pose?.z ?? enemy.z);
        orient(group, pose?.yaw ?? enemy.yaw, pose?.pitch ?? 0, pose?.steer ?? enemy.steer);
        paint(group, enemy);
      });
      if (orbital) {
        const poses: Array<[THREE.Group, Craft]> = [[playerGroup, player], ...match.allies.map((c, i) => [allyGroups[i], c] as [THREE.Group, Craft]), ...match.enemies.map((c, i) => [enemyGroups[i], c] as [THREE.Group, Craft])];
        for (const [group, craft] of poses) {
          if (exploringUniverse && group !== playerGroup) {
            group.visible = false;
            continue;
          }
          if (!craft.space) continue;
          group.position.set(craft.x, .9 + craft.space.y, craft.z);
          group.quaternion.fromArray(craft.space.q);
          group.rotateY(Math.PI);
          damageControllers.get(group)?.update(craft.hull, craft.hullMax);
        }
      }
      if (match.runner) {
        cage.visible = match.runner.alive;
        cage.position.set(match.runner.x, 0.85, match.runner.z);
        cage.rotation.y = match.runner.yaw;
      }
      if (cageRef.current) {
        cageRef.current.textContent = match.runner
          ? `CAGE ${Math.max(0, Math.ceil((match.runner.hull / match.runner.hullMax) * 100))}`
          : "";
      }
      relayMats.forEach((mat, index) => {
        const own = match.relays[index].own;
        mat.emissive.setHex(own === 1 ? 0xe0a15a : own === -1 ? 0xc45c48 : 0x3a342c);
        mat.emissiveIntensity = own === 0 ? 0.15 : 0.9;
      });
      for (let i = 0; i < bulletMeshes.length; i++) {
        const bullet = match.bullets[i];
        const mesh = bulletMeshes[i];
        if (!bullet) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(bullet.x, .85 + (bullet.y ?? 0), bullet.z);
        const caliber = Math.max(0.55, Math.min(2.2, bullet.r / 0.3));
        mesh.scale.set(orbital ? .65 * caliber : 1, orbital ? .65 * caliber : 1, orbital ? (bullet.missile ? 3.5 : 2.5) * caliber : 1);
        if (orbital) mesh.quaternion.setFromUnitVectors(_fwd.set(0, 0, 1), _tmp.set(bullet.vx, bullet.vy ?? 0, bullet.vz).normalize());
        else mesh.scale.setScalar(bullet.r > 0.5 ? 2.2 : 1);
        const effectColor = bullet.visualEffect ? WEAPON_EFFECT_COLORS[bullet.visualEffect] : null;
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(
          effectColor
            ? effectColor[bullet.faction]
            : bullet.faction === "accord" ? 0xffd7a1 : 0xd5ecff,
        );
      }
      const hostiles = player.team === "foe" ? [match.player, ...match.allies] : match.enemies;
      const locked = hostiles.find((enemy) => enemy.id === player.lockTargetId && enemy.alive);
      bracket.visible = Boolean(locked) && !exploringUniverse;
      if (locked) {
        bracket.position.set(locked.x, orbital ? .9 + (locked.space?.y ?? 0) : .2, locked.z);
        if (orbital) bracket.quaternion.copy(camera.quaternion);
        bracket.scale.setScalar(Math.max(1, locked.radius / 1.5));
      }

      flareT = Math.max(0, flareT - delta);
      flare.visible = flareT > 0;
      flareCore.visible = flare.visible;
      if (flare.visible) {
        const fax = -Math.sin(flareYaw);
        const faz = -Math.cos(flareYaw);
        const flareHeight = 0.85 + flareY;
        flare.position.set(flareX + fax * 4, flareHeight, flareZ + faz * 4);
        flare.rotation.set(0, flareYaw + Math.PI, 0);
        const flareProgress = 1 - flareT / 0.9;
        flare.scale.setScalar(0.7 + flareProgress * 0.45);
        flareMat.opacity = (flareT / 0.9) * 0.78;
        flareCore.position.set(flareX + fax * 2.5, flareHeight, flareZ + faz * 2.5);
        flareCore.scale.setScalar(0.75 + flareProgress * 1.1);
        flareCoreMat.opacity = Math.min(1, flareT * 1.4);
      }
      streakT = Math.max(0, streakT - delta);
      streak.visible = streakT > 0;
      if (streak.visible) {
        const sax = -Math.sin(streakYaw);
        const saz = -Math.cos(streakYaw);
        streak.position.set(streakX + sax * 4, 0.45, streakZ + saz * 4);
        streak.rotation.set(0, streakYaw + Math.PI, 0);
        streakMat.opacity = Math.min(0.9, streakT * 3);
      }
      for (const item of bursts) {
        if (item.t <= 0) continue;
        item.t = Math.max(0, item.t - delta);
        const u = 1 - item.t / item.life;
        item.mesh.visible = item.t > 0;
        item.mesh.scale.setScalar(0.4 + u * item.grow);
        item.mat.opacity = item.t / item.life;
      }
      for (const fragment of debris) {
        fragment.t = Math.max(0, fragment.t - delta);
        fragment.mesh.visible = fragment.t > 0;
        if (!fragment.mesh.visible) continue;
        fragment.mesh.position.addScaledVector(fragment.velocity, delta);
        fragment.mesh.rotateX(delta * .8);
        fragment.mesh.rotateZ(delta * .5);
        fragment.mesh.scale.setScalar(Math.min(1, fragment.t));
      }
      empT = Math.max(0, empT - delta);
      emp.visible = empT > 0;
      if (emp.visible) {
        const grow = 1 + (1 - empT / 0.5) * 16;
        emp.position.set(empX, 0.3, empZ);
        emp.scale.setScalar(grow);
        empMat.opacity = empT / 0.5;
      }

      const fwx = -Math.sin(player.yaw);
      const fwz = -Math.cos(player.yaw);
      _cam.set(player.x - fwx * 16, 7.4, player.z - fwz * 16);
      _look.set(player.x + fwx * 14, 1.05, player.z + fwz * 14);
      if (orbital && player.space) {
        const cockpit = cameraModeRef.current === "cockpit";
        const liveRollActive = bus.orbital && bus.leftStickFlight &&
          Date.now() < bus.circularRollUntil &&
          Math.abs(bus.circularRoll) > 0.01;
        const rollActive = Math.abs(player.space.maneuverRollRemaining ?? 0) > 0 || liveRollActive;
        rollCameraStabilizationRef.current = rollActive
          ? 1
          : Math.max(0, rollCameraStabilizationRef.current - delta * 2.6);
        const stabilization = rollCameraStabilizationRef.current;
        const pose = orbitalCameraPose(player.space.q, cockpit, stabilization);
        _cam.set(player.x + pose.offset.x, .9 + player.space.y + pose.offset.y, player.z + pose.offset.z);
        _look.set(player.x + pose.ahead.x, .9 + player.space.y + pose.ahead.y, player.z + pose.ahead.z);
        if (stabilization > 0) {
          _cameraUp.set(pose.up.x, pose.up.y, pose.up.z);
          camera.up.lerp(_cameraUp, 1 - Math.exp(-12 * delta)).normalize();
        } else {
          camera.up.set(pose.up.x, pose.up.y, pose.up.z);
        }
      }
      const blend = 1 - Math.exp(-5 * delta);
      camera.position.lerp(_cam, blend);
      trauma = decayTrauma(trauma, delta);
      const mag = shakeRef.current ? shakeMag(trauma) : 0;
      if (mag > 0.001) {
        const t = now * 0.001;
        camera.position.x += shakeNoise(t, 1) * mag * 0.7;
        camera.position.y += shakeNoise(t, 2) * mag * 0.32;
        camera.position.z += shakeNoise(t, 3) * mag * 0.45;
      }
      camera.lookAt(_look);
      if (mag > 0.001) camera.rotateZ(shakeNoise(now * 0.001, 4) * mag * 0.05);
      tickSparks(sparkPool, delta);
      for (let i = 0; i < SPARK_N; i++) {
        sparkPos[i * 3] = sparkPool[i].x;
        sparkPos[i * 3 + 1] = sparkPool[i].y;
        sparkPos[i * 3 + 2] = sparkPool[i].z;
      }
      (sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      renderer.render(scene, camera);
      const viewW = canvas.clientWidth || 1;
      const viewH = canvas.clientHeight || 1;
      pops.forEach((pop, index) => {
        const el = floatRefs.current[index];
        if (!el) return;
        if (pop.t <= 0) {
          el.style.opacity = "0";
          return;
        }
        pop.t = Math.max(0, pop.t - delta);
        _pop.set(pop.x, pop.y + 1.6 + (0.7 - pop.t) * 3, pop.z);
        _pop.project(camera);
        el.textContent = pop.text;
        el.style.opacity = String(Math.max(0, pop.t / 0.7));
        el.style.left = `${(_pop.x * 0.5 + 0.5) * viewW}px`;
        el.style.top = `${(-_pop.y * 0.5 + 0.5) * viewH}px`;
      });
      const top = SHIPS[player.ship].maxSpeed;
      engineGain(pausedRef.current || !player.alive ? 0 : Math.min(1, Math.abs(player.speed) / Math.max(1, top)));

      if (shieldRef.current) {
        shieldRef.current.style.width = `${Math.max(0, (player.shield / player.shieldMax) * 100)}%`;
      }
      if (hullRef.current) {
        hullRef.current.style.width = `${Math.max(0, (player.hull / player.hullMax) * 100)}%`;
      }
      const invertedTeam = slotIdRef.current >= 5;
      if (youRef.current) youRef.current.style.width = `${invertedTeam ? match.foeBar : match.youBar}%`;
      if (foeRef.current) foeRef.current.style.width = `${invertedTeam ? match.youBar : match.foeBar}%`;
      if (clockRef.current) {
        const left = Math.max(0, match.limit - match.time);
        const mins = Math.floor(left / 60);
        const secs = Math.floor(left % 60);
        clockRef.current.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
        clockRef.current.setAttribute("aria-label", `${mins} minutes ${secs} seconds remaining`);
        clockRef.current.classList.toggle("text-bone", left > 30);
        clockRef.current.classList.toggle("text-alert", left <= 30 && left > 0);
        clockRef.current.classList.toggle("animate-pulse", left <= 10 && left > 0);
      }
      if (lockNameRef.current && lockHpRef.current) {
        if (locked) {
          const pct = Math.max(0, ((locked.shield + locked.hull) / (locked.shieldMax + locked.hullMax)) * 100);
          lockNameRef.current.textContent = SHIPS[locked.ship].name.toUpperCase();
          lockHpRef.current.style.width = `${pct}%`;
        } else {
          lockNameRef.current.textContent = "";
          lockHpRef.current.style.width = "0%";
        }
      }
      if (hurtRef.current) {
        hurtRef.current.style.opacity = player.alive ? String(Math.min(0.7, player.hurtT / 2.2)) : "0";
      }
      let ahead = 0;
      let left = 0;
      let right = 0;
      let behind = 0;
      for (let i = threats.length - 1; i >= 0; i--) {
        threats[i].t -= delta;
        if (threats[i].t <= 0) {
          threats.splice(i, 1);
          continue;
        }
        const rel = threats[i].rel;
        const strength = Math.min(1, threats[i].t / 0.45);
        const abs = Math.abs(rel);
        if (abs < 0.7) ahead = Math.max(ahead, strength);
        else if (abs > 2.4) behind = Math.max(behind, strength);
        else if (rel > 0) left = Math.max(left, strength);
        else right = Math.max(right, strength);
      }
      if (aheadRef.current) aheadRef.current.style.opacity = String(ahead);
      if (leftRef.current) leftRef.current.style.opacity = String(left);
      if (rightRef.current) rightRef.current.style.opacity = String(right);
      if (behindRef.current) behindRef.current.style.opacity = String(behind);
      if (downRef.current) {
        downRef.current.textContent =
          !player.alive && !match.over ? `HULL DOWN ${Math.max(0, player.respawn).toFixed(1)}` : "";
      }
      const painting = player.alive && match.painted.length > 0;
      paintClock -= delta;
      if (painting && (!paintOn || paintClock <= 0)) {
        sfxPaint();
        paintClock = 0.9;
      }
      if (!painting) paintClock = 0;
      paintOn = painting;
      if (contactRef.current) {
        if (exploringUniverse) contactRef.current.getContext("2d")?.clearRect(0, 0, contactRef.current.width, contactRef.current.height);
        else drawContacts(contactRef.current, match, pilotCraft(match, slotIdRef.current), slotIdRef.current);
      }
      if (orbital && player.space) {
        const s = player.space;
        const speed = Math.hypot(s.vx, s.vy, s.vz);
        if (speedRef.current) speedRef.current.textContent = `${Math.round(speed)} M/S`;
        if (throttleMeterRef.current) {
          const controlBus = busRef.current;
          const throttle = controlBus ? readThrottle(controlBus) : 0;
          const moving = speed > 0.8;
          throttleMeterRef.current.hidden = !moving;
          if (moving) {
            const magnitude = Math.abs(throttle);
            const direction = throttle > 0.04 ? "forward" : throttle < -0.04 ? "reverse" : "coast";
            const value = Math.round(throttle * 100);
            throttleMeterRef.current.dataset.direction = direction;
            throttleMeterRef.current.setAttribute("aria-valuenow", String(value));
            throttleMeterRef.current.setAttribute(
              "aria-valuetext",
              `${direction === "forward" ? "Forward" : direction === "reverse" ? "Reverse" : "Coasting"} ${Math.round(magnitude * 100)} percent`,
            );
            if (throttleFillRef.current) {
              throttleFillRef.current.style.top = `${throttle >= 0 ? 50 - magnitude * 50 : 50}%`;
              throttleFillRef.current.style.height = `${magnitude * 50}%`;
            }
            if (throttleValueRef.current) {
              throttleValueRef.current.textContent = `${direction === "forward" ? "FWD" : direction === "reverse" ? "REV" : "COAST"} ${Math.round(magnitude * 100)}%`;
            }
          }
        }
        if (boostRef.current) {
          const energyPercent = Math.max(0, Math.min(100, Math.round(s.energy)));
          if (boostRef.current.dataset.energyPercent !== String(energyPercent)) {
            boostRef.current.dataset.energyPercent = String(energyPercent);
            boostRef.current.dataset.energyLevel = energyPercent <= 15 ? "low" : "ready";
            boostRef.current.setAttribute(
              "aria-label",
              `Hold forward boost; energy ${energyPercent} percent. Boost drains energy while held and recharges when released.`,
            );
            const badge = boostRef.current.querySelector(".pilot-action-badge");
            if (badge) badge.textContent = `${energyPercent}%`;
          }
        }
        const solution = locked ? targetSolution(player, locked, match.rocks) : null;
        const shield = locked ? Math.ceil(locked.shield / locked.shieldMax * 100) : 0;
        const hull = locked ? Math.ceil(locked.hull / locked.hullMax * 100) : 0;
        if (targetStatusRef.current) {
          targetStatusRef.current.hidden = !locked || exploringUniverse;
          if (locked && solution) {
            const factionAccent = targetFactionAccent(locked.faction);
            const critical = isTargetHullCritical(hull);
            targetStatusRef.current.dataset.faction = locked.faction;
            targetStatusRef.current.dataset.critical = critical ? "true" : "false";
            targetStatusRef.current.style.setProperty("--target-accent", factionAccent);
            targetStatusRef.current.style.setProperty("--target-hull", targetHullColor(locked.faction, hull));
            if (targetFactionRef.current) targetFactionRef.current.textContent = locked.faction.toUpperCase();
            if (targetNameRef.current) targetNameRef.current.textContent = SHIPS[locked.ship].name.toUpperCase();
            if (targetDistanceRef.current) targetDistanceRef.current.textContent = `${Math.round(solution.distance)} M`;
            if (targetShieldRef.current) {
              targetShieldRef.current.style.width = `${Math.max(0, Math.min(100, shield))}%`;
              targetShieldRef.current.style.backgroundColor = factionAccent;
            }
            if (targetShieldValueRef.current) targetShieldValueRef.current.textContent = `${Math.max(0, shield)}%`;
            if (targetHullRef.current) {
              targetHullRef.current.style.width = `${Math.max(0, Math.min(100, hull))}%`;
              targetHullRef.current.style.backgroundColor = targetHullColor(locked.faction, hull);
            }
            if (targetHullValueRef.current) targetHullValueRef.current.textContent = `${Math.max(0, hull)}%`;
            if (targetLockRef.current) targetLockRef.current.style.width = `${Math.max(0, Math.min(100, s.lockProgress * 100))}%`;
            if (targetLockValueRef.current) targetLockValueRef.current.textContent = `${Math.floor(s.lockProgress * 100)}% LOCK`;
          }
        }
        if (telemetryRef.current) {
          telemetryRef.current.textContent = `${orbitalCampaign ? "CONTACT · CAMPAIGN" : "LAB · NO REWARDS"} · ${match.kills}/${match.enemies.length} DESTROYED\nSPD ${Math.hypot(s.vx, s.vy, s.vz).toFixed(1)} · ALT ${s.y.toFixed(1)} · ENERGY ${Math.ceil(s.energy)} · ARMOR ${Math.ceil(s.armor)}\n${s.assist ? "FLIGHT ASSIST" : "INERTIAL"} · ${s.aimAssist ? "AIM ASSIST" : "MANUAL AIM"}\n${locked ? `${locked.faction.toUpperCase()} · ${solution!.distance.toFixed(0)} m · SHD ${shield}% · HULL ${hull}% · LOCK ${Math.floor(s.lockProgress * 100)}%` : "R / TARGET: SELECT AN ENEMY"}`;
          telemetryRef.current.dataset.kills = String(match.kills);
          telemetryRef.current.dataset.ammo = String(s.ammo);
          telemetryRef.current.dataset.lock = String(s.lockProgress);
        }
        if (missileRef.current) {
          missileRef.current.disabled = !player.alive || s.lockProgress < 1 || s.missileCd > 0 || s.ammo <= 0;
          missileRef.current.dataset.ammo = String(s.ammo);
          missileRef.current.dataset.cooldown = s.missileCd > 0 ? s.missileCd.toFixed(1) : "0";
          const fireState = s.ammo <= 0
            ? "empty"
            : s.missileCd > 0
              ? "cooldown"
              : s.lockProgress < 1
                ? "acquiring-lock"
                : "ready";
          missileRef.current.dataset.fireState = fireState;
          const badge = missileRef.current.querySelector(".pilot-action-badge");
          if (badge) badge.textContent = s.missileCd > 0
            ? `${s.missileCd.toFixed(0)}s`
            : s.ammo <= 0
              ? "0"
              : s.lockProgress < 1
                ? `L${Math.floor(s.lockProgress * 100)}`
                : String(s.ammo);
          missileRef.current.setAttribute(
            "aria-label",
            !player.alive
              ? "Missile unavailable; pilot disabled"
              : s.ammo <= 0
                ? "Missiles depleted"
                : s.missileCd > 0
                  ? `Missile cooling down ${s.missileCd.toFixed(1)} seconds`
                  : s.lockProgress < 1
                    ? `Missile acquiring target lock, ${Math.floor(s.lockProgress * 100)} percent; select a target with the lock control`
                    : `Launch guided missile, ${s.ammo} remaining`,
          );
        }
        if (countermeasureRef.current) {
          const incomingCount = match.bullets.filter((bullet) =>
            bullet.missile && bullet.faction !== player.faction && bullet.homeId === player.id,
          ).length;
          if (incomingCount > 0) countermeasureUntilRef.current = Math.max(countermeasureUntilRef.current, match.time + 2);
          const incomingMissile = incomingCount > 0 || match.time < countermeasureUntilRef.current;
          const countermeasureCd = s.countermeasureCd ?? 0;
          countermeasureRef.current.disabled = !player.alive || !incomingMissile || countermeasureCd > 0;
          countermeasureRef.current.hidden = !incomingMissile;
          if (countermeasureVisibleRef.current !== incomingMissile) {
            countermeasureVisibleRef.current = incomingMissile;
            setCountermeasureVisible(incomingMissile);
          }
          countermeasureRef.current.dataset.incoming = String(incomingCount);
          countermeasureRef.current.setAttribute(
            "aria-label",
            countermeasureCd > 0 && incomingMissile
              ? `Countermeasure recharging for ${countermeasureCd.toFixed(1)} seconds`
              : incomingCount > 0
              ? `Deploy countermeasure to decoy or disrupt ${incomingCount} incoming missile${incomingCount === 1 ? "" : "s"}`
              : incomingMissile
                ? "Deploy countermeasure flare; incoming missile warning"
              : "Countermeasure available when a missile is tracking this pilot",
          );
        }
      }
      if (countermeasureFeedbackRef.current && countermeasureFeedbackUntil > 0) {
        countermeasureFeedbackRef.current.hidden = performance.now() >= countermeasureFeedbackUntil;
      }
      if (pipRef.current) {
        pipRef.current.textContent = `ENG ${match.pips.eng.toFixed(1)}  WEP ${match.pips.wep.toFixed(1)}  DEF ${match.pips.def.toFixed(1)}`;
      }
      if (wingRef.current) {
        const roster = invertedTeam ? match.enemies : match.allies;
        const up = roster.filter((ally) => ally.alive).length;
        wingRef.current.textContent = orbital
          ? orbitalCampaign ? `CONTACT WING ${up}/${roster.length}` : "TRAINING OPERATION"
          : `WING ${up}/${roster.length}`;
      }
      if (relayRef.current) {
        relayRef.current.textContent = orbital
          ? orbitalCampaign ? objective : "DESTROY ALL DEFENDERS · TRAINING ONLY"
          : relayCallout(match, invertedTeam ? "foe" : "you", player.x, player.z);
      }
      if (ultRef.current) {
        const availability = orbital ? orbitalAbilityAvailability(player) : null;
        const coolingDown = player.ultCd > 0.05;
        const energyBlocked = availability?.reason === "energy";
        const cooldown = coolingDown ? `${player.ultCd.toFixed(1)}s` : ship.ultShort;
        const badge = ultRef.current.querySelector(".pilot-action-badge");
        if (badge) badge.textContent = coolingDown ? cooldown : energyBlocked ? "LOW E" : ship.ultShort;
        if (availability) {
          ultRef.current.disabled = !availability.ready;
          const label = availability.reason === "cooldown"
            ? `${ship.ultShort} cooling down ${availability.cooldownSeconds.toFixed(1)} seconds`
            : availability.reason === "energy"
              ? `${ship.ultShort} unavailable: requires ${availability.energyCost} energy; ${Math.floor(availability.energy)} available`
              : availability.reason === "disabled"
                ? `${ship.ultShort} unavailable while pilot is disabled`
                : ship.ultShort;
          ultRef.current.setAttribute("aria-label", label);
          ultRef.current.title = label;
        } else {
          ultRef.current.setAttribute("aria-label", coolingDown ? `${ship.ultShort} cooling down ${cooldown}` : ship.ultShort);
          ultRef.current.title = ship.ultShort;
        }
      }
      if (lockRef.current) {
        lockRef.current.dataset.target = locked ? SHIPS[locked.ship].name : "";
        lockRef.current.dataset.locked = locked ? "true" : "false";
        if (locked) lockRef.current.style.setProperty("--lock-accent", targetFactionAccent(locked.faction));
        else lockRef.current.style.removeProperty("--lock-accent");
        lockRef.current.setAttribute("aria-label", locked ? `Change target lock, current target ${SHIPS[locked.ship].name}` : "Acquire target lock");
      }
      presetRefs.current.forEach((button, index) => {
        if (!button) return;
        const selected = index === match.preset;
        button.dataset.on = selected ? "1" : "0";
        button.setAttribute("aria-pressed", String(selected));
        button.style.opacity = match.presetCd > 0.05 && index !== match.preset ? "0.4" : "1";
      });
      const radar = radarRef.current;
      if (radar) {
        drawRadar(radar, match, pilotCraft(match, slotIdRef.current), slotIdRef.current);
        if (wrecks.length) {
          const ctx = radar.getContext("2d");
          if (ctx) {
            const w = radar.width;
            const scale = (w / 2 - 8) / ARENA_R;
            ctx.strokeStyle = "#e6e1d6";
            ctx.lineWidth = 1;
            for (const wreck of wrecks) {
              const x = w / 2 + wreck.x * scale;
              const y = w / 2 + wreck.z * scale;
              ctx.globalAlpha = Math.max(0.25, Math.min(1, wreck.t));
              ctx.strokeRect(x - 3, y - 3, 6, 6);
            }
            ctx.globalAlpha = 1;
          }
        }
      }
      for (let i = wrecks.length - 1; i >= 0; i--) {
        wrecks[i].t -= delta;
        if (wrecks[i].t <= 0) wrecks.splice(i, 1);
      }
      markT = Math.max(0, markT - delta);
      callT = Math.max(0, callT - delta);
      if (markRef.current) markRef.current.style.opacity = markT > 0 ? "1" : "0";
      if (callRef.current) {
        callRef.current.hidden = callT <= 0;
        callRef.current.textContent = callT > 0 ? callName : "";
      }
      performanceFrameRef.current?.({
        timestampMs: now,
        frameIntervalMs,
        gameSeconds: match.time,
        pageVisible: document.visibilityState === "visible",
        phase: match.over ? "post-match" : "active-play",
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      engineGain(0);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      delete window.__controlsTest;
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearHeld);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("orientationchange", resize);
      window.removeEventListener("orientationchange", onOrientationReset);
      window.visualViewport?.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      const geos = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) geos.add(mesh.geometry);
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((item) => mats.add(item));
        else if (mat) mats.add(mat);
      });
      geos.add(debrisGeometry);
      mats.add(debrisMaterial);
      geos.forEach((geo) => geo.dispose());
      mats.forEach((mat) => mat.dispose());
      theaterTextures.dispose();
      orbitalAssets?.textures.forEach((texture) => texture.dispose());
      damageControllers.forEach((controller) => controller.dispose());
      renderer.dispose();
      glReadyRef.current = false;
    };
  }, [ship.ultShort]);

  const bus = busRef.current;
  return (
    <div
      data-testid="arena-stage"
      data-mode-id={modeId}
      data-runtime-id={runtime}
      data-local-endurance={localEndurance ? "true" : "false"}
      className={`${orbital ? "lab-flight " : ""}relative h-dvh w-full touch-none overflow-hidden bg-void text-bone select-none`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={contactRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {online ? (
        <p className={`absolute left-1/2 top-3 z-30 -translate-x-1/2 border bg-void/85 px-3 py-2 font-hud text-xs tracking-widest ${networkStatus ? "border-alert/50 text-alert" : "border-solar/50 text-solar"}`}>
          {networkStatus || `LIVE WING · ${battlefieldProfile(online.snapshot.match.disc).callsign} FIELD · ${connectedPilots}/10 PILOTS · TEAM ${online.team + 1} · ${online.roomId}`}
        </p>
      ) : null}
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          ref={(el) => {
            floatRefs.current[index] = el;
          }}
          className="pointer-events-none absolute font-hud text-sm text-solar opacity-0"
        />
      ))}
      <div
        ref={hurtRef}
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{ boxShadow: "inset 0 0 90px 12px rgba(196,92,72,0.95)" }}
      />
      <div ref={aheadRef} className="pointer-events-none absolute top-28 left-1/2 h-1.5 w-16 -translate-x-1/2 bg-alert opacity-0" />
      <div ref={leftRef} className="pointer-events-none absolute top-1/2 left-3 h-16 w-1.5 -translate-y-1/2 bg-alert opacity-0" />
      <div ref={rightRef} className="pointer-events-none absolute top-1/2 right-3 h-16 w-1.5 -translate-y-1/2 bg-alert opacity-0" />
      <div ref={behindRef} className="pointer-events-none absolute bottom-32 left-1/2 h-1.5 w-16 -translate-x-1/2 bg-alert opacity-0" />
      <p ref={downRef} className="pointer-events-none absolute top-[58%] left-1/2 -translate-x-1/2 font-hud text-2xl tracking-widest text-alert" />
      {glError ? (
        <p className="absolute inset-x-0 top-1/3 px-6 text-center text-sm text-alert">{glError}</p>
      ) : null}
      {localUniverse && universe ? (
        <UniverseStationOverlay
          session={universe}
          dock={dockState}
          rendererReady={glReady && !glError}
          graphicsError={glError}
          servicesHref={localUniverse.servicesHref}
          onDock={() => {
            const pilot = matchRef.current?.player;
            if (!pilot || glError || !glReadyRef.current) return;
            dispatchUniverse({ type: "dock", rendererReady: glReadyRef.current });
          }}
          onUndock={() => dispatchUniverse({ type: "undock" })}
          onLaunchTraining={() => dispatchUniverse({ type: "launch-training" })}
          onAbortTraining={() => dispatchUniverse({ type: "abort-training" })}
          onReturn={() => dispatchUniverse({ type: "return-from-debrief" })}
          onExit={() => universeExitRef.current?.()}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0">
        <div className="pilot-top-bar absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-3 pt-3">
          <div className="w-[min(30vw,11rem)]">
            <p className="font-hud text-[10px] tracking-widest text-solar">{ship.name.toUpperCase()}</p>
            {orbital ? <p className="mt-0.5 font-hud text-[11px] tracking-widest text-bone"><span ref={speedRef}>0 M/S</span></p> : null}
            <div className="mt-1 flex items-center gap-1">
              <span className="w-10 font-hud text-[8px] tracking-widest text-muted">SHD</span>
              <div className="h-1.5 flex-1 overflow-hidden bg-panel/70"><div ref={shieldRef} className="h-full w-full bg-solar" /></div>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="w-10 font-hud text-[8px] tracking-widest text-muted">HULL</span>
              <div className="h-1.5 flex-1 overflow-hidden bg-panel/70"><div ref={hullRef} className="h-full w-full bg-alert" /></div>
            </div>
            <p ref={pipRef} hidden={orbital} className="mt-1 font-hud text-[9px] tracking-wide text-muted">ENG 2.0 · WEP 2.0 · DEF 2.0</p>
            {orbital ? (
              <>
                <div
                  ref={targetStatusRef}
                  hidden
                  data-testid="orbital-target-status"
                  aria-label="Locked target status"
                  className="pilot-target-status mt-2 rounded-sm border px-2 py-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2 font-hud text-[8px] tracking-[0.14em]">
                    <span className="pilot-target-faction truncate"><span ref={targetFactionRef}>CONTACT</span> · <span ref={targetNameRef}>TARGET</span></span>
                    <span ref={targetDistanceRef} className="shrink-0 text-bone/75">— M</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-hud text-[7px] tracking-widest text-muted">
                    <span className="w-7">SHD</span>
                    <div className="h-1 flex-1 overflow-hidden bg-panel/90"><div ref={targetShieldRef} data-testid="target-shield-bar" className="h-full w-full" /></div>
                    <span ref={targetShieldValueRef} className="w-7 text-right text-bone">100%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-hud text-[7px] tracking-widest text-muted">
                    <span className="w-7">HULL</span>
                    <div className="h-1 flex-1 overflow-hidden bg-panel/90"><div ref={targetHullRef} data-testid="target-hull-bar" className="h-full w-full" /></div>
                    <span ref={targetHullValueRef} data-testid="target-hull-value" className="w-7 text-right text-bone">100%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="h-px flex-1 overflow-hidden bg-panel/90"><div ref={targetLockRef} className="h-full w-0 bg-bone/75" /></div>
                    <span ref={targetLockValueRef} className="w-10 text-right font-mono text-[7px] tracking-wider text-bone/70">0% LOCK</span>
                  </div>
                </div>
                <p ref={callRef} data-testid="text-combat-callout" aria-live="off" className="mt-1 min-h-3 font-hud text-[8px] tracking-widest text-bone" />
              </>
            ) : null}
          </div>

          <div className="lab-status-center min-w-0 text-center">
            <span ref={clockRef} hidden={exploringHud} className="font-hud text-2xl leading-none text-bone" role="timer" aria-live="off" aria-label={pace === "strike" ? "6 minutes remaining" : "2 minutes remaining"}>
              {pace === "strike" ? "6:00" : "2:00"}
            </span>
            {!orbital ? <p className="font-hud text-[9px] tracking-widest text-muted"><span ref={wingRef}>WING</span></p> : null}
            {online ? (
              <button
                type="button"
                aria-label={`Copy room code ${online.roomId.toUpperCase()}`}
                className="pointer-events-auto font-hud text-[9px] tracking-widest text-solar"
                onClick={async (event) => {
                  const button = event.currentTarget;
                  try {
                    await navigator.clipboard.writeText(online.roomId.toUpperCase());
                    button.textContent = "ROOM CODE COPIED";
                    window.setTimeout(() => {
                      if (button.isConnected) button.textContent = `ROOM ${online.roomId.toUpperCase()} · COPY`;
                    }, 1400);
                  } catch {
                    button.textContent = `ROOM ${online.roomId.toUpperCase()}`;
                  }
                }}
              >ROOM {online.roomId.toUpperCase()} · COPY</button>
            ) : null}
            {!orbital ? (
              <>
                <p className="font-hud text-[9px] tracking-widest text-solar">{objective}</p>
                <p ref={relayRef} data-testid="text-relay-status" className="font-hud text-[9px] tracking-widest text-bone/80">0/3 HELD · HOLD 2 TO DRAIN</p>
                <p ref={cageRef} className="font-hud text-[9px] tracking-widest text-bone" />
                {tech ? <p className="font-hud text-[9px] tracking-widest text-muted">{tech === "stick" ? "LIGHTER STICK" : tech === "barrels" ? "HOT BARRELS" : "MARKED PREY"}</p> : null}
              </>
            ) : null}
            <div className={`${orbital ? "hidden" : "flex"} mt-1 items-center justify-center gap-2`}>
              <span className="font-hud text-[9px] text-solar">YOU</span>
              <div className="h-1.5 w-12 overflow-hidden bg-panel/70"><div ref={youRef} className="h-full w-full bg-solar" /></div>
              <div className="h-1.5 w-12 overflow-hidden bg-panel/70"><div ref={foeRef} className="h-full w-full bg-alert" /></div>
              <span className="font-hud text-[9px] text-muted">THEM</span>
            </div>
          </div>

          <div className="pointer-events-auto flex shrink-0 gap-2">
            {orbital ? (
              <PilotActionButton
                icon="camera"
                label={cameraMode === "chase" ? "Switch to cockpit camera" : "Switch to chase camera"}
                testId="button-camera-toggle"
                active={cameraMode === "cockpit"}
                onActivate={() => setCameraMode((mode) => mode === "chase" ? "cockpit" : "chase")}
              />
            ) : null}
            {exploringHud ? null : <PilotActionButton icon="map" label="Open tactical map" testId="button-tactical-map" active={mapOpen} onActivate={() => setMapOpen(true)} />}
            <PilotActionButton icon="pause" label={paused ? "Resume sortie" : "Open flight menu"} testId="button-pause" active={paused} onActivate={() => {
              const next = !pausedRef.current;
              pausedRef.current = next;
              setPaused(next);
              if (next) setManeuversOpen(false);
            }} />
          </div>
        </div>

        <div data-testid="reticle-center" className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 border border-solar/80" />
        <p
          ref={countermeasureFeedbackRef}
          data-testid="countermeasure-feedback"
          aria-live="polite"
          aria-atomic="true"
          hidden
          className="pointer-events-none absolute left-3 top-[calc(env(safe-area-inset-top,0px)+7.25rem)] max-w-[13rem] border border-solar/45 bg-void/80 px-2 py-1 font-hud text-[9px] uppercase tracking-[0.16em] text-bone shadow-lg"
        />
        <div ref={markRef} className="pointer-events-none absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 border border-alert opacity-0" />
        {!orbital ? (
          <div className="pointer-events-none absolute top-[42%] left-1/2 w-28 -translate-x-1/2 text-center">
            <p ref={lockNameRef} className="font-hud text-xs tracking-widest text-solar" />
            <div className="mx-auto mt-1 h-1 overflow-hidden bg-panel/80"><div ref={lockHpRef} className="h-full w-0 bg-alert" /></div>
            <p ref={callRef} className="mt-2 font-hud text-xs tracking-widest text-bone" />
          </div>
        ) : null}
        {coach ? <p className="pilot-coach pointer-events-none absolute left-1/2 w-[min(28rem,92vw)] -translate-x-1/2 bg-void/75 px-3 py-2 text-center font-hud text-sm tracking-wide text-bone">{coach}</p> : null}

        <div
          data-testid="flight-controls-left"
          className={`pilot-control-left absolute flex flex-col items-start gap-2 ${unifiedOrbitalControls ? "pilot-unified-controls" : ""}`}
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)", left: "calc(env(safe-area-inset-left, 0px) + 0.75rem)" }}
        >
          {orbital && !unifiedOrbitalControls && maneuversOpen ? (
            <div className="pilot-maneuver-actions pointer-events-auto flex max-w-[min(62vw,22rem)] flex-wrap justify-start gap-1.5" data-testid="pilot-maneuver-actions">
              <PilotActionButton icon="brake" label="Hold brake" testId="button-brake" onPress={() => bus?.keys.add("KeyB")} onRelease={() => bus?.keys.delete("KeyB")} onActivate={() => { if (bus) bus.keys.add("KeyB"); requestAnimationFrame(() => bus?.keys.delete("KeyB")); }} />
              <PilotActionButton icon="boost" label="Hold boost" testId="button-boost" onPress={() => bus?.keys.add("ShiftLeft")} onRelease={() => bus?.keys.delete("ShiftLeft")} onActivate={() => { if (bus) bus.keys.add("ShiftLeft"); requestAnimationFrame(() => bus?.keys.delete("ShiftLeft")); }} />
              <PilotActionButton icon="drift" label="Hold vector drift" testId="button-drift" onPress={() => bus?.keys.add("KeyT")} onRelease={() => bus?.keys.delete("KeyT")} onActivate={() => { if (bus) bus.keys.add("KeyT"); requestAnimationFrame(() => bus?.keys.delete("KeyT")); }} />
              <PilotActionButton icon="assist" label="Toggle inertial assist" testId="button-inertial-assist" onActivate={() => { if (bus) bus.inertialPulse = true; }} />
              <PilotActionButton icon="aim" label="Toggle aim assist" testId="button-aim-assist" onActivate={() => { if (bus) bus.aimAssistPulse = true; }} />
              {orbitalCampaign ? null : <PilotActionButton ref={countermeasureRef} icon="flare" label="Launch countermeasure flare" testId="button-countermeasure" disabled={!countermeasureVisible} hidden={!countermeasureVisible} onPress={() => {
                if (!bus) return;
                bus.countermeasurePulse = true;
                countermeasureUntilRef.current = 0;
                countermeasureVisibleRef.current = false;
                setCountermeasureVisible(false);
              }} onActivate={() => {
                if (!bus) return;
                bus.countermeasurePulse = true;
                countermeasureUntilRef.current = 0;
                countermeasureVisibleRef.current = false;
                setCountermeasureVisible(false);
              }} />}
            </div>
          ) : null}
          <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
            <div className="relative">
              <PilotFlightStick
                label={unifiedOrbitalControls ? "Left thumb flight" : orbital ? "Flight" : "Move"}
                testId={`stick-${orbital ? "flight" : "move"}`}
                size={unifiedOrbitalControls ? "rust-disc" : "arena"}
                className={unifiedOrbitalControls ? "pilot-rust-disc-stick" : ""}
                description={unifiedOrbitalControls ? "Drag up for forward thrust, down for reverse, and left or right to turn and bank. Double-tap an outer edge for a short vector-thrust pulse." : undefined}
                onAxis={(x, y) => {
              if (!bus) return;
              bus.leftX = x;
              bus.leftY = y;
                }}
                onPulse={unifiedOrbitalControls && bus ? (pulse) => {
              pulseVectorManeuver(bus, pulse);
              unlockAudio();
              sfxDive();
                } : undefined}
              />
            </div>
            {orbital ? (
              <div className="pilot-flight-actions pointer-events-auto flex flex-col items-center gap-2">
                {unifiedOrbitalControls ? (
                  <>
                    <div
                      ref={throttleMeterRef}
                      hidden
                      role="meter"
                      aria-label="Left-stick throttle"
                      aria-valuemin={-100}
                      aria-valuemax={100}
                      aria-valuenow={0}
                      aria-valuetext="Coasting 0 percent"
                      data-testid="pilot-throttle-meter"
                      data-direction="coast"
                      className="pilot-throttle-meter"
                    >
                      <span ref={throttleValueRef} className="pilot-throttle-value">COAST 0%</span>
                      <div className="pilot-throttle-track" aria-hidden="true">
                        <div className="pilot-throttle-centerline" />
                        <div ref={throttleFillRef} className="pilot-throttle-fill" />
                      </div>
                      <span className="pilot-throttle-caption">THR</span>
                    </div>
                    {exploringHud ? null : <PilotActionButton ref={lockRef} icon="aim" label="Acquire target lock" testId="button-target-lock" onActivate={() => { if (bus) bus.lockPulse = true; }} />}
                  </>
                ) : null}
                {!unifiedOrbitalControls ? (
                  <>
                    <PilotActionButton
                      icon="thrust"
                      label="Hold forward thrust"
                      testId="button-thrust"
                      accent
                      onPress={() => bus?.keys.add("KeyW")}
                      onRelease={() => bus?.keys.delete("KeyW")}
                      onActivate={() => {
                        if (bus) {
                          bus.keys.add("KeyW");
                          requestAnimationFrame(() => bus.keys.delete("KeyW"));
                        }
                      }}
                    />
                    <PilotActionButton
                      icon="maneuver"
                      label={maneuversOpen ? "Hide flight maneuvers" : "Open flight maneuvers"}
                      testId="button-maneuvers"
                      active={maneuversOpen}
                      onActivate={() => setManeuversOpen((value) => !value)}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div
          data-testid="flight-controls-right"
          className="pilot-control-right absolute flex flex-col items-end gap-2"
          style={{ right: "calc(env(safe-area-inset-right, 0px) + 0.75rem)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          {unifiedOrbitalControls ? (
            <>
              {orbital && maneuversOpen ? (
                <div className="pilot-maneuver-actions pointer-events-auto flex max-w-[min(62vw,22rem)] flex-wrap justify-end gap-1.5" data-testid="pilot-maneuver-actions">
                  <PilotActionButton icon="brake" label="Hold brake" testId="button-brake" onPress={() => bus?.keys.add("KeyB")} onRelease={() => bus?.keys.delete("KeyB")} onActivate={() => { if (bus) bus.keys.add("KeyB"); requestAnimationFrame(() => bus?.keys.delete("KeyB")); }} />
                  <PilotActionButton icon="drift" label="Hold vector drift" testId="button-drift" onPress={() => bus?.keys.add("KeyT")} onRelease={() => bus?.keys.delete("KeyT")} onActivate={() => { if (bus) bus.keys.add("KeyT"); requestAnimationFrame(() => bus?.keys.delete("KeyT")); }} />
                  <PilotActionButton icon="assist" label="Toggle inertial assist" testId="button-inertial-assist" onActivate={() => { if (bus) bus.inertialPulse = true; }} />
                  <PilotActionButton icon="aim" label="Toggle aim assist" testId="button-aim-assist" onActivate={() => { if (bus) bus.aimAssistPulse = true; }} />
                </div>
              ) : null}
              <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
                <div className="pilot-flight-actions pointer-events-auto flex flex-col items-center gap-2">
                  <PilotActionButton
                    icon="thrust"
                    label="Hold or pulse vertical ascent"
                    testId="button-thrust"
                    accent
                    onPress={() => bus?.keys.add("KeyC")}
                    onRelease={() => bus?.keys.delete("KeyC")}
                    onActivate={() => {
                      if (!bus) return;
                      pulseVectorManeuver(bus, { axis: "vertical", direction: 1 });
                      unlockAudio();
                      sfxDive();
                    }}
                  />
                  <PilotActionButton
                    icon="maneuver"
                    label={maneuversOpen ? "Hide flight maneuvers" : "Open flight maneuvers"}
                    testId="button-maneuvers"
                    active={maneuversOpen}
                    onActivate={() => setManeuversOpen((value) => !value)}
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="pilot-combat-actions pilot-rust-disc-combat-row pointer-events-auto flex items-center gap-2">
                    {orbitalCampaign || exploringHud ? null : (
                      <PilotActionButton
                        ref={countermeasureRef}
                        icon="flare"
                        label="Deploy countermeasure to decoy or disrupt incoming missile guidance"
                        testId="button-countermeasure"
                        accent
                        disabled={!countermeasureVisible}
                        hidden={!countermeasureVisible}
                        onPress={() => {
                          if (!bus) return;
                          bus.countermeasurePulse = true;
                          countermeasureUntilRef.current = 0;
                          countermeasureVisibleRef.current = false;
                          setCountermeasureVisible(false);
                        }}
                        onActivate={() => {
                          if (!bus) return;
                          bus.countermeasurePulse = true;
                          countermeasureUntilRef.current = 0;
                          countermeasureVisibleRef.current = false;
                          setCountermeasureVisible(false);
                        }}
                      />
                    )}
                    {exploringHud ? null : <PilotActionButton
                      ref={missileRef}
                      icon="missile"
                      label="Launch guided missile"
                      testId="button-missile"
                      accent
                      badge="MSL"
                      onPress={() => { unlockAudio(); if (bus) bus.missilePulse = true; }}
                      onActivate={() => {
                        unlockAudio();
                        if (bus) bus.missilePulse = true;
                      }}
                    />}
                    <div className="pilot-boost-fire-stack flex flex-col items-center gap-1">
                      <PilotActionButton
                        ref={boostRef}
                        icon="boost"
                        label="Hold forward boost; drains energy while held"
                        testId="button-boost"
                        accent
                        badge="100%"
                        onPress={() => bus?.keys.add("ShiftLeft")}
                        onRelease={() => bus?.keys.delete("ShiftLeft")}
                        onActivate={() => {
                          if (!bus) return;
                          bus.keys.add("ShiftLeft");
                          requestAnimationFrame(() => bus.keys.delete("ShiftLeft"));
                        }}
                      />
                      {exploringHud ? null : <PilotActionButton
                        icon="fire"
                        label="Hold primary guns"
                        testId="button-fire"
                        accent
                        fireAction
                        onPress={() => { unlockAudio(); if (bus) bus.fireButton = true; }}
                        onRelease={() => { if (bus) bus.fireButton = false; }}
                        onActivate={() => {
                          unlockAudio();
                          if (bus) bus.fireButton = true;
                          requestAnimationFrame(() => { if (bus) bus.fireButton = false; });
                        }}
                        className="pilot-action-fire"
                      />}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <PilotFlightStick label="Right thumb aim" testId="stick-aim" size="rust-disc" className="pilot-rust-disc-stick"
                    onCircularRollInput={bus?.orbital && bus.leftStickFlight ? (input) => {
                      setCircularRollControl(bus, input);
                      if (Math.abs(input) > 0.01) rollCameraStabilizationRef.current = 1;
                    } : undefined}
                    onAxis={(x, y) => {
                    if (!bus) return;
                    bus.rightX = x;
                    bus.rightY = y;
                  }} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="pilot-combat-actions pointer-events-auto flex items-center gap-2">
                <PilotActionButton ref={lockRef} icon="aim" label="Acquire target lock" testId="button-target-lock" onActivate={() => { if (bus) bus.lockPulse = true; }} />
                {orbital ? (
                  <PilotActionButton
                    ref={missileRef}
                    icon="missile"
                    label="Launch guided missile"
                    testId="button-missile"
                    accent
                    badge="MSL"
                    onPress={() => { unlockAudio(); if (bus) bus.missilePulse = true; }}
                    onActivate={() => {
                      unlockAudio();
                      if (bus) bus.missilePulse = true;
                    }}
                  />
                ) : (
                  <>
                    <PilotActionButton
                      icon="maneuver"
                      label="Evade incoming fire"
                      testId="button-dodge"
                      onActivate={() => { if (bus) bus.evadePulse = bus.leftX > 0.2 ? -1 : 1; }}
                    />
                    <PilotActionButton
                      ref={ultRef}
                      icon="boost"
                      label={ship.ultShort}
                      testId="button-special"
                      accent
                      badge={ship.ultShort}
                      onActivate={() => { unlockAudio(); if (bus) bus.ultPulse = true; }}
                    />
                  </>
                )}
                <PilotActionButton
                  icon="fire"
                  label="Hold primary guns"
                  testId="button-fire"
                  accent
                  fireAction
                  onPress={() => { unlockAudio(); if (bus) bus.fireButton = true; }}
                  onRelease={() => { if (bus) bus.fireButton = false; }}
                  onActivate={() => {
                    unlockAudio();
                    if (bus) bus.fireButton = true;
                    requestAnimationFrame(() => { if (bus) bus.fireButton = false; });
                  }}
                  className="pilot-action-fire"
                />
              </div>
              <div className="pointer-events-auto">
                <PilotFlightStick label="Aim" testId="stick-aim" size="arena" onAxis={(x, y) => {
                  if (!bus) return;
                  bus.rightX = x;
                  bus.rightY = y;
                }} />
              </div>
            </>
          )}
        </div>
      </div>
      {mapOpen && !end ? (
        <div className="pilot-map-backdrop absolute inset-0 z-20 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Tactical map">
          <div className="pilot-map-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-hud text-xs tracking-[0.24em] text-solar">TACTICAL MAP</p>
                <p className="mt-1 font-hud text-sm tracking-wider text-bone">{objective}</p>
              </div>
              <PilotActionButton icon="pause" label="Close tactical map" testId="button-close-tactical-map" onActivate={() => setMapOpen(false)} />
            </div>
            <canvas ref={radarRef} width={320} height={320} className="pilot-map-canvas" aria-label="Battlefield map showing current combat contacts" />
            <div className="pilot-map-legend font-hud text-[10px] tracking-widest">
              <span><i className="pilot-map-key pilot-map-friendly" /> FRIENDLY</span>
              <span><i className="pilot-map-key pilot-map-hostile" /> HOSTILE</span>
              <span><i className="pilot-map-key pilot-map-objective" /> OBJECTIVE</span>
            </div>
            <p className="mt-2 text-center font-hud text-[9px] tracking-widest text-muted">LIVE SORTIE CONTINUES WHILE MAP IS OPEN</p>
          </div>
        </div>
      ) : null}
      {paused && !end ? (
        <div className="pilot-pause-backdrop absolute inset-0 z-30 flex items-center justify-center overflow-y-auto p-4">
          <div className="pilot-pause-panel">
            <p className="font-hud text-3xl tracking-widest text-bone">FLIGHT MENU</p>
            <p className="mt-2 max-w-lg font-hud text-xs leading-relaxed tracking-wider text-muted">
              {online ? "This is a live room: the match continues while this menu is open." : "Local sortie paused. Flight controls and secondary settings are here, away from the pilot's sightline."}
            </p>
            <button type="button" data-testid="button-resume-sortie" className="pilot-menu-primary mt-4" onClick={() => {
              pausedRef.current = false;
              setPaused(false);
            }}>RESUME FLIGHT</button>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" data-testid="button-shake-toggle" aria-pressed={shakeUi} className="pilot-menu-setting" onClick={() => {
                const next = !shakeRef.current;
                shakeRef.current = next;
                setShakeUi(next);
              }}>{shakeUi ? "CAMERA SHAKE · ON" : "CAMERA SHAKE · OFF"}</button>
              <button type="button" data-testid="button-sound-toggle" aria-pressed={!muted} className="pilot-menu-setting" onClick={() => {
                const next = !isMuted();
                setMuted(next);
                setMutedUi(next);
              }}>{muted ? "SOUND · OFF" : "SOUND · ON"}</button>
            </div>
            {!orbital ? (
              <div className="mt-4">
                <p className="font-hud text-[10px] tracking-[0.22em] text-solar">FLIGHT PRESET</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESET_NAME.map((name, index) => (
                    <button key={name} type="button" ref={(node) => { presetRefs.current[index] = node; }}
                      data-on={index === 0 ? "1" : "0"} data-testid={`flight-preset-${index}`}
                      aria-pressed={index === 0} className="pilot-menu-setting pilot-preset"
                      onClick={() => { if (bus) bus.presetPulse = index as 0 | 1 | 2 | 3; }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <details className="mt-4 border-t border-bone/15 pt-3">
                <summary className="cursor-pointer font-hud text-[10px] tracking-[0.22em] text-solar">FLIGHT DIAGNOSTICS</summary>
                <p ref={telemetryRef} data-testid="lab-telemetry" className="mt-2 whitespace-pre-line border-l border-solar/60 pl-3 font-mono text-[10px] leading-5 text-bone/80" />
              </details>
            )}
            <details className="mt-3 border-t border-bone/15 pt-3">
              <summary className="cursor-pointer font-hud text-[10px] tracking-[0.22em] text-muted">KEYBOARD CONTROLS</summary>
              <p className="mt-2 font-mono text-[10px] leading-5 text-muted">
                {orbital ? "W/S THRUST · A/D YAW · I/K PITCH · Q/E ROLL · Z/X SLIDE · C/V LIFT · SHIFT BOOST · B BRAKE · R TARGET · M MISSILE" : scheme === "arc" ? "A/D TURN · W/S THRUST · SPACE FIRE · F SPECIAL" : "A/D SLIDE · AIM STICK TURNS · W/S THRUST · SPACE FIRE"}
              </p>
            </details>
          </div>
        </div>
      ) : null}
      {end ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-void/80 p-6">
          <div className="w-full max-w-sm border border-solar/50 bg-panel p-5">
            <p className="font-hud text-sm tracking-widest text-solar">
              {orbital ? orbitalCampaign ? "CAMPAIGN OPERATION · CONTACT" : "COMBAT LAB · TRAINING ONLY" : "STRIKE CLOSED"}
            </p>
            <h2 className="font-hud text-4xl leading-none text-bone">
              {orbital
                ? orbitalCampaign
                  ? end.outcome === "win" ? "Defending wing broken" : "Contact unresolved"
                  : end.outcome === "win" ? "Sector cleared" : "Operation ended"
                : end.outcome === "win"
                ? goal === "extract"
                  ? faction === "ussf"
                    ? "Cage away"
                    : "Cage stopped"
                  : goal === "ace"
                    ? "Warden down"
                    : goal === "beacons"
                      ? "Beacons held"
                      : "Disc held"
                : end.outcome === "loss"
                  ? goal === "extract"
                    ? faction === "ussf"
                      ? "Cage lost"
                      : "Cage escaped"
                    : "Wing lost"
                  : "Split disc"}
            </h2>
            <p className="mt-3 text-sm text-muted">
              {end.kills} kills · {end.deaths} losses{orbital
                ? orbitalCampaign ? " · Awaiting server verification" : " · No rewards issued"
                : ` · ${end.relays} relays still yours`}
            </p>
            <p data-testid="text-result-reason" className="mt-2 text-sm leading-relaxed text-bone/80">
              {end.reason}
            </p>
            {localEndurance && (
              <p className="mt-3 text-xs leading-relaxed text-bone/70" data-testid="performance-endurance-hint">
                This is a single local no-reward endurance run. If a result appears before the timer, the run stops
                and its report remains partial; it will not restart another match.
              </p>
            )}
            <button
              type="button"
              data-testid="button-arena-debrief"
              className="mt-5 h-12 w-full bg-solar font-hud text-lg tracking-widest text-void"
              onClick={() => onDone(end, {
                  seed: seedRef.current,
                  inputs: replayRef.current,
                  ...(stagingTraceEnabled ? { checksums: checksumRef.current } : {}),
                }, wingRewardRef.current ?? undefined)}
            >
              Debrief
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
