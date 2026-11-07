import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";
import { sectorMission, type SectorMissionId, type SectorScoutResult } from "./sector-missions";

/** Server-internal completion evidence. There is deliberately no HTTP/client claim. */
export type CompletedSectorMission = Readonly<{
  matchId: string; userId: string; missionId: SectorMissionId; rulesVersion: 1;
  status: "completed"; elapsed: number; activeTicks: number; acceptedInputs: number;
  discoveries: number; droneHull: number; stage: "complete"; connectedAtEnd: boolean;
  scoutResult?: SectorScoutResult;
}>;
export function validSectorCompletion(result: CompletedSectorMission): boolean {
  const scout = result?.scoutResult;
  const validScout = result?.missionId === "pale-beacons"
    ? scout !== undefined &&
    result.missionId === "pale-beacons" &&
    scout.missionId === "pale-beacons" &&
    scout.encounterId === result.matchId &&
    scout.sectorId === sectorMission("pale-beacons")?.sector.id &&
    scout.runtime === ORBITAL_RUNTIME_ID &&
    scout.policyId === "scout-result-only-v1" &&
    scout.outcome === "completed" &&
    scout.objectiveCompleted === true &&
    Number.isSafeInteger(scout.finalTick) && scout.finalTick >= 0 &&
    Number.isSafeInteger(scout.kills) && scout.kills >= 0 &&
    Number.isSafeInteger(scout.assists) && scout.assists >= 0 &&
    Number.isSafeInteger(scout.rewardableNpcKills) && scout.rewardableNpcKills >= 0 &&
    Array.isArray(scout.destroyedActorIds) &&
    scout.kills === scout.destroyedActorIds.length &&
    scout.rewardableNpcKills <= scout.kills &&
    scout.destroyedActorIds.every((id) => typeof id === "string" && id.length <= 128) &&
    /^[0-9a-f]{64}$/.test(scout.fingerprint)
    : scout === undefined;
  return !!result && validScout && !!sectorMission(result.missionId) && result.rulesVersion === 1 &&
    result.status === "completed" && result.stage === "complete" && result.connectedAtEnd === true &&
    typeof result.userId === "string" && result.userId.length > 0 && result.userId.length <= 256 &&
    /^[0-9a-f-]{36}$/i.test(result.matchId) &&
    Number.isFinite(result.elapsed) && result.elapsed >= 5 && result.elapsed <= 900 &&
    Number.isSafeInteger(result.activeTicks) && result.activeTicks >= 180 &&
    Number.isSafeInteger(result.acceptedInputs) && result.acceptedInputs >= 10 &&
    result.discoveries === 1 && result.droneHull === 0;
}
