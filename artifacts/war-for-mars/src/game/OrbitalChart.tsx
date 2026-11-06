import type { KeyboardEvent } from "react";
import { DESTINATIONS, type Destination } from "./universe-destinations";

type Props = { selected: string; onSelect: (id: string) => void };

export function OrbitalChart({ selected, onSelect }: Props) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = DESTINATIONS[(index + delta + DESTINATIONS.length) % DESTINATIONS.length];
    onSelect(next.id);
    document.getElementById(`node-${next.id}`)?.focus();
  };
  const sel = DESTINATIONS.find((d) => d.id === selected);
  return (
    <div className="uv-chart" role="radiogroup" aria-label="Orbital destinations">
      <svg className="uv-chart__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="50" cy="52" rx="28" ry="20" />
        <ellipse cx="50" cy="52" rx="42" ry="32" />
        <ellipse cx="50" cy="52" rx="48" ry="44" className="uv-chart__outer" />
        {sel && sel.id !== "mars-orbit" ? <line x1="50" y1="52" x2={sel.x} y2={sel.y} className={`uv-chart__vector uv-chart__vector--${sel.status}`} /> : null}
      </svg>
      <div className="uv-chart__belt" aria-hidden="true" />
      <div className="uv-chart__rift" aria-hidden="true" />
      {DESTINATIONS.map((d: Destination, i) => (
        <button
          key={d.id}
          id={`node-${d.id}`}
          type="button"
          role="radio"
          aria-checked={selected === d.id}
          tabIndex={selected === d.id ? 0 : -1}
          data-testid={`button-destination-${d.id}`}
          data-status={d.status}
          className={`uv-node uv-node--${d.id === "mars-orbit" ? "mars" : d.status}`}
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
          onClick={() => onSelect(d.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          <span className="uv-node__mark" aria-hidden="true" />
          <span className="uv-node__label"><b>{d.name}</b><small>{d.status === "planned" ? "PLANNED" : d.kind}</small></span>
        </button>
      ))}
    </div>
  );
}
