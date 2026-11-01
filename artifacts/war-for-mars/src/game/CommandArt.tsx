import type { ReactNode } from "react";
import type { Faction } from "./ships";

/** Resolve a public asset against the deployed base path. */
export const art = (name: string) => `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}lovart/${name}`;

/** Single-light orbital hangar scenery with readable scrims. Decorative only. */
export function CommandBackdrop({ dense = false, faction }: { dense?: boolean; faction?: Faction }) {
  return (
    <div
      aria-hidden="true"
      data-faction={faction}
      className="wfm-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    >
      <picture>
        <source media="(orientation: portrait)" srcSet={art("orbital-hangar-mobile.webp")} width={720} height={938} />
        <img
          src={art("orbital-hangar.webp")}
          alt=""
          width={1440}
          height={555}
          className="wfm-backdrop-img h-full w-full object-cover"
          decoding="async"
        />
      </picture>
      <div className={dense ? "wfm-scrim wfm-scrim-dense absolute inset-0" : "wfm-scrim absolute inset-0"} />
      <div className="wfm-faction-wash absolute inset-0" />
      <div className="wfm-grain absolute inset-0" />
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <img
      src={art("wordmark.webp")}
      alt=""
      width={1040}
      height={106}
      className={`h-auto select-none ${className}`}
      decoding="async"
    />
  );
}

export function FactionMark({ faction, className = "h-9 w-9" }: { faction: Faction; className?: string }) {
  return (
    <img
      src={art(faction === "accord" ? "accord-insignia.webp" : "ussf-insignia.webp")}
      alt=""
      aria-hidden="true"
      width={160}
      height={faction === "accord" ? 167 : 175}
      className={`shrink-0 object-contain ${className}`}
      decoding="async"
    />
  );
}

/** Chamfered panel heading: amber tick, tracked label. */
export function PanelLabel({ children, tone = "solar" }: { children: ReactNode; tone?: "solar" | "spectral" | "muted" }) {
  const color = tone === "spectral" ? "text-spectral" : tone === "muted" ? "text-muted" : "text-solar";
  const bar = tone === "spectral" ? "bg-spectral" : tone === "muted" ? "bg-muted" : "bg-solar";
  return (
    <p className={`flex items-center gap-2 font-hud text-xs tracking-[0.2em] ${color}`}>
      <span aria-hidden="true" className={`h-3 w-[3px] ${bar}`} />
      {children}
    </p>
  );
}

/** Engineered panel surface with corner ticks. */
export function CommandPanel({
  children,
  className = "",
  accent = false,
  ...rest
}: { children: ReactNode; className?: string; accent?: boolean } & Record<`data-${string}`, string>) {
  return (
    <section {...rest} className={`wfm-panel ${accent ? "wfm-panel-accent" : ""} ${className}`}>
      <span aria-hidden="true" className="wfm-tick wfm-tick-tl" />
      <span aria-hidden="true" className="wfm-tick wfm-tick-br" />
      {children}
    </section>
  );
}

const ACCORD_PATH = "M60 6 L72 40 L112 58 L112 66 L72 74 L64 112 L56 112 L48 74 L8 66 L8 58 L48 40 Z";
const USSF_PATH = "M60 4 L70 34 L104 50 L114 78 L70 70 L66 112 L54 112 L50 70 L6 78 L16 50 L50 34 Z";

/**
 * Lightweight top-down tactical silhouette. This is a labelled SCHEMATIC
 * drawn from the faction family, not a model of the flight geometry.
 */
export function ShipSchematic({ faction, role, className = "" }: { faction: Faction; role: string; className?: string }) {
  const stroke = faction === "accord" ? "var(--color-spectral)" : "var(--color-solar)";
  return (
    <figure className={`relative ${className}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`${role} schematic outline`} className="h-full w-full">
        <circle cx="60" cy="60" r="56" fill="none" stroke="var(--color-bone)" strokeOpacity="0.12" strokeDasharray="2 5" />
        <circle cx="60" cy="60" r="36" fill="none" stroke="var(--color-bone)" strokeOpacity="0.08" />
        <line x1="60" y1="0" x2="60" y2="120" stroke="var(--color-bone)" strokeOpacity="0.08" />
        <line x1="0" y1="60" x2="120" y2="60" stroke="var(--color-bone)" strokeOpacity="0.08" />
        <path
          d={faction === "accord" ? ACCORD_PATH : USSF_PATH}
          fill={stroke}
          fillOpacity="0.1"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
        <path d="M60 22 L60 92" stroke={stroke} strokeOpacity="0.6" strokeWidth="1" />
        <rect x="56" y="34" width="8" height="12" fill={stroke} fillOpacity="0.55" />
      </svg>
      <figcaption className="absolute bottom-0 right-0 font-hud text-[10px] tracking-[0.24em] text-muted">SCHEMATIC</figcaption>
    </figure>
  );
}
