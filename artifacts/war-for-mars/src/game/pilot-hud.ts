export type TargetFaction = "ussf" | "accord";

const FACTION_ACCENTS: Record<TargetFaction, [number, number, number]> = {
  ussf: [105, 194, 255],
  accord: [231, 166, 91],
};

const CRITICAL_RED: [number, number, number] = [255, 54, 48];

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

export function targetFactionAccent(faction: TargetFaction): string {
  return toHex(FACTION_ACCENTS[faction]);
}

/** Blend the target's faction color toward red as hull integrity falls below 65%. */
export function targetHullColor(faction: TargetFaction, hullPercent: number): string {
  const boundedPercent = Number.isFinite(hullPercent) ? Math.max(0, Math.min(100, hullPercent)) : 0;
  const danger = Math.max(0, Math.min(1, (65 - boundedPercent) / 65));
  const [r, g, b] = FACTION_ACCENTS[faction];
  return toHex([
    r + (CRITICAL_RED[0] - r) * danger,
    g + (CRITICAL_RED[1] - g) * danger,
    b + (CRITICAL_RED[2] - b) * danger,
  ]);
}

export function isTargetHullCritical(hullPercent: number): boolean {
  return !Number.isFinite(hullPercent) || hullPercent <= 30;
}
