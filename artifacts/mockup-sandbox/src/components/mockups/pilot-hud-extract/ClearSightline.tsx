import "./_group.css";
import { UniversePatrolEncounterPrompt } from "./UniversePatrolEncounterPromptCompact";

export function ClearSightline() {
  return (
    <main className="wfm-flight-preview">
      <div className="wfm-starfield" aria-hidden="true" />
      <div className="wfm-mars" aria-hidden="true" />
      <div className="wfm-player-ship" aria-hidden="true" />
      <div className="wfm-reticle" aria-hidden="true" />
      <div className="wfm-compact-dock">CINDER RING · 44 M · ALIGN</div>
      <div className="absolute left-3 top-3 z-10 font-hud text-[10px] tracking-widest text-bone">
        TRIPURA<br /><span className="text-muted">0 M/S · SHD 100 · HULL 100</span>
      </div>
      <UniversePatrolEncounterPrompt
        contact={{
          callsign: "ACCORD PATROL · SEKHMET",
          faction: "accord",
          shipId: "sekhmet",
          shipCount: 3,
          distanceMeters: 44,
          shield: 82,
          shieldMax: 100,
          hull: 76,
          hullMax: 100,
          engageable: true,
          source: "server-snapshot",
        }}
        enabled
        onEngage={() => undefined}
      />
      <div className="wfm-stick wfm-stick--left" aria-hidden="true"><span className="wfm-stick__knob" /></div>
      <div className="wfm-stick wfm-stick--right" aria-hidden="true"><span className="wfm-stick__knob" /></div>
    </main>
  );
}
