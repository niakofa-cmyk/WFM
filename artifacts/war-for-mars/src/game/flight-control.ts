import type { FlightInput as SectorFlightInput } from "./flight-sector";
import type { StepInput } from "./sim";
import type { TacticalManeuverIntentV1 } from "@workspace/orbital-sim";

/**
 * Mode-neutral pilot intent. Physics/runtime adapters are responsible for
 * translating this frame without changing the source mode's authority rules.
 */
export type FlightControlFrame = {
  throttle: number;
  yaw: number;
  strafe: number;
  pitch: number;
  roll: number;
  vertical: number;
  fire: boolean;
  lock: boolean;
  missile: boolean;
  countermeasure: boolean;
  boost: boolean;
  brake: boolean;
  drift: boolean;
  inertial: boolean;
  aimAssist: boolean;
  maneuver?: TacticalManeuverIntentV1;
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
    throttle: axis(value.throttle),
    yaw: axis(value.yaw),
    strafe: axis(value.strafe),
    pitch: axis(value.pitch),
    roll: axis(value.roll),
    vertical: axis(value.vertical),
    fire: value.fire === true,
    lock: value.lock === true,
    missile: value.missile === true,
    countermeasure: value.countermeasure === true,
    boost: value.boost === true,
    brake: value.brake === true,
    drift: value.drift === true,
    inertial: value.inertial === true,
    aimAssist: value.aimAssist === true,
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

/** Adapt common pilot intent to the existing server-authoritative sector API. */
export function toSectorFlightInput(value: Partial<FlightControlFrame>): SectorFlightInput {
  const input = normalizeFlightControls(value);
  return {
    throttle: Math.max(0, input.throttle),
    pitch: input.pitch,
    yaw: input.yaw,
    roll: input.roll,
    strafe: input.strafe,
    vertical: input.vertical,
    boost: input.boost,
    brake: input.brake || input.throttle < 0,
    fire: input.fire,
    lock: input.lock,
    missile: input.missile,
    countermeasure: input.countermeasure,
    ...(input.drift ? { drift: true } : {}),
  };
}

/** Adapt common pilot intent to the canonical deterministic orbital engine. */
export function toOrbitalStepInput(value: Partial<FlightControlFrame>): StepInput {
  const input = normalizeFlightControls(value);
  return {
    throttle: input.throttle,
    yaw: input.yaw,
    strafe: input.strafe,
    pitch: input.pitch,
    roll: input.roll,
    vertical: input.vertical,
    fire: input.fire,
    ult: false,
    lock: input.lock,
    evade: 0,
    preset: null,
    boost: input.boost,
    brake: input.brake,
    drift: input.drift,
    inertial: input.inertial,
    missile: input.missile,
    countermeasure: input.countermeasure,
    aimAssist: input.aimAssist,
    ...(input.maneuver ? { maneuver: input.maneuver } : {}),
  };
}

/**
 * Converts the Rust Disc pilot-facing axis convention into the Orbital
 * integrator's established simulation signs. Use only for the unified flight
 * stick; legacy orbital-control callers retain `toOrbitalStepInput`.
 */
export function toOrbitalPilotStepInput(value: Partial<FlightControlFrame>): StepInput {
  const input = normalizeFlightControls(value);
  return toOrbitalStepInput({
    ...input,
    yaw: -input.yaw,
    strafe: -input.strafe,
    roll: -input.roll,
  });
}
