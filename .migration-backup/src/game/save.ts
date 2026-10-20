import { type SortieId, type TechId, TECHS } from "./campaign";
import { basePrices, isGood, type GoodId } from "./market";
import { SHIPS, type Faction, type Scheme, type ShipId } from "./ships";
import type { Pace } from "./sim";

const KEY = "wfm-save-v1";

export type Save = {
  v: 1;
  credits: number;
  ship: ShipId;
  faction: Faction;
  scheme: Scheme;
  refit: number;
  prices: Record<GoodId, number>;
  hold: GoodId | null;
  paid: number;
  pace: Pace;
  gyro: boolean;
  drilled: boolean;
  mission: SortieId;
  cleared: number;
  tech: TechId | null;
};

export function defaultSave(): Save {
  return {
    v: 1,
    credits: 90,
    ship: "mandjet",
    faction: "accord",
    scheme: "arc",
    refit: 0,
    prices: basePrices(),
    hold: null,
    paid: 0,
    pace: "practice",
    gyro: false,
    drilled: false,
    mission: "contact",
    cleared: 0,
    tech: null,
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const p = JSON.parse(raw) as Partial<Save>;
    const base = defaultSave();
    if (p.v !== 1) return base;
    if (!p.ship || !SHIPS[p.ship]) return base;
    if (p.faction !== "accord" && p.faction !== "ussf") return base;
    const prices = { ...base.prices };
    if (p.prices && typeof p.prices === "object") {
      for (const id of Object.keys(base.prices) as GoodId[]) {
        const n = p.prices[id];
        if (typeof n === "number" && Number.isFinite(n)) prices[id] = Math.max(1, Math.round(n));
      }
    }
    const hold = isGood(p.hold) ? p.hold : null;
    return {
      v: 1,
      credits: Math.max(0, Math.floor(p.credits ?? 0)),
      ship: p.ship,
      faction: p.faction,
      scheme: p.scheme === "strafe" ? "strafe" : "arc",
      refit: Math.max(0, Math.min(5, Math.floor(p.refit ?? 0))),
      prices,
      hold,
      paid: hold ? Math.max(0, Math.floor(p.paid ?? prices[hold])) : 0,
      pace: p.pace === "strike" ? "strike" : "practice",
      gyro: p.gyro === true,
      drilled: p.drilled === true,
      mission:
        p.mission === "skirmish" ||
        p.mission === "contact" ||
        p.mission === "beacon" ||
        p.mission === "warden" ||
        p.mission === "cage"
          ? p.mission
          : "contact",
      cleared: Math.max(0, Math.min(4, Math.floor(p.cleared ?? 0))),
      tech: TECHS.some((tech) => tech.id === p.tech && Math.max(0, Math.min(4, Math.floor(p.cleared ?? 0))) >= tech.need)
        ? (p.tech as TechId)
        : null,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: Save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function refitCost(level: number): number {
  return 120 * (level + 1);
}

export function applyRefit<T extends { credits: number; refit: number }>(save: T): T {
  if (save.refit >= 5) return save;
  const cost = refitCost(save.refit);
  if (save.credits < cost) return save;
  return { ...save, credits: save.credits - cost, refit: save.refit + 1 };
}
