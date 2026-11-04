import { sectorMission, type SectorMissionId } from "./sector-missions";

/** Server-internal completion evidence. There is deliberately no HTTP/client claim. */
export type CompletedSectorMission = Readonly<{
  matchId: string; userId: string; missionId: SectorMissionId; rulesVersion: 1;
  status: "completed"; elapsed: number; activeTicks: number; acceptedInputs: number;
  discoveries: number; droneHull: number; stage: "complete"; connectedAtEnd: boolean;
}>;
export function validSectorCompletion(result: CompletedSectorMission): boolean {
  return !!result && !!sectorMission(result.missionId) && result.rulesVersion === 1 &&
    result.status === "completed" && result.stage === "complete" && result.connectedAtEnd === true &&
    typeof result.userId === "string" && result.userId.length > 0 && result.userId.length <= 256 &&
    /^[0-9a-f-]{36}$/i.test(result.matchId) &&
    Number.isFinite(result.elapsed) && result.elapsed >= 5 && result.elapsed <= 900 &&
    Number.isSafeInteger(result.activeTicks) && result.activeTicks >= 180 &&
    Number.isSafeInteger(result.acceptedInputs) && result.acceptedInputs >= 10 &&
    result.discoveries === 1 && result.droneHull === 0;
}
