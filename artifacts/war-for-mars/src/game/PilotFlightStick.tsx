import React, { useEffect, useRef, useState } from "react";
import { stickAxesFromDelta } from "./input";
import { boostDirectionAt, completedBoostDirection, registerBoostGesture, type BoostGestureState } from "./right-thumb-controls";
import type { VectorBoostDirection } from "@workspace/orbital-sim";
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
  boostDirection: VectorBoostDirection | null;
  boostRadius: number;
};

type StickFeedback =
  | { kind: "boost"; direction: VectorBoostDirection; requested: boolean }
  | { kind: "vector"; pulse: ManeuverPulse }
  | { kind: "roll-progress"; progress: number; direction: RollDirection | null; rejected: boolean }
  | { kind: "roll-live"; progress: number; direction: RollDirection }
  | { kind: "roll-release" };

type Props = {
  label: string;
  testId: string;
  onAxis: (x: number, y: number) => void;
  onPulse?: (pulse: ManeuverPulse) => void;
  onVectorBoost?: (direction: VectorBoostDirection) => boolean;
  boostStatus?: string;
  onCircularRollInput?: (input: number) => void;
  size?: "arena" | "rust-disc";
  disabled?: boolean;
  /** Expand an Orbital thumb control over one screen half; its ring follows the active touch. */
  floatingSide?: "left" | "right";
  /** Changing a profile invalidates any pending gesture and captured axes. */
  interactionKey?: string;
  className?: string;
  description?: string;
};

function pointerTimestampMs(event: PointerEvent) {
  if (!Number.isFinite(event.timeStamp)) return Date.now();
  return event.timeStamp > 1e12 ? event.timeStamp : performance.timeOrigin + event.timeStamp;
}

export function PilotFlightStick({ label, testId, onAxis, onPulse, onVectorBoost, boostStatus, onCircularRollInput, size = "rust-disc", disabled = false, floatingSide, interactionKey, className = "", description }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const feedbackAnnouncement = useRef<HTMLSpanElement>(null);
  const active = useRef<ActiveTouch | null>(null);
  const gesture = useRef<DoubleTapState>(EMPTY_DOUBLE_TAP_STATE);
  const boostGesture = useRef<BoostGestureState>({ direction: null, at: 0, cooldownUntil: 0 });
  const boostCallback = useRef(onVectorBoost);
  boostCallback.current = onVectorBoost;
  const axisCallback = useRef(onAxis);
  const pulseCallback = useRef(onPulse);
  const circularCallback = useRef(onCircularRollInput);
  const disabledRef = useRef(disabled);
  const floating = floatingSide !== undefined;
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
    const pointerId = active.current?.pointerId;
    boostGesture.current.direction = null;
    active.current = null;
    if (pointerId !== undefined && root.current?.hasPointerCapture(pointerId)) {
      root.current.releasePointerCapture(pointerId);
    }
    gesture.current = EMPTY_DOUBLE_TAP_STATE;
    circularCallback.current?.(0);
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) {
      delete root.current.dataset.pulse;
      root.current.dataset.recenter = "true";
      root.current.dataset.active = "false";
    }
    if (visual.current && floating) {
      visual.current.style.left = "";
      visual.current.style.top = "";
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
    resetVisual();
    clearFeedbackTimer();
    setFeedback(null);
  }, [disabled, interactionKey]);

  const updateAxis = (clientX: number, clientY: number) => {
    const el = root.current;
    const dot = knob.current;
    const touch = active.current;
    if (!el || !dot || !touch) return;
    const rect = el.getBoundingClientRect();
    const max = Math.max(1, floating ? 36 : rect.width * 0.36);
    const axes = stickAxesFromDelta(clientX - touch.originX, clientY - touch.originY, max);
    delete el.dataset.recenter;
    dot.style.transform = `translate(calc(-50% + ${axes.x * max}px), calc(-50% + ${axes.y * max}px))`;
    sendAxis(axes.x, axes.y);
  };

  const finish = (pointerId: number, cancelled: boolean, at: number, clientX: number, clientY: number) => {
    const touch = active.current;
    if (!touch || touch.pointerId !== pointerId) return;
    active.current = null;
    circularCallback.current?.(0);
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) {
      root.current.dataset.recenter = "true";
      root.current.dataset.active = "false";
    }
    if (cancelled) {
      boostGesture.current.direction = null;
      gesture.current = { ...gesture.current, pending: null };
      clearFeedbackTimer();
      setFeedback(null);
      if (root.current) delete root.current.dataset.pulse;
      if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "";
      return;
    }
    if (touch.circularMode) {
      boostGesture.current.direction = null;
      gesture.current = { ...gesture.current, pending: null };
      if (!cancelled) {
        if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent = "Barrel roll control released";
        showTemporaryFeedback({ kind: "roll-release" }, 650);
      }
      return;
    }
    if (touch.circularCandidateStarted) {
      boostGesture.current.direction = null;
      gesture.current = { ...gesture.current, pending: null };
      clearFeedbackTimer();
      setFeedback(null);
      return;
    }
    if (boostCallback.current) {
      const endX = clientX - touch.startX;
      const endY = clientY - touch.startY;
      const direction = completedBoostDirection({
        durationMs: at - touch.startedAt,
        movementPx: Math.max(touch.maxMovementPx, Math.hypot(endX, endY)),
        endX, endY, radiusPx: touch.boostRadius, edgeDirection: touch.boostDirection,
      });
      const result = registerBoostGesture(boostGesture.current, direction, at);
      boostGesture.current = result.state;
      if (result.boost) {
        const requested = boostCallback.current(result.boost);
        if (feedbackAnnouncement.current) feedbackAnnouncement.current.textContent =
          requested ? `${result.boost} directional boost requested` : "Directional boost unavailable or recovering";
        showTemporaryFeedback({ kind: "boost", direction: result.boost, requested }, 650);
      }
      return;
    }
    if (cancelled || !isQuickStickTap(at - touch.startedAt, touch.maxMovementPx, touch.sector)) {
      gesture.current = { ...gesture.current, pending: null };
      return;
    }
    const result = registerStickTap(gesture.current, touch.sector, at);
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
      setFeedback({ kind: "roll-live", progress: 0, direction: update.direction });
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
      data-active="false"
      data-floating-side={floatingSide}
      className={`pilot-flight-stick relative touch-none ${floating
        ? "pilot-flight-stick-zone"
        : `rounded-full border border-bone/30 bg-void/25 ${size === "arena" ? "size-28" : "h-24 w-24 sm:h-32 sm:w-32"} ${className}`}`}
      style={floating ? {
        position: "fixed",
        top: 0,
        bottom: 0,
        [floatingSide === "left" ? "left" : "right"]: 0,
        width: "50vw",
        height: "100dvh",
        zIndex: 1,
      } : undefined}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (disabledRef.current || active.current) return;
        if ((event.target as HTMLElement).closest("button,input,select,textarea,[role=dialog]")) return;
        delete event.currentTarget.dataset.recenter;
        const rect = event.currentTarget.getBoundingClientRect();
        if (floating && visual.current) {
          const ringSize = 84;
          const localX = Math.max(ringSize / 2, Math.min(rect.width - ringSize / 2, event.clientX - rect.left));
          const localY = Math.max(ringSize / 2, Math.min(rect.height - ringSize / 2, event.clientY - rect.top));
          visual.current.style.left = `${localX}px`;
          visual.current.style.top = `${localY}px`;
          event.currentTarget.dataset.active = "true";
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        const gestureSize = floating ? 84 : rect.width;
        const radiusBounds = circularGestureRadiusBounds(gestureSize, floating ? gestureSize : rect.height);
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
              floating ? event.clientX : rect.left + rect.width / 2,
              floating ? event.clientY : rect.top + rect.height / 2,
              startedAt,
              radiusBounds.minRadiusPx,
              radiusBounds.maxRadiusPx,
            )
            : null,
          circularCandidateStarted: false,
          boostRadius: floating ? 42 : Math.min(rect.width, rect.height) * .3,
          boostDirection: boostDirectionAt(
            (event.clientX - rect.left - rect.width / 2) / (rect.width / 2),
            (event.clientY - rect.top - rect.height / 2) / (rect.height / 2),
          ),
        };
        sendAxis(0, 0);
      }}
      onPointerMove={(event) => {
        const touch = active.current;
        if (!touch || touch.pointerId !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const displacement = Math.hypot(event.clientX - touch.startX, event.clientY - touch.startY);
        touch.maxMovementPx = Math.max(touch.maxMovementPx, displacement);
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
        // Once the circular gesture is armed, keep the input dedicated to the
        // hull roll. Letting the same loop also steer pitch/yaw obscures the
        // roll and can make a left roll look like a camera turn.
        if (touch.circularMode) sendAxis(0, 0);
        else updateAxis(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { event.stopPropagation(); finish(event.pointerId, false, pointerTimestampMs(event.nativeEvent), event.clientX, event.clientY); }}
      onPointerCancel={(event) => finish(event.pointerId, true, pointerTimestampMs(event.nativeEvent), event.clientX, event.clientY)}
      onLostPointerCapture={(event) => finish(event.pointerId, true, pointerTimestampMs(event.nativeEvent), event.clientX, event.clientY)}
    >
      <span ref={feedbackAnnouncement} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
      <div ref={visual} className={`pilot-flight-stick-visual ${floating ? "" : "pilot-flight-stick-visual-static"}`}>
        <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-bone/12" />
        <div className="absolute left-1/2 top-1/2 h-full w-px -translate-y-1/2 bg-bone/12" />
        <div ref={knob} className="pilot-flight-stick-knob absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone/70 bg-bone/15 sm:size-12" />
        {feedback?.kind === "roll-progress" || feedback?.kind === "roll-live" ? (
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-void/85 px-1.5 py-1 font-mono text-[7px] tracking-wider text-solar" role="status" data-testid="roll-gesture-status">
            {feedback.kind === "roll-progress" && feedback.rejected
              ? "ROLL RETRY"
              : feedback.kind === "roll-live"
                ? `${feedback.direction === "clockwise" ? "ROLL RIGHT" : "ROLL LEFT"} · LIVE`
                : `${feedback.direction === "clockwise" ? "ROLL RIGHT · DRAW" : feedback.direction === "counterclockwise" ? "ROLL LEFT · DRAW" : "DRAW ROLL"}`}
          </span>
        ) : null}
        {feedback?.kind === "roll-release" ? (
          <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap text-emerald-300" aria-hidden="true" data-testid="roll-gesture-status">
            ROLL RELEASED
          </span>
        ) : null}
        {boostStatus ? (
          <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 bottom-0 z-20 -translate-x-1/2 whitespace-nowrap" role="status" data-testid="vector-boost-server-status">{boostStatus}</span>
        ) : null}
        {feedback?.kind === "boost" ? (
          <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap" role="status" data-testid="vector-boost-gesture-status">
            {feedback.requested ? `${feedback.direction.toUpperCase()} BURST` : "BURST UNAVAILABLE"}
          </span>
        ) : null}
        {feedback?.kind === "vector" ? (
          <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap" role="status">
            {feedback.pulse.axis === "vertical" ? (feedback.pulse.direction > 0 ? "UP THRUST" : "DOWN THRUST") : (feedback.pulse.direction < 0 ? "LEFT VECTOR" : "RIGHT VECTOR")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
