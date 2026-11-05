import { useEffect, useRef, useState } from "react";
import { stickAxesFromDelta } from "./input";
import {
  CIRCULAR_ROLL_ARM_HOLD_MS,
  CIRCULAR_ROLL_ARM_MAX_MOVEMENT_PX,
  createCircularGestureTracker,
  updateCircularGesture,
  type CircularGestureTracker,
  type RollDirection,
} from "./pilot-circular-gesture";
import {
  EMPTY_DOUBLE_TAP_STATE,
  isQuickStickTap,
  registerStickTap,
  STICK_TAP_MAX_MOVEMENT_PX,
  stickSectorAt,
  type DoubleTapState,
  type ManeuverPulse,
  type StickSector,
} from "./pilot-stick-gestures";

type ActiveTouch = {
  pointerId: number;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  startedAt: number;
  sector: StickSector | null;
  maxMovementPx: number;
  circularMode: boolean;
  circularTracker: CircularGestureTracker | null;
  circularComplete: boolean;
};

type StickFeedback =
  | { kind: "vector"; pulse: ManeuverPulse }
  | { kind: "roll-progress"; progress: number; direction: RollDirection | null; rejected: boolean }
  | { kind: "roll-command"; direction: RollDirection };

type Props = {
  label: string;
  testId: string;
  onAxis: (x: number, y: number) => void;
  onPulse?: (pulse: ManeuverPulse) => void;
  onCircularManeuver?: (direction: -1 | 1) => void;
  size?: "arena" | "rust-disc";
  disabled?: boolean;
  className?: string;
  description?: string;
};

export function PilotFlightStick({ label, testId, onAxis, onPulse, onCircularManeuver, size = "rust-disc", disabled = false, className = "", description }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<ActiveTouch | null>(null);
  const gesture = useRef<DoubleTapState>(EMPTY_DOUBLE_TAP_STATE);
  const axisCallback = useRef(onAxis);
  const pulseCallback = useRef(onPulse);
  const circularCallback = useRef(onCircularManeuver);
  const disabledRef = useRef(disabled);
  const [feedback, setFeedback] = useState<StickFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const circularArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  axisCallback.current = onAxis;
  pulseCallback.current = onPulse;
  circularCallback.current = onCircularManeuver;
  disabledRef.current = disabled;

  const clearCircularArmTimer = () => {
    if (circularArmTimer.current) clearTimeout(circularArmTimer.current);
    circularArmTimer.current = null;
  };
  const clearFeedbackTimer = () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
  };
  const showTemporaryFeedback = (next: StickFeedback, durationMs: number) => {
    clearFeedbackTimer();
    setFeedback(next);
    feedbackTimer.current = setTimeout(() => {
      feedbackTimer.current = null;
      setFeedback(null);
      if (next.kind === "vector" && root.current) delete root.current.dataset.pulse;
    }, durationMs);
  };

  const sendAxis = (x: number, y: number) => {
    if (root.current) {
      root.current.dataset.axisX = x.toFixed(3);
      root.current.dataset.axisY = y.toFixed(3);
    }
    axisCallback.current(x, y);
  };

  const resetVisual = () => {
    clearCircularArmTimer();
    active.current = null;
    gesture.current = EMPTY_DOUBLE_TAP_STATE;
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) {
      delete root.current.dataset.pulse;
      root.current.dataset.recenter = "true";
      delete root.current.dataset.rollGesture;
    }
  };

  useEffect(() => {
    const reset = () => {
      resetVisual();
      clearFeedbackTimer();
      setFeedback(null);
    };
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    window.addEventListener("orientationchange", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("orientationchange", reset);
      document.removeEventListener("visibilitychange", visibility);
      resetVisual();
      clearFeedbackTimer();
    };
  }, []);
  useEffect(() => {
    if (disabled) {
      resetVisual();
      clearFeedbackTimer();
      setFeedback(null);
    }
  }, [disabled]);

  const updateAxis = (clientX: number, clientY: number) => {
    const el = root.current;
    const dot = knob.current;
    const touch = active.current;
    if (!el || !dot || !touch) return;
    const rect = el.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.36);
    const axes = stickAxesFromDelta(clientX - touch.originX, clientY - touch.originY, max);
    delete el.dataset.recenter;
    dot.style.transform = `translate(calc(-50% + ${axes.x * max}px), calc(-50% + ${axes.y * max}px))`;
    sendAxis(axes.x, axes.y);
  };

  const finish = (pointerId: number, cancelled: boolean) => {
    const touch = active.current;
    if (!touch || touch.pointerId !== pointerId) return;
    clearCircularArmTimer();
    active.current = null;
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) root.current.dataset.recenter = "true";
    if (touch.circularMode) {
      gesture.current = { ...gesture.current, pending: null };
      if (root.current) delete root.current.dataset.rollGesture;
      if (!touch.circularComplete) {
        if (cancelled) setFeedback(null);
        else showTemporaryFeedback({ kind: "roll-progress", progress: 0, direction: null, rejected: true }, 420);
      }
      return;
    }
    if (cancelled || !isQuickStickTap(Date.now() - touch.startedAt, touch.maxMovementPx, touch.sector)) {
      gesture.current = { ...gesture.current, pending: null };
      return;
    }
    const result = registerStickTap(gesture.current, touch.sector, Date.now());
    gesture.current = result.state;
    if (!result.pulse) return;
    pulseCallback.current?.(result.pulse);
    if (root.current) root.current.dataset.pulse = result.pulse.axis;
    showTemporaryFeedback({ kind: "vector", pulse: result.pulse }, 520);
  };

  const movementHint = description
    ? `${label} stick. ${description}${onCircularManeuver ? " Hold still briefly, then draw a full circle for a barrel roll." : ""}`
    : onPulse
    ? `${label} stick. Drag to turn and pitch. Double-tap an outer edge for a short vector-thrust pulse.`
    : `${label} stick. Drag to adjust orientation.${onCircularManeuver ? " Hold still briefly, then draw a full circle for a barrel roll." : ""}`;

  const armCircularGesture = (pointerId: number, rect: DOMRect) => {
    if (!circularCallback.current) return;
    clearCircularArmTimer();
    circularArmTimer.current = setTimeout(() => {
      circularArmTimer.current = null;
      const touch = active.current;
      if (!touch || touch.pointerId !== pointerId || touch.maxMovementPx > CIRCULAR_ROLL_ARM_MAX_MOVEMENT_PX) return;
      const maxRadiusPx = Math.min(rect.width, rect.height) * 0.34;
      touch.circularMode = true;
      touch.circularTracker = createCircularGestureTracker(
        touch.originX,
        touch.originY,
        Date.now(),
        Math.max(10, maxRadiusPx * 0.35),
        maxRadiusPx,
      );
      if (root.current) root.current.dataset.rollGesture = "tracking";
      clearFeedbackTimer();
      setFeedback({ kind: "roll-progress", progress: 0, direction: null, rejected: false });
    }, CIRCULAR_ROLL_ARM_HOLD_MS);
  };

  const updateCircular = (touch: ActiveTouch, clientX: number, clientY: number) => {
    if (!touch.circularTracker) return;
    const update = updateCircularGesture(touch.circularTracker, clientX, clientY, Date.now());
    touch.circularTracker = update.tracker;
    if (update.completed) {
      touch.circularComplete = true;
      touch.circularTracker = null;
      if (root.current) root.current.dataset.rollGesture = update.completed;
      circularCallback.current?.(update.completed === "clockwise" ? 1 : -1);
      showTemporaryFeedback({ kind: "roll-command", direction: update.completed }, 720);
      return;
    }
    if (update.rejected && root.current) root.current.dataset.rollGesture = "rejected";
    setFeedback({
      kind: "roll-progress",
      progress: update.progress,
      direction: update.direction,
      rejected: update.rejected,
    });
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label={movementHint}
      data-testid={testId}
      data-axis-x="0.000"
      data-axis-y="0.000"
      className={`pilot-flight-stick relative touch-none rounded-full border border-bone/30 bg-void/25 ${size === "arena" ? "size-28" : "h-24 w-24 sm:h-32 sm:w-32"} ${className}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (disabledRef.current || active.current) return;
        delete event.currentTarget.dataset.recenter;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        active.current = {
          pointerId: event.pointerId,
          originX: event.clientX,
          originY: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          startedAt: Date.now(),
          sector: stickSectorAt(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height),
          maxMovementPx: 0,
          circularMode: false,
          circularTracker: null,
          circularComplete: false,
        };
        sendAxis(0, 0);
        armCircularGesture(event.pointerId, rect);
      }}
      onPointerMove={(event) => {
        const touch = active.current;
        if (!touch || touch.pointerId !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        touch.maxMovementPx = Math.max(
          touch.maxMovementPx,
          Math.hypot(event.clientX - touch.startX, event.clientY - touch.startY),
        );
        if (touch.maxMovementPx > STICK_TAP_MAX_MOVEMENT_PX) {
          gesture.current = { ...gesture.current, pending: null };
        }
        if (touch.circularMode) {
          updateCircular(touch, event.clientX, event.clientY);
          return;
        }
        if (touch.maxMovementPx > CIRCULAR_ROLL_ARM_MAX_MOVEMENT_PX) clearCircularArmTimer();
        updateAxis(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { event.stopPropagation(); finish(event.pointerId, false); }}
      onPointerCancel={(event) => finish(event.pointerId, true)}
      onLostPointerCapture={(event) => finish(event.pointerId, true)}
    >
      <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-bone/12" />
      <div className="absolute left-1/2 top-1/2 h-full w-px -translate-y-1/2 bg-bone/12" />
      <div ref={knob} className="pilot-flight-stick-knob absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone/70 bg-bone/15 sm:size-12" />
      {feedback?.kind === "roll-progress" ? (
        <>
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={feedback.rejected ? "#ff705b" : "#e6a755"}
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100 100"
              strokeDashoffset={100 - feedback.progress * 100}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-void/80 px-1.5 py-1 font-mono text-[7px] tracking-wider text-solar" role="status" data-testid="roll-gesture-status">
            {feedback.rejected
              ? "ROLL RETRY"
              : `${feedback.direction === "clockwise" ? "ROLL CW" : feedback.direction === "counterclockwise" ? "ROLL CCW" : "DRAW ROLL"} ${Math.round(feedback.progress * 100)}%`}
          </span>
        </>
      ) : null}
      {feedback?.kind === "roll-command" ? (
        <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap" role="status" data-testid="roll-gesture-status">
          {feedback.direction === "clockwise" ? "ROLL RIGHT" : "ROLL LEFT"}
        </span>
      ) : null}
      {feedback?.kind === "vector" ? (
        <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap" role="status">
          {feedback.pulse.axis === "vertical" ? (feedback.pulse.direction > 0 ? "UP THRUST" : "DOWN THRUST") : (feedback.pulse.direction < 0 ? "LEFT VECTOR" : "RIGHT VECTOR")}
        </span>
      ) : null}
    </div>
  );
}
