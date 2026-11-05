export type RollDirection = "clockwise" | "counterclockwise";

export type CircularGestureTracker = {
  centerX: number;
  centerY: number;
  startedAt: number;
  gestureStartedAt: number | null;
  minRadiusPx: number;
  maxRadiusPx: number;
  lastAngle: number | null;
  sweepRadians: number;
  direction: -1 | 0 | 1;
  minObservedRadiusPx: number;
  maxObservedRadiusPx: number;
  samples: number;
  rejected: boolean;
  completed: boolean;
};

export type CircularGestureUpdate = {
  tracker: CircularGestureTracker;
  progress: number;
  direction: RollDirection | null;
  completed: RollDirection | null;
  rejected: boolean;
};

export const CIRCULAR_ROLL_MIN_SWEEP_RADIANS = Math.PI * 1.85;
export const CIRCULAR_ROLL_MIN_DURATION_MS = 240;
export const CIRCULAR_ROLL_MAX_DURATION_MS = 10_000;
export const CIRCULAR_ROLL_MIN_SAMPLES = 6;
const MAX_SAMPLE_ANGLE_RADIANS = Math.PI * 0.94;
const MIN_SAMPLE_ANGLE_RADIANS = 0.025;
const DIRECTION_NOISE_RADIANS = 0.28;
const MAX_RADIUS_RATIO = 3.5;

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
    minRadiusPx: valid ? minRadiusPx : 1,
    maxRadiusPx: valid ? maxRadiusPx : 0,
    lastAngle: null,
    sweepRadians: 0,
    direction: 0,
    minObservedRadiusPx: Number.POSITIVE_INFINITY,
    maxObservedRadiusPx: 0,
    samples: 0,
    rejected: !valid,
    completed: false,
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

function result(
  tracker: CircularGestureTracker,
  completed: RollDirection | null = null,
): CircularGestureUpdate {
  return {
    tracker,
    progress: tracker.rejected
      ? 0
      : Math.min(1, Math.abs(tracker.sweepRadians) / CIRCULAR_ROLL_MIN_SWEEP_RADIANS),
    direction: rollDirection(tracker.direction),
    completed,
    rejected: tracker.rejected,
  };
}

/** Tracks a deliberate, near-full circle around the visible stick center. */
export function updateCircularGesture(
  previous: CircularGestureTracker,
  clientX: number,
  clientY: number,
  at: number,
): CircularGestureUpdate {
  if (previous.rejected || previous.completed) return result(previous);
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
  if (observedMax / observedMin > MAX_RADIUS_RATIO) {
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
  const direction: -1 | 0 | 1 = previous.direction || (
    Math.abs(delta) >= MIN_SAMPLE_ANGLE_RADIANS
      ? (delta > 0 ? 1 : -1)
      : 0
  );
  if (
    previous.direction !== 0 &&
    Math.abs(delta) > DIRECTION_NOISE_RADIANS &&
    Math.sign(delta) !== previous.direction
  ) {
    return result({ ...previous, rejected: true });
  }
  const acceptedDelta = Math.abs(delta) < MIN_SAMPLE_ANGLE_RADIANS ||
      (previous.direction !== 0 && Math.sign(delta) !== previous.direction)
    ? 0
    : delta;
  const tracker = {
    ...previous,
    gestureStartedAt: previous.gestureStartedAt ?? at,
    lastAngle: angle,
    direction,
    sweepRadians: previous.sweepRadians + acceptedDelta,
    minObservedRadiusPx: observedMin,
    maxObservedRadiusPx: observedMax,
    samples: previous.samples + 1,
  };
  const duration = at - (tracker.gestureStartedAt ?? at);
  const complete = duration >= CIRCULAR_ROLL_MIN_DURATION_MS &&
    tracker.samples >= CIRCULAR_ROLL_MIN_SAMPLES &&
    Math.abs(tracker.sweepRadians) >= CIRCULAR_ROLL_MIN_SWEEP_RADIANS;
  if (!complete) return result(tracker);
  const completedDirection = rollDirection(tracker.direction);
  return result({ ...tracker, completed: true }, completedDirection);
}
