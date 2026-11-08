import type { MutableRefObject } from "react";
import type { FlightInput } from "./flight-sector";
import type {
  IronEclipseCommandRequest,
  SectorCommandRequest,
  SectorEvidencePickup,
  SectorEvidenceRecoveryRequest,
  SectorFactionContact,
  SectorMission,
  SectorPatrolApproach,
  SectorSnapshot,
  SectorTacticalCommand,
  SectorTransponderRequest,
} from "./sector-missions";
import type { ShipId } from "./ships";

export type ExpeditionTransport = {
  snapshotRef: MutableRefObject<SectorSnapshot | null>;
  latencyRef: MutableRefObject<number | null>;
  sendInput: (input: FlightInput) => void;
  sendCommand: (
    command:
      | SectorCommandRequest
      | IronEclipseCommandRequest
      | SectorTransponderRequest
      | SectorEvidenceRecoveryRequest,
  ) => boolean;
  notice: string;
  mission: SectorMission;
  connection: "connected" | "reconnecting" | "lost";
  onExit: () => void;
};

type Props = {
  onExit?: () => void;
  expedition?: ExpeditionTransport;
  expeditionHref?: string;
  shipId?: ShipId;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The legacy Rust Disc presentation is retired pending its Orbital-native rebuild. */
export function RustDiscFlight({ onExit }: Props) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#080b12] px-6 py-12 text-[#e8e3d8]" data-testid="screen-rust-disc-retired">
      <p className="font-mono text-xs tracking-[0.25em] text-[#e0a15a]">ORBITAL-ONLY REBUILD</p>
      <h1 className="font-hud text-4xl">LEGACY SECTOR FLIGHT RETIRED</h1>
      <p className="max-w-xl text-center text-sm text-white/65">
        This renderer no longer starts a mission or joins a multiplayer room. No server operation or reward was created.
      </p>
      <a
        className="min-h-12 bg-[#e0a15a] px-6 py-3 font-hud text-[#080b12]"
        href={`${basePath}/combat-lab.html?universe=1&destination=cinder-ring`}
      >
        ENTER ORBITAL FLIGHT
      </a>
      {onExit ? <button className="min-h-11 border border-white/25 px-5 py-2" type="button" onClick={onExit}>RETURN</button> : null}
    </main>
  );
}

export default RustDiscFlight;

