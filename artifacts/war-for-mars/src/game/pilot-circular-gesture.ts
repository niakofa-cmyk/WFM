export type RollDirection = "clockwise" | "counterclockwise";

export type CircularGestureTracker = {
  centerX: number;
  centerY: number;
  startedAt: number;
  gestureStartedAt: number | null;
  lastSampleAt: number | null;
  minRadiusPx: number;
  maxRadiusPx: number;
  lastAngle: number | null;
  sweepRadians: number;
  travelRadians: number;
  direction: -1 | 0 | 1;
  minObservedRadiusPx: number;
  maxObservedRadiusPx: number;
  samples: number;
  rolling: boolean;
  rejected: boolean;
};

export type CircularGestureUpdate = {
  tracker: CircularGestureTracker;
  progress: number;
  direction: RollDirection | null;
  rollInput: number;
  rolling: boolean;
  rejected: boolean;
};

export const CIRCULAR_ROLL_ARM_SWEEP_RADIANS = Math.PI / 3;
export const CIRCULAR_ROLL_MIN_DURATION_MS = 70;
export const CIRCULAR_ROLL_MAX_DURATION_MS = 10_000;
export const CIRCULAR_ROLL_MIN_SAMPLES = 4;
const MAX_SAMPLE_ANGLE_RADIANS = Math.PI * 0.94;
const MIN_SAMPLE_ANGLE_RADIANS = 0.025;
const DIRECTION_NOISE_RADIANS = 0.28;
const MAX_RADIUS_RATIO = 3.5;
const POINTER_ROLL_REFERENCE_RATE = 6.5;

/** Allow a loop over the stick's outer edge without accepting off-screen drags. */
export function circularGestureRadiusBounds(width: number, height: number) {
  const size = Math.min(width, height);
  if (![width, height, size].every(Number.isFinite) || size <= 0) {
    return { minRadiusPx: 8, maxRadiusPx: 48 };
  }
  return {
    minRadiusPx: Math.max(8, size * 0.08),
    maxRadiusPx: Math.max(10, size * 0.68),
  };
}

export function createCircularGestureTracker(
  centerX: number,
  centerY: number,
  startedAt: number,
  minRadiusPx: number,
  maxRadiusPx: number,
): CircularGestureTracker {
  const valid = [centerX, centerY, startedAt, minRadiusPx, maxRadiusPx].every(Number.isFinite) &&
    minRadiusPx > 0 &&
    maxRadiusPx > minRadiusPx;
  return {
    centerX: valid ? centerX : 0,
    centerY: valid ? centerY : 0,
    startedAt: valid ? startedAt : 0,
    gestureStartedAt: null,
    lastSampleAt: null,
    minRadiusPx: valid ? minRadiusPx : 1,
    maxRadiusPx: valid ? maxRadiusPx : 0,
    lastAngle: null,
    sweepRadians: 0,
    travelRadians: 0,
    direction: 0,
    minObservedRadiusPx: Number.POSITIVE_INFINITY,
    maxObservedRadiusPx: 0,
    samples: 0,
    rolling: false,
    rejected: !valid,
  };
}

function wrapAngle(angle: number) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function rollDirection(direction: -1 | 0 | 1): RollDirection | null {
  return direction > 0 ? "clockwise" : direction < 0 ? "counterclockwise" : null;
}

function result(tracker: CircularGestureTracker, rollInput = 0): CircularGestureUpdate {
  return {
    tracker,
    progress: tracker.rejected
      ? 0
      : Math.min(1, tracker.travelRadians / (Math.PI * 2)),
    direction: rollDirection(tracker.direction),
    rollInput,
    rolling: tracker.rolling,
    rejected: tracker.rejected,
  };
}

/** Converts a circular thumb path into live roll input after a deliberate arc. */
export function updateCircularGesture(
  previous: CircularGestureTracker,
  clientX: number,
  clientY: number,
  at: number,
): CircularGestureUpdate {
  if (previous.rejected) return result(previous);
  if (![clientX, clientY, at].every(Number.isFinite) || at < previous.startedAt) {
    return result({ ...previous, rejected: true });
  }
  if (
    previous.gestureStartedAt !== null &&
    at - previous.gestureStartedAt > CIRCULAR_ROLL_MAX_DURATION_MS
  ) {
    return result({ ...previous, rejected: true });
  }

  const dx = clientX - previous.centerX;
  const dy = clientY - previous.centerY;
  const radius = Math.hypot(dx, dy);
  if (!Number.isFinite(radius) || radius > previous.maxRadiusPx) {
    return result({ ...previous, rejected: true });
  }
  if (radius < previous.minRadiusPx) return result(previous);

  const angle = Math.atan2(dy, dx);
  const minObservedRadiusPx = Math.min(previous.minObservedRadiusPx, radius);
  const maxObservedRadiusPx = Math.max(previous.maxObservedRadiusPx, radius);
  let observedMin = minObservedRadiusPx;
  let observedMax = maxObservedRadiusPx;
  if (!previous.rolling && observedMax / observedMin > MAX_RADIUS_RATIO) {
    // A pilot may begin near the center, then settle the thumb onto a wider
    // circle. Rebase early radial movement instead of rejecting the loop.
    if (Math.abs(previous.sweepRadians) < Math.PI / 2) {
      observedMin = radius;
      observedMax = radius;
    } else {
      return result({ ...previous, rejected: true });
    }
  }

  if (previous.lastAngle === null) {
    return result({
      ...previous,
      gestureStartedAt: previous.gestureStartedAt ?? at,
      lastSampleAt: at,
      lastAngle: angle,
      minObservedRadiusPx: observedMin,
      maxObservedRadiusPx: observedMax,
      samples: previous.samples + 1,
    });
  }

  const delta = wrapAngle(angle - previous.lastAngle);
  if (Math.abs(delta) > MAX_SAMPLE_ANGLE_RADIANS) {
    return result({ ...previous, rejected: true });
  }
  if (
    previous.direction !== 0 &&
    !previous.rolling &&
    Math.abs(delta) > DIRECTION_NOISE_RADIANS &&
    Math.sign(delta) !== previous.direction
  ) {
    return result({ ...previous, rejected: true });
  }
  const acceptedDelta = Math.abs(delta) < MIN_SAMPLE_ANGLE_RADIANS ||
      (!previous.rolling && previous.direction !== 0 && Math.sign(delta) !== previous.direction)
    ? 0
    : delta;
  const direction = Math.abs(acceptedDelta) >= MIN_SAMPLE_ANGLE_RADIANS
    ? (acceptedDelta > 0 ? 1 : -1) as -1 | 1
    : previous.direction;
  const tracker: CircularGestureTracker = {
    ...previous,
    gestureStartedAt: previous.gestureStartedAt ?? at,
    lastSampleAt: at,
    lastAngle: angle,
    direction,
    sweepRadians: previous.sweepRadians + acceptedDelta,
    travelRadians: previous.travelRadians + Math.abs(acceptedDelta),
    minObservedRadiusPx: observedMin,
    maxObservedRadiusPx: observedMax,
    samples: previous.samples + 1,
  };
  tracker.rolling = previous.rolling || (
    Math.abs(tracker.sweepRadians) >= CIRCULAR_ROLL_ARM_SWEEP_RADIANS &&
    tracker.samples >= CIRCULAR_ROLL_MIN_SAMPLES &&
    at - (tracker.gestureStartedAt ?? at) >= CIRCULAR_ROLL_MIN_DURATION_MS
  );
  const sampleSeconds = previous.lastSampleAt === null
    ? 0
    : Math.max(1 / 120, (at - previous.lastSampleAt) / 1000);
  const rollInput = tracker.rolling && acceptedDelta !== 0
    ? Math.max(-1, Math.min(1, acceptedDelta / sampleSeconds / POINTER_ROLL_REFERENCE_RATE))
    : 0;
  return result(tracker, rollInput);
}
