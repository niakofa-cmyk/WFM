import { SECTOR_MISSIONS, sectorMission, type SectorMission, type SectorMissionId } from "./sector-missions";

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
