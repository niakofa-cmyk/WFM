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
      "Dusk's expedition was destroyed above Mars. Recover its final flight recorder from the Rust Disc wreckage, break the defending wing guarding the relay, and extract the emergency packet that reports Dusk's capture.",
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
      "The emergency packet contains a second signal beneath its distress header. Synchronize two of the Pale Beacons and determine whether the pattern predates Dusk's arrival.",
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
    objective: "DESTROY THE WARDEN",
    brief:
      "WARDEN-0 is suppressing records tied to the prisoner transfer. Destroy the marked command vessel, survive the night-side blackout, and recover its authenticated order archive from the wreckage.",
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
      "The Accord captured Dusk after destroying his expedition and is now transferring him under guard. USSF must intercept the prisoner transport; Accord pilots must protect it and complete the transfer. Recover its custody manifest and signal recorder.",
  },
];

export const DISPATCHES = [
  { need: 0, from: "YARD", text: "Dusk's fleet is ash. He is a prisoner of the Accord. The yard wants answers before the next convoy arrives." },
  { need: 1, from: "CONTACT", text: "The rust disc answered with a route key. The pale beacons are not markers; they are part of a relay chain." },
  { need: 2, from: "BEACON", text: "The relay chain points to a command ship on the night side. Its call sign is Warden." },
  { need: 3, from: "WARDEN", text: "The Warden archive confirms that a prisoner transfer is moving through the Dust Lane. Dusk was already captured after the destruction of his expedition; this is a later transfer under Accord custody." },
  { need: 4, from: "CAGE", text: "The transfer's outcome is recorded. The custody manifest confirms Dusk's capture, while the transport recorder carries the signal heard by the Pale Beacons. The war has widened beyond the prisoner." },
] as const;

export const RECOVERED_INTEL = [
  {
    need: 1,
    from: "RUST DISC / FLIGHT RECORDER 01",
    title: "A route hidden in the relay noise",
    text: "The emergency packet is real, but another pattern rides beneath its distress header. The recorder preserves both signals; they must not be mistaken for one transmission.",
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
    text: "WARDEN-0 received an order to suppress the prisoner-transfer record, cargo manifest, and route evidence. Its timestamp predates the open Accord–USSF front; the issuing authority remains unknown.",
  },
  {
    need: 4,
    from: "DUST LANE / CAGE RECORDER",
    title: "An answer from below Mars",
    text: "The custody manifest confirms that Dusk was captured after the expedition was destroyed. The transport recorder contains the same anomalous pattern heard by the Pale Beacons. Nothing yet explains its origin.",
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

