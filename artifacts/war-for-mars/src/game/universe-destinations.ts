export type DestinationStatus = "training" | "approach" | "planned";

export type Destination = {
  id: string;
  name: string;
  kind: string;
  status: DestinationStatus;
  /** Position on the orbital chart, percent of chart box. */
  x: number;
  y: number;
  ring: number;
  summary: string;
  detail: string[];
};

export const DESTINATIONS: Destination[] = [
  {
    id: "mars-orbit",
    name: "Mars Orbit",
    kind: "Campaign combat theater",
    status: "planned",
    x: 50, y: 52, ring: 0,
    summary: "Mars Orbit combat is awaiting its Orbital-native rebuild.",
    detail: ["Planned destination", "No legacy combat renderer or campaign operation can be launched here"],
  },
  {
    id: "cinder-ring",
    name: "Cinder Ring",
    kind: "Industrial ring station",
    status: "approach",
    x: 74, y: 30, ring: 1,
    summary: "Fly a local docking approach through the asteroid debris into the station collar.",
    detail: ["Practice approach only, no combat instance", "Docking here does not admit you to a match", "Station services require sign-in on the account hub"],
  },
  {
    id: "phobos-drift",
    name: "Phobos Drift Yards",
    kind: "Asteroid competition belt",
    status: "planned",
    x: 26, y: 72, ring: 2,
    summary: "Proposed racing and salvage contests threaded through the shattered moonlet field.",
    detail: ["Planned destination", "No flights, schedules or standings exist yet"],
  },
  {
    id: "halcyon-gate",
    name: "Halcyon Gate",
    kind: "Spatial anomaly",
    status: "planned",
    x: 82, y: 76, ring: 2,
    summary: "A proposed luminous rift past the outer belt, intended for calculated cosmic events.",
    detail: ["Planned destination", "Event timing is not defined or announced"],
  },
  {
    id: "deimos-spire",
    name: "Deimos Spire",
    kind: "Fleet anchorage station",
    status: "planned",
    x: 20, y: 26, ring: 1,
    summary: "Proposed capital anchorage where larger fleet operations would stage.",
    detail: ["Planned destination", "No fleets or crews are stationed here"],
  },
];

export const STATUS_LABEL: Record<DestinationStatus, string> = {
  training: "AVAILABLE · LOCAL TRAINING",
  approach: "AVAILABLE · LOCAL APPROACH",
  planned: "PLANNED · UNAVAILABLE",
};

export type LocalFaction = "ussf" | "accord";

/** Pure, local-only briefing text for the selected faction. Writes no account state. */
export function localFactionBrief(faction: LocalFaction, status: DestinationStatus): string {
  const self = faction === "ussf" ? "USSF" : "Accord";
  const foe = faction === "ussf" ? "Accord" : "USSF";
  if (status === "training") {
    return `Flying ${self}: your local training wing faces ${foe} AI defenders in Mars Orbit. Faction applies to this offline run only and is not saved.`;
  }
  if (status === "approach") {
    return `${self} transit identity: your hull approaches Cinder Ring under ${self} navigation markings. This is a temporary local preview; no patrols, territory or station allegiance are simulated.`;
  }
  return `No ${self} faction world simulation is connected to this destination yet. Your faction choice has no effect here and is not saved.`;
}
