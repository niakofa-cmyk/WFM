import { SORTIES } from "./campaign";

/** Presentation only: completion never unlocks or changes authoritative progress. */
export function campaignBriefing(cleared: number) {
  const completed = Number.isFinite(cleared)
    ? Math.max(0, Math.min(SORTIES.length, Math.floor(cleared)))
    : 0;
  const complete = completed === SORTIES.length;
  const sortie = SORTIES[Math.min(completed, SORTIES.length - 1)];
  return {
    completed,
    total: SORTIES.length,
    complete,
    sortie,
    label: complete ? "CAMPAIGN REPLAY" : "NEXT SORTIE",
  };
}
