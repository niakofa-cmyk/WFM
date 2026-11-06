import { forwardRef, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import "./combat-lab.css";

export type PilotActionIcon =
  | "aim"
  | "fire"
  | "missile"
  | "thrust"
  | "boost"
  | "brake"
  | "roll-left"
  | "roll-right"
  | "drift"
  | "assist"
  | "map"
  | "pause"
  | "maneuver"
  | "camera"
  | "flare";

const ICON_PATH: Record<PilotActionIcon, ReactNode> = {
  aim: <><circle cx="12" cy="12" r="7" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /><circle cx="12" cy="12" r="1.5" /></>,
  fire: <><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /><path d="M7 7l3 3m4 4 3 3m0-10-3 3m-4 4-3 3" /><circle cx="12" cy="12" r="2.5" /></>,
  missile: <><path d="M14 4c3-2 5-2 6-2 0 2 0 4-2 7l-7 7-4-4z" /><path d="m7 12-4 1-1 5 5-1m5 1-1 4 4-1 2-4" /><circle cx="16" cy="6" r="1" /></>,
  thrust: <><path d="M12 21V5m-7 7 7-7 7 7" /><path d="M7 18h10" /></>,
  boost: <><path d="m5 18 6-6-6-6M13 18l6-6-6-6" /></>,
  brake: <><path d="M7 3h10l4 4v10l-4 4H7l-4-4V7z" /><path d="M8 8l8 8m0-8-8 8" /></>,
  "roll-left": <><path d="M7 5H3v4" /><path d="M4 9a8 8 0 1 0 2-5" /><path d="m7 5-3 4" /></>,
  "roll-right": <><path d="M17 5h4v4" /><path d="M20 9a8 8 0 1 1-2-5" /><path d="m17 5 3 4" /></>,
  drift: <><path d="M3 8h12a3 3 0 1 0-3-3" /><path d="M3 16h16a2 2 0 1 1-2 2" /><path d="M3 12h7" /></>,
  assist: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3" /><circle cx="12" cy="12" r="6" /><path d="m9 12 2 2 4-4" /></>,
  map: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /><path d="m12 12 5-5" /><circle cx="12" cy="12" r="1.5" /></>,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  maneuver: <><path d="M4 18V6h8a5 5 0 0 1 0 10H8" /><path d="m8 12-4 4 4 4" /></>,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3z" /><circle cx="12" cy="13" r="4" /></>,
  flare: <><path d="M12 2v5m0 10v5M2 12h5m10 0h5" /><path d="m5 5 3 3m8 8 3 3m0-14-3 3m-8 8-3 3" /><circle cx="12" cy="12" r="3" /></>,
};

type PilotActionButtonProps = {
  icon: PilotActionIcon;
  label: string;
  testId: string;
  disabled?: boolean;
  hidden?: boolean;
  active?: boolean;
  accent?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
  onActivate?: () => void;
  badge?: string | number;
  className?: string;
  fireAction?: boolean;
};

export const PilotActionButton = forwardRef<HTMLButtonElement, PilotActionButtonProps>(function PilotActionButton({
  icon,
  label,
  testId,
  disabled = false,
  hidden = false,
  active = false,
  accent = false,
  onPress,
  onRelease,
  onActivate,
  badge,
  className = "",
  fireAction = false,
}, ref) {
  const held = useRef(false);
  const onReleaseRef = useRef(onRelease);
  const [pointerHeld, setPointerHeld] = useState(false);
  onReleaseRef.current = onRelease;
  useEffect(() => () => {
    if (held.current) onReleaseRef.current?.();
  }, []);

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (held.current) {
      held.current = false;
      setPointerHeld(false);
      onRelease?.();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const isActive = active || pointerHeld;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      disabled={disabled}
      hidden={hidden}
      data-testid={testId}
      data-active={isActive ? "true" : "false"}
      data-flight-fire={fireAction ? "" : undefined}
      className={`pilot-action-button ${accent ? "pilot-action-accent" : ""} ${className}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (onPress) {
          held.current = true;
          setPointerHeld(true);
          onPress();
        }
        if (!onPress) onActivate?.();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        if (!held.current) return;
        held.current = false;
        setPointerHeld(false);
        onRelease?.();
      }}
      onClick={(event) => {
        if (event.detail === 0 && !disabled) {
          if (onActivate) onActivate();
          else if (onPress) {
            onPress();
            requestAnimationFrame(() => onRelease?.());
          }
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICON_PATH[icon]}
      </svg>
      {badge !== undefined ? <span className="pilot-action-badge" aria-hidden="true">{badge}</span> : null}
    </button>
  );
});
