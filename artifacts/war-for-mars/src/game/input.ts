import type { PresetId, Scheme } from "./ships";
import type { StepInput } from "./sim";
import { toOrbitalPilotStepInput, toOrbitalStepInput } from "./flight-control";
import { COORDINATED_BANK, mapFlightStickAxes, type ManeuverPulse } from "./pilot-stick-gestures";

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
  missilePulse: boolean;
  countermeasurePulse: boolean;
  inertialPulse: boolean;
  aimAssistPulse: boolean;
  evadePulse: number;
  presetPulse: PresetId | null;
  gyroYaw: number;
  gyroPitch: number;
  scheme: Scheme;
  qWas: boolean;
  eWas: boolean;
  fWas: boolean;
  rWas: boolean;
  orbital?: boolean;
  /** The offline Orbital Combat Lab touch mapping; live Wing retains its proven input contract. */
  leftStickFlight?: boolean;
  /** Countermeasures are enabled only where the active runtime contract supports them. */
  countermeasureEnabled?: boolean;
  verticalPulse: number;
  strafePulse: number;
  pulseTimers: { vertical: ReturnType<typeof setTimeout> | null; strafe: ReturnType<typeof setTimeout> | null };
  lastKeys?: Set<string>;
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
    missilePulse: false,
    countermeasurePulse: false,
    inertialPulse: false,
    aimAssistPulse: false,
    evadePulse: 0,
    presetPulse: null,
    gyroYaw: 0,
    gyroPitch: 0,
    scheme,
    qWas: false,
    eWas: false,
    fWas: false,
    rWas: false,
    verticalPulse: 0,
    strafePulse: 0,
    pulseTimers: { vertical: null, strafe: null },
  };
}

export function clearInput(bus: Bus) {
  if (bus.pulseTimers.vertical) clearTimeout(bus.pulseTimers.vertical);
  if (bus.pulseTimers.strafe) clearTimeout(bus.pulseTimers.strafe);
  bus.pulseTimers.vertical = null;
  bus.pulseTimers.strafe = null;
  bus.verticalPulse = 0;
  bus.strafePulse = 0;
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
  bus.missilePulse = false;
  bus.countermeasurePulse = false;
  bus.inertialPulse = false;
  bus.aimAssistPulse = false;
  bus.evadePulse = 0;
  bus.presetPulse = null;
  bus.gyroYaw = 0;
  bus.gyroPitch = 0;
  bus.qWas = false;
  bus.eWas = false;
  bus.fWas = false;
  bus.rWas = false;
  bus.lastKeys?.clear();
}

export function pulseVectorManeuver(bus: Bus, pulse: ManeuverPulse, durationMs = 180) {
  const timer = bus.pulseTimers[pulse.axis];
  if (timer) clearTimeout(timer);
  if (pulse.axis === "vertical") bus.verticalPulse = pulse.direction;
  else bus.strafePulse = pulse.direction;
  bus.pulseTimers[pulse.axis] = setTimeout(() => {
    if (pulse.axis === "vertical") bus.verticalPulse = 0;
    else bus.strafePulse = 0;
    bus.pulseTimers[pulse.axis] = null;
  }, Math.max(1, durationMs));
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
  const keyFlightYaw = keyRight - keyLeft;
  const keyThr =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const orbitalFlightStick = bus.orbital && bus.leftStickFlight
    ? mapFlightStickAxes(bus.leftX, bus.leftY)
    : null;
  const stickYaw = orbitalFlightStick?.yaw ?? -bus.leftX;
  const stickThr = -bus.leftY;
  const orbitalAim = bus.orbital ? mapFlightStickAxes(bus.rightX, bus.rightY) : null;
  const aimYaw = orbitalAim?.yaw ?? -bus.rightX;
  const flightYaw = bus.leftStickFlight
    ? clamp((bus.orbital ? keyFlightYaw : keyYaw) + (orbitalFlightStick?.yaw ?? stickYaw))
    : 0;
  let yaw = 0;
  let strafe = 0;
  if (bus.orbital && bus.leftStickFlight) {
    yaw = clamp(aimYaw + bus.gyroYaw + flightYaw);
  } else if (bus.scheme === "arc") {
    yaw = clamp(keyYaw + stickYaw + aimYaw * 0.75 + bus.gyroYaw);
    strafe = 0;
  } else {
    yaw = clamp(aimYaw + bus.gyroYaw);
    strafe = clamp(keyYaw + stickYaw);
  }
  if (bus.steerOverride != null) yaw = clamp(bus.steerOverride);
  const throttle = clamp(bus.orbital ? keyThr : keyThr + stickThr);
  const flightPitch = orbitalFlightStick?.pitch ?? 0;
  const aimPitch = orbitalAim?.pitch ?? -bus.rightY;
  const pitch = clamp(aimPitch + bus.gyroPitch + flightPitch);
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
  if (bus.orbital) {
    const axis = (positive: string, negative: string) => Number(keys.has(positive)) - Number(keys.has(negative));
    const pulse = (key: string) => keys.has(key) && !bus.lastKeys?.has(key);
    const inertial = bus.inertialPulse || pulse("KeyG");
    const missile = bus.missilePulse || pulse("KeyM");
    const countermeasure = bus.countermeasurePulse;
    const aimAssist = bus.aimAssistPulse || pulse("KeyH");
    bus.inertialPulse = false;
    bus.missilePulse = false;
    bus.countermeasurePulse = false;
    bus.aimAssistPulse = false;
    const controls = {
      throttle, yaw,
      strafe: clamp(axis("KeyZ", "KeyX") + (bus.leftStickFlight ? bus.strafePulse : -bus.leftX)),
      pitch: clamp(pitch + axis("KeyI", "KeyK")),
      roll: clamp((bus.orbital && bus.leftStickFlight ? axis("KeyE", "KeyQ") : axis("KeyQ", "KeyE")) + flightYaw * COORDINATED_BANK),
      vertical: clamp(axis("KeyC", "KeyV") + (bus.leftStickFlight ? bus.verticalPulse : -bus.leftY)),
      fire, lock,
      boost: keys.has("ShiftLeft") || keys.has("ShiftRight"), brake: keys.has("KeyB"),
      drift: keys.has("KeyT"), inertial, missile, countermeasure, aimAssist,
    };
    const result = bus.leftStickFlight
      ? toOrbitalPilotStepInput(controls)
      : toOrbitalStepInput(controls);
    if (!bus.countermeasureEnabled) delete result.countermeasure;
    bus.lastKeys = new Set(keys);
    return result;
  }
  return { throttle, yaw, strafe, pitch, fire, ult, lock, evade, preset };
}
