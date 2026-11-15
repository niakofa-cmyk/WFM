import type { Faction } from "./ships";

/** Faction identity, never a substitute for team/friendly/hostile indicators. */
export const FACTION_PALETTE = {
  ussf: { accent: "#78bfff", hull: 0x71869c, glow: 0x78bfff, css: "var(--color-spectral)" },
  accord: { accent: "#e0a15a", hull: 0x625044, glow: 0xe0a15a, css: "var(--color-solar)" },
} satisfies Record<Faction, { accent: string; hull: number; glow: number; css: string }>;
