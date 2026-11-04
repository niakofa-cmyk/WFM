import { useEffect, useRef, useState } from "react";
import { stickAxesFromDelta } from "./input";
import {
  EMPTY_DOUBLE_TAP_STATE,
  isQuickStickTap,
  registerStickTap,
  STICK_TAP_MAX_DURATION_MS,
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
};

type Props = {
  label: string;
  testId: string;
  onAxis: (x: number, y: number) => void;
  onPulse?: (pulse: ManeuverPulse) => void;
  size?: "arena" | "rust-disc";
  disabled?: boolean;
  className?: string;
};

export function PilotFlightStick({ label, testId, onAxis, onPulse, size = "rust-disc", disabled = false, className = "" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<ActiveTouch | null>(null);
  const gesture = useRef<DoubleTapState>(EMPTY_DOUBLE_TAP_STATE);
  const axisCallback = useRef(onAxis);
  const pulseCallback = useRef(onPulse);
  const disabledRef = useRef(disabled);
  const [feedback, setFeedback] = useState<ManeuverPulse | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  axisCallback.current = onAxis;
  pulseCallback.current = onPulse;
  disabledRef.current = disabled;

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
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) {
      delete root.current.dataset.pulse;
      root.current.dataset.recenter = "true";
    }
  };

  useEffect(() => {
    const reset = () => resetVisual();
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    window.addEventListener("orientationchange", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("orientationchange", reset);
      document.removeEventListener("visibilitychange", visibility);
      reset();
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);
  useEffect(() => {
    if (disabled) resetVisual();
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
    sendAxis(0, 0);
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    if (root.current) root.current.dataset.recenter = "true";
    if (cancelled || !isQuickStickTap(Date.now() - touch.startedAt, touch.maxMovementPx, touch.sector)) {
      gesture.current = { ...gesture.current, pending: null };
      return;
    }
    const result = registerStickTap(gesture.current, touch.sector, Date.now());
    gesture.current = result.state;
    if (!result.pulse) return;
    pulseCallback.current?.(result.pulse);
    if (root.current) root.current.dataset.pulse = result.pulse.axis;
    setFeedback(result.pulse);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      if (root.current) delete root.current.dataset.pulse;
    }, 520);
  };

  const movementHint = onPulse
    ? `${label} stick. Drag to turn and pitch. Double-tap an outer edge for a short vector-thrust pulse.`
    : `${label} stick. Drag to adjust orientation.`;

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
        updateAxis(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { event.stopPropagation(); finish(event.pointerId, false); }}
      onPointerCancel={(event) => finish(event.pointerId, true)}
      onLostPointerCapture={(event) => finish(event.pointerId, true)}
    >
      <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-bone/12" />
      <div className="absolute left-1/2 top-1/2 h-full w-px -translate-y-1/2 bg-bone/12" />
      <div ref={knob} className="pilot-flight-stick-knob absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone/70 bg-bone/15 sm:size-12" />
      {feedback ? (
        <span className="pilot-stick-feedback pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap" role="status">
          {feedback.axis === "vertical" ? (feedback.direction > 0 ? "UP THRUST" : "DOWN THRUST") : (feedback.direction < 0 ? "LEFT VECTOR" : "RIGHT VECTOR")}
        </span>
      ) : null}
    </div>
  );
}
