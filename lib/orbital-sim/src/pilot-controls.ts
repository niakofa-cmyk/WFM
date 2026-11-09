import type { FlightInput, TacticalManeuverIntentV1 } from "./flight";
import type { SectorFlightInput } from "./sector-flight";

/**
 * Engine-owned pilot intent. Input devices produce this frame; authority
 * adapters decide which fields their versioned protocol supports.
 */
export type FlightControlFrame = {
  throttle: number; yaw: number; strafe: number; pitch: number; roll: number; vertical: number;
  fire: boolean; lock: boolean; missile: boolean; countermeasure: boolean;
  boost: boolean; brake: boolean; drift: boolean; inertial: boolean; aimAssist: boolean;
  maneuver?: TacticalManeuverIntentV1;
};

/** Commands retain optional capabilities so old replay/network paths can omit them. */
export type OrbitalPilotStepInput =
  Pick<FlightControlFrame, "throttle" | "yaw" | "strafe" | "pitch" | "fire" | "lock"> &
  FlightInput & {
  maneuver?: TacticalManeuverIntentV1;
  ult: false;
  evade: 0;
  preset: null;
};

const NEUTRAL: FlightControlFrame = {
  throttle: 0, yaw: 0, strafe: 0, pitch: 0, roll: 0, vertical: 0,
  fire: false, lock: false, missile: false, countermeasure: false,
  boost: false, brake: false, drift: false, inertial: false, aimAssist: false,
};
const axis = (value: number | undefined, min = -1): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(1, value!)) : 0;

export function neutralFlightControls(throttle = 0): FlightControlFrame {
  return { ...NEUTRAL, throttle: axis(throttle) };
}

export function normalizeFlightControls(value: Partial<FlightControlFrame>): FlightControlFrame {
  return {
    throttle: axis(value.throttle), yaw: axis(value.yaw), strafe: axis(value.strafe),
    pitch: axis(value.pitch), roll: axis(value.roll), vertical: axis(value.vertical),
    fire: value.fire === true, lock: value.lock === true,
    missile: value.missile === true, countermeasure: value.countermeasure === true,
    boost: value.boost === true, brake: value.brake === true, drift: value.drift === true,
    inertial: value.inertial === true, aimAssist: value.aimAssist === true,
    ...(value.maneuver?.version === 1 &&
      value.maneuver.kind === "barrel-roll" &&
      (value.maneuver.direction === "left" || value.maneuver.direction === "right")
      ? { maneuver: value.maneuver }
      : value.maneuver?.version === 1 &&
        value.maneuver.kind === "barrel-roll-control" &&
        Number.isFinite(value.maneuver.input)
        ? { maneuver: { ...value.maneuver, input: axis(value.maneuver.input) } }
        : {}),
  };
}

/** Rust Disc pilot signs to Orbital body axes; shared by Arena and sector flight. */
export function pilotAxesToSpatialAxes(value: { yaw?: number; roll?: number; strafe?: number }) {
  return { yaw: -axis(value.yaw), roll: -axis(value.roll), strafe: -axis(value.strafe) };
}

export type RightThumbProfile = { mode: "hybrid" | "aim"; attitudeGain: number; translationGain: number };
export function normalizeRightThumbProfile(value?: Partial<RightThumbProfile>): RightThumbProfile {
  return {
    mode: value?.mode === "aim" ? "aim" : "hybrid",
    attitudeGain: Number.isFinite(value?.attitudeGain) ? Math.max(.2, Math.min(1.25, value!.attitudeGain!)) : 1,
    translationGain: Number.isFinite(value?.translationGain) ? Math.max(0, Math.min(1, value!.translationGain!)) : 1,
  };
}
/** Device-facing intent, converted to spatial signs once by the existing adapter. */
export function rightThumbFlightAxes(x: number, y: number, profile: RightThumbProfile) {
  const clean = normalizeRightThumbProfile(profile);
  const right = axis(x), up = -axis(y);
  const length = Math.max(1, Math.hypot(right, up));
  return {
    yaw: axis(right * clean.attitudeGain),
    pitch: axis(up * clean.attitudeGain),
    strafe: clean.mode === "hybrid" ? right / length * clean.translationGain : 0,
    vertical: clean.mode === "hybrid" ? up / length * clean.translationGain : 0,
  };
}

/**
 * Preserve the existing sector protocol: reverse is braking and tactical
 * maneuver intents are not forwarded. This is not a network capability upgrade.
 */
export function toSectorFlightInput(value: Partial<FlightControlFrame>): SectorFlightInput {
  const input = normalizeFlightControls(value);
  return {
    throttle: Math.max(0, input.throttle), pitch: input.pitch, yaw: input.yaw, roll: input.roll,
    strafe: input.strafe, vertical: input.vertical,
    boost: input.boost, brake: input.brake || input.throttle < 0,
    fire: input.fire, lock: input.lock, missile: input.missile, countermeasure: input.countermeasure,
    ...(input.drift ? { drift: true } : {}),
  };
}

/** Preserve output fields and ordering for existing Orbital replay consumers. */
export function toOrbitalStepInput(value: Partial<FlightControlFrame>): OrbitalPilotStepInput {
  const input = normalizeFlightControls(value);
  return {
    throttle: input.throttle, yaw: input.yaw, strafe: input.strafe,
    pitch: input.pitch, roll: input.roll, vertical: input.vertical,
    fire: input.fire, ult: false, lock: input.lock, evade: 0, preset: null,
    boost: input.boost, brake: input.brake, drift: input.drift,
    inertial: input.inertial, missile: input.missile, countermeasure: input.countermeasure,
    aimAssist: input.aimAssist,
    ...(input.maneuver ? { maneuver: input.maneuver } : {}),
  };
}

export function toOrbitalPilotStepInput(value: Partial<FlightControlFrame>): OrbitalPilotStepInput {
  const input = normalizeFlightControls(value);
  return toOrbitalStepInput({ ...input, ...pilotAxesToSpatialAxes(input) });
}
