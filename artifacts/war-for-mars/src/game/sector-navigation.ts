import { SECTOR_MISSIONS, sectorMission, type SectorMission, type SectorMissionId } from "./sector-missions";
import { CINDER_ASTEROID_SECTOR, RUST_DISC_SECTOR, type FlightSector } from "./flight-sector";

export const CINDER_ASTEROID_OPERATION_ID = "cinder-asteroid-circuit";

/** Selects only a known local operation; online sector assignments remain server-owned. */
export function localTrainingSector(search: string): FlightSector {
  const operationId = new URLSearchParams(search).get("operation");
  return operationId === CINDER_ASTEROID_OPERATION_ID ? CINDER_ASTEROID_SECTOR : RUST_DISC_SECTOR;
}

const STORY_ROUTE: readonly SectorMissionId[] = ["rust-disc", "mars-approach", "pale-beacons"];

/** Pick the next incomplete story operation from server-recorded flight discoveries. */
export function nextStorySectorMission(discoveries: readonly string[]): SectorMission | null {
  const completed = new Set(
    discoveries
      .filter((discovery) => discovery.startsWith("flight:"))
      .map((discovery) => discovery.slice("flight:".length)),
  );

  for (const id of STORY_ROUTE) {
    const mission = sectorMission(id);
    if (!mission || completed.has(id)) continue;
    if (!mission.prerequisite || completed.has(mission.prerequisite)) return mission;
  }
  return null;
}

/** URL selection is only navigation; ExpeditionClient and the server still enforce unlocks. */
export function parseExpeditionMission(search: string): SectorMissionId | null {
  const candidate = new URLSearchParams(search).get("mission");
  return candidate && SECTOR_MISSIONS.some((mission) => mission.id === candidate)
    ? candidate as SectorMissionId
    : null;
}
