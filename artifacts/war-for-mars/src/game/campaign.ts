import type { Disc, Goal, Pace } from "./sim";

export type SortieId = "skirmish" | "contact" | "beacon" | "warden" | "cage";

export type Sortie = {
  id: Exclude<SortieId, "skirmish">;
  name: string;
  order: number;
  pace: Pace;
  goal: Goal;
  disc: Disc;
  allyCount: number;
  foeCount: number;
  objective: string;
  brief: string;
};

export const SORTIES: Sortie[] = [
  {
    id: "contact",
    name: "Contact",
    order: 0,
    pace: "practice",
    goal: "disc",
    disc: "rust",
    allyCount: 4,
    foeCount: 4,
    objective: "HOLD TWO RELAYS",
    brief: "First light on the rust disc. Hold two relays or break their integrity.",
  },
  {
    id: "beacon",
    name: "Beacon",
    order: 1,
    pace: "practice",
    goal: "beacons",
    disc: "beacon",
    allyCount: 2,
    foeCount: 3,
    objective: "SECURE TWO BEACONS",
    brief: "A short wing on the pale disc. Take two beacons and the sortie ends.",
  },
  {
    id: "warden",
    name: "Warden",
    order: 2,
    pace: "strike",
    goal: "ace",
    disc: "night",
    allyCount: 4,
    foeCount: 5,
    objective: "KILL THE WARDEN",
    brief: "Six minutes on the night side. The marked ship does not come back.",
  },
  {
    id: "cage",
    name: "Cage",
    order: 3,
    pace: "practice",
    goal: "extract",
    disc: "dust",
    allyCount: 3,
    foeCount: 4,
    objective: "THE CAGE",
    brief: "A cage is running Dusk down the dust lane. USSF covers it. The Accord stops it.",
  },
];

export const DISPATCHES = [
  { need: 0, from: "YARD", text: "Dusk's fleet is ash. He lives. The Accord has him." },
  { need: 1, from: "CONTACT", text: "The rust disc answered. The pale beacons are still dark." },
  { need: 2, from: "BEACON", text: "Two beacons are lit. A warden sits on the night side." },
  { need: 3, from: "WARDEN", text: "The warden is down. A cage is moving. Dusk is on it." },
  { need: 4, from: "CAGE", text: "The cage run is over. Dusk's war is not. The yard stays open." },
] as const;

export function sortieById(id: SortieId): Sortie | null {
  return SORTIES.find((sortie) => sortie.id === id) ?? null;
}

export function sortieUnlocked(id: SortieId, cleared: number): boolean {
  if (id === "skirmish" || id === "contact") return true;
  if (id === "beacon") return cleared >= 1;
  if (id === "warden") return cleared >= 2;
  return cleared >= 3;
}

export type TechId = "stick" | "barrels" | "mark";

export const TECHS: { id: TechId; name: string; need: number; detail: string }[] = [
  { id: "stick", name: "Lighter Stick", need: 1, detail: "Turns faster" },
  { id: "barrels", name: "Hot Barrels", need: 2, detail: "Fires sooner" },
  { id: "mark", name: "Marked Prey", need: 3, detail: "The lock hits harder" },
];

export function techById(id: TechId | null): (typeof TECHS)[number] | null {
  return TECHS.find((tech) => tech.id === id) ?? null;
}

