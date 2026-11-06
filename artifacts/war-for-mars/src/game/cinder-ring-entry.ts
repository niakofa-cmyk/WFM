export type CinderRingDockingPhase = "entry" | "approach" | "docked";
export type CinderRingEntrySurface = "travel-hub" | "approach-entry" | "approach-flight" | "docked-hub";

export function cinderRingEntrySurface(
  atCinderRing: boolean,
  phase: CinderRingDockingPhase,
): CinderRingEntrySurface {
  if (!atCinderRing) return "travel-hub";
  if (phase === "approach") return "approach-flight";
  if (phase === "docked") return "docked-hub";
  return "approach-entry";
}
