import type { Faction, ShipId } from "./ships";

type Props = {
  shipId: ShipId;
  faction: Faction;
  onDock: () => void;
  onAbort: () => void;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Routes the retired approach link into the native Orbital Cinder flight scene. */
export function CinderRingDockingApproach({ onAbort }: Props) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#080b12] px-6 py-12 text-[#e8e3d8]" data-testid="screen-orbital-cinder-route">
      <p className="font-mono text-xs tracking-[0.25em] text-[#e0a15a]">ORBITAL NATIVE ROUTE</p>
      <h1 className="font-hud text-4xl">CINDER RING APPROACH</h1>
      <p className="max-w-xl text-center text-sm text-white/65">
        The separate legacy approach scene is retired. Continue into the shared Orbital flight session for the current native station approach.
      </p>
      <a
        className="min-h-12 bg-[#e0a15a] px-6 py-3 font-hud text-[#080b12]"
        href={`${basePath}/combat-lab.html?universe=1&destination=cinder-ring`}
      >
        ENTER ORBITAL CINDER FLIGHT
      </a>
      <button className="min-h-11 border border-white/25 px-5 py-2" type="button" onClick={onAbort}>RETURN</button>
    </main>
  );
}

