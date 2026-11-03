import type { Disc } from "./sim";

export type BattlefieldIntel = {
  disc: Disc;
  relays: Array<{ x: number; z: number; own: -1 | 0 | 1 }>;
  rocks: Array<{ x: number; z: number; r: number }>;
};

export const BATTLEFIELD_PROFILES: Record<
  Disc,
  { title: string; callsign: string; briefing: string; tacticalRead: string }
> = {
  rust: {
    title: "PHOBOS RUST BASIN",
    callsign: "RUST",
    briefing: "Three exposed relay lanes cut across a broken basin.",
    tacticalRead: "Open crossings · scattered cover",
  },
  beacon: {
    title: "BEACON SPUR",
    callsign: "BEACON",
    briefing: "A tight signal triangle puts the central relay in early contention.",
    tacticalRead: "Close objectives · compact cover",
  },
  night: {
    title: "TERMINATOR RIDGE",
    callsign: "NIGHT",
    briefing: "Widely separated relays reward coordinated flanks through dense rock.",
    tacticalRead: "Long flanks · dense cover",
  },
  dust: {
    title: "DUSTLINE CROSSING",
    callsign: "DUST",
    briefing: "A wide relay spread creates several routes through the debris field.",
    tacticalRead: "Wide objectives · broken corridors",
  },
};

export function battlefieldProfile(disc: Disc) {
  return BATTLEFIELD_PROFILES[disc];
}

export function battlefieldMapCoordinate(value: number) {
  const bounded = Math.max(-78, Math.min(78, value));
  return 50 + (bounded / 78) * 43;
}
