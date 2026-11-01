import * as React from "react";
import type { ReactNode } from "react";
import { SHIPS, type ShipId } from "./ships";

/**
 * Static, ship-specific top-down HULL ILLUSTRATION (nose up). Drawn from the
 * roster concept plates (Mandjet, Shakuna, Sundara, Tripura) and the existing
 * stylized flight geometry for USSF hulls. Not a flight model or hitbox.
 */
type Art = { body: ReactNode; detail: ReactNode };

const ART: Record<ShipId, Art> = {
  mandjet: {
    body: (
      <>
        <path d="M60 14 L74 34 L80 52 L112 26 L92 62 L112 98 L78 76 L70 100 L50 100 L42 76 L8 98 L28 62 L8 26 L40 52 L46 34 Z" />
      </>
    ),
    detail: (
      <>
        <circle cx="60" cy="60" r="11" />
        <path d="M60 49 L60 71 M49 60 L71 60 M52 52 L68 68 M68 52 L52 68" />
        <path d="M52 100 L52 108 M60 100 L60 110 M68 100 L68 108" />
      </>
    ),
  },
  shakuna: {
    body: (
      <path d="M60 8 L65 40 L76 46 L112 36 L100 52 L108 56 L90 66 L96 72 L68 76 L66 104 L60 112 L54 104 L52 76 L24 72 L30 66 L12 56 L20 52 L8 36 L44 46 L55 40 Z" />
    ),
    detail: (
      <>
        <path d="M70 50 L102 44 M72 58 L96 58 M70 66 L88 70 M50 50 L18 44 M48 58 L24 58 M50 66 L32 70" />
        <path d="M60 22 L60 96" />
        <path d="M56 104 L56 112 M64 104 L64 112" />
      </>
    ),
  },
  sundara: {
    body: <path d="M60 4 L66 30 L70 70 L70 104 L66 112 L54 112 L50 104 L50 70 L54 30 Z" />,
    detail: (
      <>
        <path d="M60 10 L60 104 M54 46 L66 46 M52 76 L68 76" />
        <ellipse cx="60" cy="108" rx="5" ry="3" />
        <path d="M46 88 L50 84 M74 88 L70 84" />
      </>
    ),
  },
  tripura: {
    body: (
      <>
        <path d="M60 10 L80 38 L68 38 L86 62 L70 62 L92 90 L28 90 L50 62 L34 62 L52 38 L40 38 Z" />
      </>
    ),
    detail: (
      <>
        <ellipse cx="60" cy="62" rx="50" ry="14" fill="none" />
        <circle cx="60" cy="102" r="12" fill="none" />
        <path d="M60 90 L60 114 M48 102 L72 102" />
      </>
    ),
  },
  duskbreaker: {
    body: (
      <path d="M60 6 L68 22 L70 50 L98 66 L104 84 L70 82 L72 102 L64 110 L56 110 L48 102 L50 82 L16 84 L22 66 L50 50 L52 22 Z" />
    ),
    detail: (
      <>
        <rect x="55" y="24" width="10" height="16" />
        <path d="M60 40 L60 100 M50 60 L70 60 M30 76 L50 70 M90 76 L70 70" />
        <path d="M56 110 L56 116 M64 110 L64 116" />
      </>
    ),
  },
  sentinel: {
    body: (
      <>
        <rect x="46" y="30" width="28" height="60" />
        <rect x="6" y="48" width="36" height="24" />
        <rect x="78" y="48" width="36" height="24" />
      </>
    ),
    detail: (
      <>
        <path d="M42 60 L46 60 M74 60 L78 60" />
        <path d="M15 48 L15 72 M24 48 L24 72 M33 48 L33 72 M87 48 L87 72 M96 48 L96 72 M105 48 L105 72" />
        <circle cx="60" cy="22" r="7" fill="none" />
        <path d="M60 29 L60 34" />
        <rect x="52" y="90" width="16" height="10" />
      </>
    ),
  },
  splitter: {
    body: (
      <path fillRule="evenodd" d="M60 12 A48 48 0 1 1 59.9 12 Z M60 30 A30 30 0 1 0 60.1 30 Z" />
    ),
    detail: (
      <>
        <path d="M60 12 L60 30 M60 90 L60 108 M12 60 L30 60 M90 60 L108 60" />
        <rect x="24" y="24" width="10" height="10" transform="rotate(45 29 29)" />
        <rect x="86" y="24" width="10" height="10" transform="rotate(45 91 29)" />
        <rect x="24" y="86" width="10" height="10" transform="rotate(45 29 91)" />
        <rect x="86" y="86" width="10" height="10" transform="rotate(45 91 91)" />
        <circle cx="60" cy="60" r="6" />
      </>
    ),
  },
  glide: {
    body: <path d="M60 4 L74 58 L104 104 L72 96 L60 112 L48 96 L16 104 L46 58 Z" />,
    detail: (
      <>
        <path d="M60 14 L60 100 M50 60 L36 96 M70 60 L84 96" />
        <path d="M54 30 L60 20 L66 30 Z" />
      </>
    ),
  },
};

export function ShipIllustration({
  ship,
  className = "",
  caption = true,
  grid = true,
}: {
  ship: ShipId;
  className?: string;
  caption?: boolean;
  grid?: boolean;
}) {
  const def = SHIPS[ship];
  const tone = def.faction === "accord" ? "var(--color-solar)" : "var(--color-spectral)";
  const art = ART[ship];
  return (
    <figure className={`relative ${className}`} data-testid={`img-hull-${ship}`} data-ship-id={ship}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`${def.name} hull illustration`} className="h-full w-full">
        {grid ? (
          <g stroke="var(--color-bone)" fill="none">
            <circle cx="60" cy="60" r="57" strokeOpacity="0.12" strokeDasharray="2 5" />
            <line x1="60" y1="0" x2="60" y2="120" strokeOpacity="0.07" />
            <line x1="0" y1="60" x2="120" y2="60" strokeOpacity="0.07" />
          </g>
        ) : null}
        <g fill={tone} fillOpacity="0.14" stroke={tone} strokeWidth="1.4" strokeLinejoin="miter">
          {art.body}
        </g>
        <g fill={tone} fillOpacity="0.35" stroke={tone} strokeOpacity="0.75" strokeWidth="0.9">
          {art.detail}
        </g>
      </svg>
      {caption ? (
        <figcaption className="absolute bottom-0 right-0 font-hud text-[9px] tracking-[0.24em] text-muted">HULL ILLUSTRATION</figcaption>
      ) : null}
    </figure>
  );
}
