import type { PresetId, Scheme } from "./ships";
import type { StepInput } from "./sim";

export type Bus = {
  keys: Set<string>;
  override: Set<string> | null;
  steerOverride: number | null;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  fireCanvas: boolean;
  fireButton: boolean;
  ultPulse: boolean;
  lockPulse: boolean;
  evadePulse: number;
  presetPulse: PresetId | null;
  gyroYaw: number;
  gyroPitch: number;
  scheme: Scheme;
  qWas: boolean;
  eWas: boolean;
  fWas: boolean;
  rWas: boolean;
};

export function createBus(scheme: Scheme): Bus {
  return {
    keys: new Set(),
    override: null,
    steerOverride: null,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    fireCanvas: false,
    fireButton: false,
    ultPulse: false,
    lockPulse: false,
    evadePulse: 0,
    presetPulse: null,
    gyroYaw: 0,
    gyroPitch: 0,
    scheme,
    qWas: false,
    eWas: false,
    fWas: false,
    rWas: false,
  };
}

export function clearInput(bus: Bus) {
  bus.keys.clear();
  bus.override = null;
  bus.steerOverride = null;
  bus.leftX = 0;
  bus.leftY = 0;
  bus.rightX = 0;
  bus.rightY = 0;
  bus.fireCanvas = false;
  bus.fireButton = false;
  bus.ultPulse = false;
  bus.lockPulse = false;
  bus.evadePulse = 0;
  bus.presetPulse = null;
  bus.gyroYaw = 0;
  bus.gyroPitch = 0;
  bus.qWas = false;
  bus.eWas = false;
  bus.fWas = false;
  bus.rWas = false;
}

function clamp(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

const STICK_DEAD_ZONE = 0.08;

export function stickAxesFromDelta(dx: number, dy: number, maxDistance: number) {
  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(dy) ||
    !Number.isFinite(maxDistance) ||
    maxDistance <= 0
  ) {
    return { x: 0, y: 0 };
  }

  const distance = Math.hypot(dx, dy);
  if (distance <= maxDistance * STICK_DEAD_ZONE) return { x: 0, y: 0 };

  const magnitude =
    (Math.min(distance, maxDistance) / maxDistance - STICK_DEAD_ZONE) /
    (1 - STICK_DEAD_ZONE);
  return {
    x: clamp((dx / distance) * magnitude),
    y: clamp((dy / distance) * magnitude),
  };
}

export function readInput(bus: Bus): StepInput {
  const keys = bus.override ?? bus.keys;
  const keyLeft = keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0;
  const keyRight = keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0;
  const keyYaw = keyLeft - keyRight;
  const keyThr =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const stickYaw = -bus.leftX;
  const stickThr = -bus.leftY;
  const aimYaw = -bus.rightX;
  let yaw = 0;
  let strafe = 0;
  if (bus.scheme === "arc") {
    yaw = clamp(keyYaw + stickYaw + aimYaw * 0.75 + bus.gyroYaw);
    strafe = 0;
  } else {
    yaw = clamp(aimYaw + bus.gyroYaw);
    strafe = clamp(keyYaw + stickYaw);
  }
  if (bus.steerOverride != null) yaw = clamp(bus.steerOverride);
  const throttle = clamp(keyThr + stickThr);
  const pitch = clamp(-bus.rightY + bus.gyroPitch);
  const fire = bus.fireCanvas || bus.fireButton || keys.has("Space");
  const fDown = keys.has("KeyF");
  const ult = bus.ultPulse || (fDown && !bus.fWas);
  bus.ultPulse = false;
  bus.fWas = fDown;
  const rDown = keys.has("KeyR");
  const lock = bus.lockPulse || (rDown && !bus.rWas);
  bus.lockPulse = false;
  bus.rWas = rDown;
  let evade = 0;
  if (bus.evadePulse !== 0) {
    evade = bus.evadePulse;
    bus.evadePulse = 0;
  }
  const q = keys.has("KeyQ");
  const e = keys.has("KeyE");
  if (q && !bus.qWas) evade = 1;
  if (e && !bus.eWas) evade = evade === 0 ? -1 : evade;
  bus.qWas = q;
  bus.eWas = e;
  const preset = bus.presetPulse;
  bus.presetPulse = null;
  return { throttle, yaw, strafe, pitch, fire, ult, lock, evade, preset };
}
