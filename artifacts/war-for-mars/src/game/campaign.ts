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
    brief:
      "The Accord found a voice buried under the rust disc's relay lattice. Hold two relays long enough to decode it, or break the defending wing before the signal is lost.",
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
      "The Warden's recorder reveals a transport cage carrying Eon Dusk through the dust lane. USSF escorts it; the Accord must stop it. The signal inside may explain why both fleets are here.",
  },
];

export const DISPATCHES = [
  { need: 0, from: "YARD", text: "Dusk's fleet is ash. He is a prisoner of the Accord. The yard wants answers before the next convoy arrives." },
  { need: 1, from: "CONTACT", text: "The rust disc answered with a route key. The pale beacons are not markers; they are part of a relay chain." },
  { need: 2, from: "BEACON", text: "The relay chain points to a command ship on the night side. Its call sign is Warden." },
  { need: 3, from: "WARDEN", text: "The Warden's recorder confirms a cage is moving through the dust lane. Dusk is aboard, but the escort is not taking him to a prison." },
  { need: 4, from: "CAGE", text: "The cage is stopped. Its recorder carries a signal older than either fleet. Dusk's war is over; the Mars question is not. The yard stays open." },
] as const;

export const RECOVERED_INTEL = [
  {
    need: 1,
    from: "RUST DISC / FLIGHT RECORDER 01",
    title: "A route hidden in the relay noise",
    text: "The first signal is not a distress call. It is a route key, repeated in the timing gaps between relay pulses.",
  },
  {
    need: 2,
    from: "PALE BEACONS / FLIGHT RECORDER 02",
    title: "The beacons are listening",
    text: "The beacon chain has been receiving the same signal for years. Someone kept the receivers dark so neither fleet would hear it.",
  },
  {
    need: 3,
    from: "NIGHT SIDE / WARDEN BLACK BOX",
    title: "The escort was ordered to disappear",
    text: "The Warden was told to erase the cage, its cargo, and every record of the route. The order predates the Accord–USSF front.",
  },
  {
    need: 4,
    from: "DUST LANE / CAGE RECORDER",
    title: "An answer from below Mars",
    text: "The recovered signal repeats from beneath the Martian surface. Dusk knew the cage was a trap; he chose the route because it was the only way to make the signal public.",
  },
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

