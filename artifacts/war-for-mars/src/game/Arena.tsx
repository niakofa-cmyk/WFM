import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { engineGain, isMuted, setMuted, sfxBoom, sfxCloak, sfxDive, sfxEmp, sfxFlare, sfxGuard, sfxHit, sfxJam, sfxMark, sfxPaint, sfxRam, sfxShot, unlockAudio } from "./audio";
import "./controls-probe";
import { clearInput, createBus, readInput, stickAxesFromDelta, type Bus } from "./input";
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
  onNetworkExit: (reason: "server_restart" | "session_lost") => void;
  onGraphicsError?: (message: string) => void;
  onPerformanceFrame?: (frame: LocalPerformanceFrame) => void;
  onPerformanceVisibilityChange?: (change: LocalPerformanceVisibilityChange) => void;
  localEndurance?: boolean;
  online?: OnlineRoom;
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
  const hull = metal(accord ? 0xc8923a : 0xb7c3cc, accord ? 0x5a3410 : 0x1a242c, accord ? 0.42 : 0.25);
  const hot = metal(accord ? 0xffd7a1 : 0xd5ecff, accord ? 0xffb25a : 0x7eb6d4, 0.85);
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

function Stick({ label, onAxis }: { label: string; onAxis: (x: number, y: number) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointerOrigin = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const setAxis = (x: number, y: number) => {
    if (root.current) {
      root.current.dataset.axisX = x.toFixed(3);
      root.current.dataset.axisY = y.toFixed(3);
    }
    onAxis(x, y);
  };
  const place = (clientX: number, clientY: number) => {
    const el = root.current;
    const dot = knob.current;
    const origin = pointerOrigin.current;
    if (!el || !dot || !origin) return;
    const rect = el.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.36);
    const axis = stickAxesFromDelta(clientX - origin.x, clientY - origin.y, max);
    const dx = axis.x * max;
    const dy = axis.y * max;
    dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    setAxis(axis.x, axis.y);
  };
  const reset = (pointerId?: number) => {
    if (pointerId !== undefined && pointerOrigin.current?.pointerId !== pointerId) return;
    pointerOrigin.current = null;
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    setAxis(0, 0);
  };
  return (
    <div
      ref={root}
      role="group"
      aria-label={`${label} stick`}
      data-testid={`stick-${label.toLowerCase()}`}
      data-axis-x="0.000"
      data-axis-y="0.000"
      className="relative size-28 touch-none rounded-full border border-bone/30 bg-panel/80"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (pointerOrigin.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerOrigin.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        place(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (
          pointerOrigin.current?.pointerId !== event.pointerId ||
          !event.currentTarget.hasPointerCapture(event.pointerId)
        ) return;
        place(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        reset(event.pointerId);
      }}
      onPointerCancel={(event) => reset(event.pointerId)}
      onLostPointerCapture={(event) => reset(event.pointerId)}
    >
      <div
        ref={knob}
        className="absolute top-1/2 left-1/2 size-11 rounded-full bg-solar"
        style={{ transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
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
}: ArenaProps) {
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
  const lockNameRef = useRef<HTMLParagraphElement>(null);
  const lockHpRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<HTMLParagraphElement>(null);
  const relayRef = useRef<HTMLParagraphElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const hurtRef = useRef<HTMLDivElement>(null);
  const aheadRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const behindRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<HTMLParagraphElement>(null);
  const paintRef = useRef<HTMLParagraphElement>(null);
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
  if (!matchRef.current) {
    const seed = serverSeed ?? ((Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1);
    seedRef.current = seed;
    replayRef.current = [];
    matchRef.current = online
      ? copyMatch(online.snapshot.match)
      : createMatch(shipId, faction, refit, pace, { goal, allyCount, foeCount, disc, tech, seed, shieldMk2, localEndurance });
    checksumRef.current = stagingTraceEnabled && !online ? [matchChecksum(matchRef.current)] : [];
  }
  const [end, setEnd] = useState<StrikeResult | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const [muted, setMutedUi] = useState(false);
  const [paused, setPaused] = useState(false);
  const [shakeUi, setShakeUi] = useState(true);
  const pausedRef = useRef(false);
  const shakeRef = useRef(true);
  const floatRefs = useRef<(HTMLSpanElement | null)[]>([]);
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
    scene.fog = new THREE.FogExp2(look.clear, look.fog);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 520);
    scene.add(new THREE.HemisphereLight(look.hemi, 0x1a100c, 0.9));
    scene.add(new THREE.AmbientLight(0x8a8174, 0.28));
    const sun = new THREE.DirectionalLight(look.sun, 1.7);
    sun.position.set(-50, 40, -20);
    scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_R, 72),
      new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * ARENA_R, 0.05, Math.sin(a) * ARENA_R));
    }
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: look.ring }),
      ),
    );
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
        color: look.mars,
        emissive: look.mars,
        emissiveIntensity: 0.65,
        roughness: 1,
      }),
    );
    mars.position.set(-24, 6, -150);
    scene.add(mars);

    for (const rock of match.rocks) {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rock.r, 0),
        metal(0x3a342c, 0x140e0c, 0.08),
      );
      mesh.position.set(rock.x, rock.r * 0.35, rock.z);
      mesh.rotation.set(rock.x, rock.z, 0);
      scene.add(mesh);
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
    const playerGroup = buildShip(scenePilot.ship);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.52, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0a15a, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = -0.82;
    playerGroup.add(marker);
    scene.add(playerGroup);
    const allyGroups = match.allies.map((ally) => {
      const group = buildShip(ally.ship);
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
      const group = buildShip(enemy.ship);
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
    const burst = (x: number, z: number, color: number, life: number, grow: number) => {
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
      slot.mesh.position.set(x, 0.4, z);
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
    const _pop = new THREE.Vector3();
    const pops = Array.from({ length: 6 }, () => ({ t: 0, x: 0, z: 0, text: "" }));
    const popNumber = (text: string, x: number, z: number) => {
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
    window.visualViewport?.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.__controlsTest = {
      getYaw: () => pilotCraft(match, slotIdRef.current).yaw,
      getSpeed: () => pilotCraft(match, slotIdRef.current).speed,
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
    let flareZ = 0;
    let flareYaw = 0;
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
      const sample = isOnline ? IDLE : held ? IDLE : readInput(bus);
      if (isOnline) {
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
          const played = first ? sample : { ...sample, ult: false, lock: false, evade: 0, preset: null };
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
          burst(ev.x, ev.z, ev.you ? 0xffd9a0 : 0xc45c48, 0.12, ev.big ? 5 : 2.4);
          if (ev.you) sfxShot(ev.big);
        } else if (ev.k === "hit") {
          burst(ev.x, ev.z, ev.you ? 0xc45c48 : 0xffd9a0, 0.16, 3.2);
          emitSparks(sparkPool, ev.x, ev.z, ev.you ? 10 : 6, ev.you ? 8 : 5, 0.28);
          if (!ev.you && ev.dmg > 0) popNumber(String(Math.max(1, Math.round(ev.dmg))), ev.x, ev.z);
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
          burst(ev.x, ev.z, 0xc45c48, 0.45, 14);
          emitSparks(sparkPool, ev.x, ev.z, 16, 12, 0.42);
          sfxBoom();
          wrecks.push({ x: ev.x, z: ev.z, t: 1.6 });
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
          flareT = 0.42;
          flareX = ev.x;
          flareZ = ev.z;
          flareYaw = ev.yaw;
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
      if (match.over && (!onlineRef.current || serverEndedRef.current) && !reported) {
        reported = true;
        setEnd({
          outcome: outcomeForTeam(match, slotIdRef.current >= 5 ? 1 : 0) ?? "draw",
          kills: match.kills,
          deaths: match.deaths,
          reason: outcomeReason(match, slotIdRef.current >= 5 ? 1 : 0),
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
        mesh.position.set(bullet.x, 0.85, bullet.z);
        mesh.scale.setScalar(bullet.r > 0.5 ? 2.2 : 1);
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(
          bullet.faction === "accord" ? 0xffd7a1 : 0xd5ecff,
        );
      }
      const hostiles = player.team === "foe" ? [match.player, ...match.allies] : match.enemies;
      const locked = hostiles.find((enemy) => enemy.id === player.lockTargetId && enemy.alive);
      bracket.visible = Boolean(locked);
      if (locked) {
        bracket.position.set(locked.x, 0.2, locked.z);
        bracket.scale.setScalar(Math.max(1, locked.radius / 1.5));
      }

      flareT = Math.max(0, flareT - delta);
      flare.visible = flareT > 0;
      if (flare.visible) {
        const fax = -Math.sin(flareYaw);
        const faz = -Math.cos(flareYaw);
        flare.position.set(flareX + fax * 8, 0.7, flareZ + faz * 8);
        flare.rotation.set(0, flareYaw + Math.PI, 0);
        flareMat.opacity = (flareT / 0.42) * 0.55;
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
        _pop.set(pop.x, 1.6 + (0.7 - pop.t) * 3, pop.z);
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
      if (paintRef.current) paintRef.current.textContent = painting ? "PAINTED" : "";
      paintClock -= delta;
      if (painting && (!paintOn || paintClock <= 0)) {
        sfxPaint();
        paintClock = 0.9;
      }
      if (!painting) paintClock = 0;
      paintOn = painting;
      if (contactRef.current) drawContacts(contactRef.current, match, pilotCraft(match, slotIdRef.current), slotIdRef.current);
      if (pipRef.current) {
        pipRef.current.textContent = `ENG ${match.pips.eng.toFixed(1)}  WEP ${match.pips.wep.toFixed(1)}  DEF ${match.pips.def.toFixed(1)}`;
      }
      if (wingRef.current) {
        const roster = invertedTeam ? match.enemies : match.allies;
        const up = roster.filter((ally) => ally.alive).length;
        wingRef.current.textContent = `WING ${up}/${roster.length}`;
      }
      if (relayRef.current) {
        relayRef.current.textContent = relayCallout(match, invertedTeam ? "foe" : "you", player.x, player.z);
      }
      if (ultRef.current) {
        ultRef.current.textContent =
          player.ultCd > 0.05 ? `${ship.ultShort} ${player.ultCd.toFixed(1)}` : ship.ultShort;
      }
      if (lockRef.current) {
        lockRef.current.textContent = locked ? SHIPS[locked.ship].name.toUpperCase() : "LOCK";
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
      if (callRef.current) callRef.current.textContent = callT > 0 ? callName : "";
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
      geos.forEach((geo) => geo.dispose());
      mats.forEach((mat) => mat.dispose());
      renderer.dispose();
    };
  }, [ship.ultShort]);

  const bus = busRef.current;
  return (
    <div
      data-testid="arena-stage"
      data-local-endurance={localEndurance ? "true" : "false"}
      className="relative h-dvh w-full touch-none overflow-hidden bg-void text-bone select-none"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={contactRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {online ? (
        <p className={`absolute left-1/2 top-3 z-30 -translate-x-1/2 border bg-void/85 px-3 py-2 font-hud text-xs tracking-widest ${networkStatus ? "border-alert/50 text-alert" : "border-solar/50 text-solar"}`}>
          {networkStatus || `LIVE WING · ${connectedPilots}/10 PILOTS · TEAM ${online.team + 1} · ${online.roomId}`}
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
      <p ref={paintRef} className="pointer-events-none absolute top-[46%] left-1/2 -translate-x-1/2 font-hud text-xs tracking-widest text-alert" />
      {glError ? (
        <p className="absolute inset-x-0 top-1/3 px-6 text-center text-sm text-alert">{glError}</p>
      ) : null}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <div className="w-40">
            <p className="font-hud text-sm tracking-widest text-solar">{ship.name.toUpperCase()}</p>
            <div className="mt-1 flex items-center gap-1">
              <span className="w-12 font-hud text-[9px] tracking-widest text-muted">SHIELD</span>
              <div className="h-2 flex-1 overflow-hidden bg-panel">
                <div ref={shieldRef} className="h-full w-full bg-solar" />
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="w-12 font-hud text-[9px] tracking-widest text-muted">HULL</span>
              <div className="h-2 flex-1 overflow-hidden bg-panel">
                <div ref={hullRef} className="h-full w-full bg-alert" />
              </div>
            </div>
            <p ref={pipRef} className="mt-1 font-hud text-xs tracking-wide text-muted">
              ENG 2.0  WEP 2.0  DEF 2.0
            </p>
          </div>
          <div className="text-center">
            <span
              ref={clockRef}
              className="font-hud text-3xl leading-none text-bone"
              role="timer"
              aria-live="off"
              aria-label={pace === "strike" ? "6 minutes remaining" : "2 minutes remaining"}
            >
              {pace === "strike" ? "6:00" : "2:00"}
            </span>
            <p className="font-hud text-xs tracking-widest text-muted">
              <span ref={wingRef}>WING</span>
            </p>
            {online ? (
              <button
                type="button"
                aria-label={`Copy room code ${online.roomId.toUpperCase()}`}
                className="pointer-events-auto font-hud text-[10px] tracking-widest text-solar"
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
              >
                ROOM {online.roomId.toUpperCase()} · COPY
              </button>
            ) : null}
            <p className="font-hud text-[10px] tracking-widest text-solar">{objective}</p>
            <p ref={relayRef} data-testid="text-relay-status" className="font-hud text-[10px] tracking-widest text-bone/80">
              0/3 HELD · HOLD 2 TO DRAIN
            </p>
            <p ref={cageRef} className="font-hud text-[10px] tracking-widest text-bone" />
            {tech ? (
              <p className="font-hud text-[10px] tracking-widest text-muted">
                {tech === "stick" ? "LIGHTER STICK" : tech === "barrels" ? "HOT BARRELS" : "MARKED PREY"}
              </p>
            ) : null}
            <div className="mt-1 flex items-center gap-2">
              <span className="font-hud text-xs text-solar">YOU</span>
              <div className="h-2 w-16 overflow-hidden bg-panel">
                <div ref={youRef} className="h-full w-full bg-solar" />
              </div>
              <div className="h-2 w-16 overflow-hidden bg-panel">
                <div ref={foeRef} className="h-full w-full bg-alert" />
              </div>
              <span className="font-hud text-xs text-muted">THEM</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <canvas ref={radarRef} width={160} height={160} className="size-24 border border-bone/20 bg-void/70" />
            <button
              type="button"
              className="pointer-events-auto h-11 px-3 font-hud text-sm tracking-widest text-bone"
              onClick={() => {
                const next = !pausedRef.current;
                pausedRef.current = next;
                setPaused(next);
              }}
            >
              {paused ? "RESUME" : "HOLD"}
            </button>
            <button
              type="button"
              className="pointer-events-auto h-11 px-3 font-hud text-sm tracking-widest text-bone"
              onClick={() => {
                const next = !shakeRef.current;
                shakeRef.current = next;
                setShakeUi(next);
              }}
            >
              {shakeUi ? "SHAKE" : "SHAKE OFF"}
            </button>
            <button
              type="button"
              className="pointer-events-auto h-11 px-3 font-hud text-sm tracking-widest text-bone"
              onClick={() => {
                const next = !isMuted();
                setMuted(next);
                setMutedUi(next);
              }}
            >
              {muted ? "SOUND OFF" : "SOUND"}
            </button>
          </div>
        </div>

        <p className="absolute top-16 right-3 left-3 hidden text-center font-hud text-xs tracking-widest text-muted sm:block">
          {scheme === "arc"
            ? "A NOSE LEFT  ·  D NOSE RIGHT  ·  W BURN  ·  SPACE FIRE  ·  F ULT"
            : "A SLIDE LEFT  ·  D SLIDE RIGHT  ·  AIM STICK TURNS  ·  W BURN"}
        </p>
        <div className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 border border-solar/80" />
        <div
          ref={markRef}
          className="pointer-events-none absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 border border-alert opacity-0"
        />
        <div className="pointer-events-none absolute top-[42%] left-1/2 w-28 -translate-x-1/2 text-center">
          <p ref={lockNameRef} className="font-hud text-xs tracking-widest text-solar" />
          <div className="mx-auto mt-1 h-1 overflow-hidden bg-panel/80">
            <div ref={lockHpRef} className="h-full w-0 bg-alert" />
          </div>
          <p ref={callRef} className="mt-2 font-hud text-xs tracking-widest text-bone" />
        </div>
        {coach ? (
          <p className="pointer-events-none absolute bottom-36 left-1/2 w-[min(28rem,92vw)] -translate-x-1/2 bg-void/80 px-3 py-2 text-center font-hud text-sm tracking-wide text-bone">
            {coach}
          </p>
        ) : null}

        <div
          data-testid="flight-controls-left"
          className="absolute bottom-4 left-3 flex flex-col items-start gap-2"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            left: "calc(env(safe-area-inset-left, 0px) + 0.75rem)",
          }}
        >
          <div className="pointer-events-auto flex flex-col gap-2">
            {PRESET_NAME.map((name, index) => (
              <button
                key={name}
                type="button"
                ref={(node) => {
                  presetRefs.current[index] = node;
                }}
                data-on={index === 0 ? "1" : "0"}
                data-testid={`flight-preset-${index}`}
                aria-pressed={index === 0}
                className="h-11 w-16 border border-bone/25 bg-panel font-hud text-base tracking-widest text-bone"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (bus) bus.presetPulse = index as 0 | 1 | 2 | 3;
                }}
                onClick={(event) => {
                  if (event.detail !== 0 || !bus) return;
                  bus.presetPulse = index as 0 | 1 | 2 | 3;
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto">
            <Stick
              label="Move"
              onAxis={(x, y) => {
                if (!bus) return;
                bus.leftX = x;
                bus.leftY = y;
              }}
            />
          </div>
        </div>

        <div
          data-testid="flight-controls-right"
          className="absolute right-3 bottom-4 flex flex-col items-end gap-2"
          style={{
            right: "calc(env(safe-area-inset-right, 0px) + 0.75rem)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
        >
          <div className="pointer-events-auto flex gap-2">
            <button
              ref={lockRef}
              type="button"
              className="h-12 min-w-16 border border-bone/30 bg-panel px-2 font-hud text-sm tracking-widest text-bone"
              onPointerDown={(event) => {
                event.stopPropagation();
                if (bus) bus.lockPulse = true;
              }}
              onClick={(event) => {
                if (event.detail === 0 && bus) bus.lockPulse = true;
              }}
            >
              LOCK
            </button>
            <button
              type="button"
              className="h-12 min-w-16 border border-bone/30 bg-panel px-2 font-hud text-sm tracking-widest text-bone"
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!bus) return;
                bus.evadePulse = bus.leftX > 0.2 ? -1 : 1;
              }}
              onClick={(event) => {
                if (event.detail !== 0 || !bus) return;
                bus.evadePulse = bus.leftX > 0.2 ? -1 : 1;
              }}
            >
              DODGE
            </button>
            <button
              ref={ultRef}
              type="button"
              className="h-12 min-w-16 border border-solar bg-panel px-2 font-hud text-sm tracking-widest text-solar"
              onPointerDown={(event) => {
                event.stopPropagation();
                unlockAudio();
                if (bus) bus.ultPulse = true;
              }}
              onClick={(event) => {
                if (event.detail !== 0) return;
                unlockAudio();
                if (bus) bus.ultPulse = true;
              }}
            >
              {ship.ultShort}
            </button>
            <button
              type="button"
              data-flight-fire=""
              className="h-12 min-w-16 bg-solar px-3 font-hud text-sm tracking-widest text-void"
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                unlockAudio();
                if (bus) bus.fireButton = true;
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                if (bus) bus.fireButton = false;
              }}
              onPointerCancel={() => {
                if (bus) bus.fireButton = false;
              }}
            >
              FIRE
            </button>
          </div>
          <div className="pointer-events-auto">
            <Stick
              label="Aim"
              onAxis={(x, y) => {
                if (!bus) return;
                bus.rightX = x;
                bus.rightY = y;
              }}
            />
          </div>
        </div>
      </div>
      {paused && !end ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-void/75">
          <div className="text-center">
            <p className="font-hud text-4xl tracking-widest text-bone">HOLD</p>
            <p className="mt-2 font-hud text-xs tracking-widest text-muted">P or HOLD resumes the strike</p>
            <button
              type="button"
              className="pointer-events-auto mt-4 h-11 border border-solar/50 px-4 font-hud text-sm tracking-widest text-bone"
              onClick={() => {
                pausedRef.current = false;
                setPaused(false);
              }}
            >
              RESUME
            </button>
          </div>
        </div>
      ) : null}
      {end ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-void/80 p-6">
          <div className="w-full max-w-sm border border-solar/50 bg-panel p-5">
            <p className="font-hud text-sm tracking-widest text-solar">STRIKE CLOSED</p>
            <h2 className="font-hud text-4xl leading-none text-bone">
              {end.outcome === "win"
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
              {end.kills} kills · {end.deaths} losses · {end.relays} relays still yours
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
