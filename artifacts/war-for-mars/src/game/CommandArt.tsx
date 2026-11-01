import type { Faction } from "./ships";

/** Resolve a public asset against the deployed base path. */
export const art = (name: string) => `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}lovart/${name}`;

/** Single-light orbital hangar scenery with readable scrims. Decorative only. */
export function CommandBackdrop({ dense = false }: { dense?: boolean }) {
  return (
    <div aria-hidden="true" className="wfm-backdrop pointer-events-none absolute inset-0 overflow-hidden">
      <picture>
        <source media="(orientation: portrait)" srcSet={art("orbital-hangar-mobile.webp")} />
        <img src={art("orbital-hangar.webp")} alt="" className="wfm-backdrop-img h-full w-full object-cover" decoding="async" />
      </picture>
      <div className={dense ? "wfm-scrim wfm-scrim-dense absolute inset-0" : "wfm-scrim absolute inset-0"} />
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <img src={art("wordmark.webp")} alt="" className={`select-none ${className}`} decoding="async" />;
}

export function FactionMark({ faction, className = "h-9 w-9" }: { faction: Faction; className?: string }) {
  return (
    <img
      src={art(faction === "accord" ? "accord-insignia.webp" : "ussf-insignia.webp")}
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
      decoding="async"
    />
  );
}

/** Chamfered panel heading: amber tick, tracked label. */
export function PanelLabel({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2 font-hud text-xs tracking-[0.2em] text-solar">
      <span aria-hidden="true" className="h-3 w-[3px] bg-solar" />
      {children}
    </p>
  );
}
