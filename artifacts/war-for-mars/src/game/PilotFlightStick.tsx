import { useEffect, useRef, useState } from "react";
import { stickAxesFromDelta } from "./input";
import {
  circularGestureRadiusBounds,
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
  circularCandidateStarted: boolean;
};

type StickFeedback =
  | { kind: "vector"; pulse: ManeuverPulse }
  | { kind: "roll-progress"; progress: number; direction: RollDirection | null; rejected: boolean }
  | { kind: "roll-live"; progress: number; direction: RollDirection }
  | { kind: "roll-release" };

type Props = {
  label: string;
  testId: string;
  onAxis: (x: number, y: number) => void;
  onPulse?: (pulse: ManeuverPulse) => void;
  onCircularRollInput?: (input: number) => void;
  size?: "arena" | "rust-disc";
  disabled?: boolean;
  className?: string;
  description?: string;
};

function pointerTimestampMs(event: PointerEvent) {
  if (!Number.isFinite(event.timeStamp)) return Date.now();
  return event.timeStamp > 1e12 ? event.timeStamp : performance.timeOrigin + event.timeStamp;
}

export function PilotFlightStick({ label, testId, onAxis, onPulse, onCircularRollInput, size = "rust-disc", disabled = false, className = "", description }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const feedbackAnnouncement = useRef<HTMLSpanElement>(null);
  const active = useRef<ActiveTouch | null>(null);
  const gesture = useRef<DoubleTapState>(EMPTY_DOUBLE_TAP_STATE);
  const axisCallback = useRef(onAxis);
  const pulseCallback = useRef(onPulse);
  const circularCallback = useRef(onCircularRollInput);
  const disabledRef = useRef(disabled);
  const [feedback, setFeedback] = useState<StickFeedback | null>(null);
  const rollGestureState = feedback?.kind === "roll-live"
    ? `live-${feedback.direction}`
    : feedback?.kind === "roll-release"
      ? "released"
    : feedback?.kind === "roll-progress"
      ? (feedback.rejected ? "rejected" : "tracking")
      : undefined;
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  axisCallback.current = onAxis;
  pulseCallback.current = onPulse;
  circularCallback.current = onCircularRollInput;
  disabledRef.current = disabled;

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
      if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "";
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
    active.current = null;
    gesture.current = EMPTY_DOUBLE_TAP_STATE;
    circularCallback.current?.(0);
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) {
      delete root.current.dataset.pulse;
      root.current.dataset.recenter = "true";
    }
    if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "";
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
    active.current = null;
    circularCallback.current?.(0);
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) root.current.dataset.recenter = "true";
    if (cancelled) {
      gesture.current = { ...gesture.current, pending: null };
      clearFeedbackTimer();
      setFeedback(null);
      if (root.current) delete root.current.dataset.pulse;
      if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "";
      return;
    }
    if (touch.circularMode) {
      gesture.current = { ...gesture.current, pending: null };
      if (!cancelled) {
        if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "Barrel roll control released";
        showTemporaryFeedback({ kind: "roll-release" }, 650);
      }
      return;
    }
    if (touch.circularCandidateStarted) {
      gesture.current = { ...gesture.current, pending: null };
      clearFeedbackTimer();
      setFeedback(null);
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
    ? `${label} stick. ${description}${onCircularRollInput ? " Draw a circular arc to roll the hull in real time; keep moving to steer, or release to stop." : ""}`
    : onPulse
    ? `${label} stick. Drag to turn and pitch. Double-tap an outer edge for a short vector-thrust pulse.`
    : `${label} stick. Drag to adjust orientation.${onCircularRollInput ? " Draw a circular arc to roll the hull in real time; keep moving to steer, or release to stop." : ""}`;

  const updateCircular = (touch: ActiveTouch, clientX: number, clientY: number, at: number) => {
    if (!touch.circularTracker) return;
    const update = updateCircularGesture(touch.circularTracker, clientX, clientY, at);
    touch.circularTracker = update.tracker;
    if (update.rejected) {
      touch.circularTracker = null;
      circularCallback.current?.(0);
      if (touch.circularCandidateStarted) {
        if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "Roll not recognized. Draw a smooth loop around the control.";
        showTemporaryFeedback({
          kind: "roll-progress",
          progress: update.progress,
          direction: update.direction,
          rejected: true,
        }, 620);
      }
      return;
    }
    if (update.rolling && update.direction) {
      if (!touch.circularMode && feedbackAnnouncement.current) {
        feedbackAnnouncement.current.textContent = "Barrel roll active. Continue moving the thumb to control the roll.";
      }
      touch.circularMode = true;
      if (update.rollInput !== 0) circularCallback.current?.(update.rollInput);
      clearFeedbackTimer();
      setFeedback({ kind: "roll-live", progress: update.progress, direction: update.direction });
      return;
    }
    if (!update.direction || update.progress < 0.04) return;
    if (!touch.circularCandidateStarted && feedbackAnnouncement.current) {
      feedbackAnnouncement.current.textContent = "Draw a circular arc to begin rolling";
    }
    touch.circularCandidateStarted = true;
    clearFeedbackTimer();
    setFeedback({ kind: "roll-progress", progress: update.progress, direction: update.direction, rejected: false });
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label={movementHint}
      data-testid={testId}
      data-roll-gesture={rollGestureState}
      data-axis-x="0.000"
      data-axis-y="0.000"
      className={`pilot-flight-stick relative touch-none rounded-full border border-bone/30 bg-void/25 ${size === "arena" ? "size-28" : "h-24 w-24 sm:h-32 sm:w-32"} ${className}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (disabledRef.current || active.current) return;
        delete event.currentTarget.dataset.recenter;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        const radiusBounds = circularGestureRadiusBounds(rect.width, rect.height);
        const startedAt = pointerTimestampMs(event.nativeEvent);
        active.current = {
          pointerId: event.pointerId,
          originX: event.clientX,
          originY: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          startedAt,
          sector: stickSectorAt(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height),
          maxMovementPx: 0,
          circularMode: false,
          circularTracker: circularCallback.current
            ? createCircularGestureTracker(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
              startedAt,
              radiusBounds.minRadiusPx,
              radiusBounds.maxRadiusPx,
            )
            : null,
          circularCandidateStarted: false,
        };
        sendAxis(0, 0);
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
        if (touch.circularTracker) {
          const nativeEvent = event.nativeEvent;
          const coalesced = typeof nativeEvent.getCoalescedEvents === "function"
            ? nativeEvent.getCoalescedEvents()
            : [];
          for (const sample of coalesced) {
            updateCircular(touch, sample.clientX, sample.clientY, pointerTimestampMs(sample));
            if (!touch.circularTracker) break;
          }
          if (touch.circularTracker) updateCircular(touch, event.clientX, event.clientY, pointerTimestampMs(nativeEvent));
        }
        updateAxis(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { event.stopPropagation(); finish(event.pointerId, false); }}
      onPointerCancel={(event) => finish(event.pointerId, true)}
      onLostPointerCapture={(event) => finish(event.pointerId, true)}
    >
      <span ref={feedbackAnnouncement} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
      <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-bone/12" />
      <div className="absolute left-1/2 top-1/2 h-full w-px -translate-y-1/2 bg-bone/12" />
      <div ref={knob} className="pilot-flight-stick-knob absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone/70 bg-bone/15 sm:size-12" />
      {feedback?.kind === "roll-progress" || feedback?.kind === "roll-live" ? (
        <>
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={feedback.kind === "roll-live" ? "#6ee7b7" : feedback.rejected ? "#ff705b" : "#e6a755"}
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100 100"
              strokeDashoffset={100 - feedback.progress * 100}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-void/80 px-1.5 py-1 font-mono text-[7px] tracking-wider text-solar" role="status" data-testid="roll-gesture-status">
            {feedback.kind === "roll-progress" && feedback.rejected
              ? "ROLL RETRY"
              : feedback.kind === "roll-live"
                ? `${feedback.direction === "clockwise" ? "ROLL RIGHT" : "ROLL LEFT"} · LIVE`
                : `${feedback.direction === "clockwise" ? "ROLL CW" : feedback.direction === "counterclockwise" ? "ROLL CCW" : "DRAW ROLL"} ${Math.round(feedback.progress * 100)}%`}
          </span>
        </>
      ) : null}
      {feedback?.kind === "roll-release" ? (
        <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap text-emerald-300" aria-hidden="true" data-testid="roll-gesture-status">
          ROLL RELEASED
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
