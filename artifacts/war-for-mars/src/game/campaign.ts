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
    objective: "BREAK THE DEFENDING WING",
    brief:
      "The Accord found a voice buried under the rust disc's relay lattice. Break the defending wing before the signal is lost; the surviving relay may expose fragments of the expedition that brought Earth to Mars.",
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
    brief:
      "The first recording points to three silent beacons on the pale disc. Your small wing must light two before the USSF sweep closes the lane.",
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
    brief:
      "A Warden is suppressing the night-side relay network. This is the campaign's six-minute Strike: identify the marked ship, keep your wing alive, and end the blockade.",
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
    brief:
      "Dusk was captured after his earlier expedition was destroyed. The Warden's recorder points to a later transfer carrying him through the dust lane: USSF escorts it, while Accord forces move to intercept. The manifest does not explain the disputed authority or destination.",
  },
];

export const DISPATCHES = [
  { need: 0, from: "YARD", text: "Dusk was captured after his expedition was destroyed. Its emergency report reached Earth before the fleet was lost. The Rust Disc may hold the record." },
  { need: 1, from: "CONTACT", text: "The rust disc answered with a route key. The pale beacons are not markers; they are part of a relay chain." },
  { need: 2, from: "BEACON", text: "The relay chain points to a command ship on the night side. Its call sign is Warden." },
  { need: 3, from: "WARDEN", text: "The Warden's recorder names a later Cage transfer. Dusk's original capture is established; the transport's authority and destination are not." },
  { need: 4, from: "CAGE", text: "The verified Cage result is in your archive. The transfer's custody terms remain contested; a secured recorder may carry a signal from beneath Mars." },
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

