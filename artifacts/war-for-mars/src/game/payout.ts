import { SORTIES, sortieById, sortieUnlocked, TECHS, type SortieId } from "./campaign";
import { GOODS, basePrices, goodName, isGood, scrapValue, winBid, drift, type GoodId } from "./market";

export type Outcome = "win" | "loss" | "draw";

export type StrikeClaim = {
  outcome: Outcome;
  kills: number;
  relays: number;
  mission: SortieId;
  cleared: number;
  hold: GoodId | null;
  paid: number;
  prices: Partial<Record<GoodId, number>>;
};

export type StrikeGrant = {
  gain: number;
  combat: number;
  cargo: number;
  cargoLine: string;
  advance: string;
  cleared: number;
  prices: Record<GoodId, number>;
};

const KILL_CAP = 40;
const RELAY_CAP = 3;

function clampInt(value: number, lo: number, hi: number) {
  if (!Number.isFinite(value)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(value)));
}

function band(base: number) {
  return [Math.round(base * 0.55), Math.round(base * 1.9)] as const;
}

export function sanitizePrices(raw: Partial<Record<GoodId, number>> | undefined): Record<GoodId, number> {
  const next = basePrices();
  for (const good of GOODS) {
    const [lo, hi] = band(good.base);
    const value = raw?.[good.id];
    next[good.id] = typeof value === "number" && Number.isFinite(value) ? Math.max(lo, Math.min(hi, Math.round(value))) : next[good.id];
  }
  return next;
}

function isOutcome(value: string): value is Outcome {
  return value === "win" || value === "loss" || value === "draw";
}

function isMission(value: string): value is SortieId {
  return value === "skirmish" || value === "contact" || value === "beacon" || value === "warden" || value === "cage";
}

export function settleStrike(claim: StrikeClaim): StrikeGrant {
  const outcome = isOutcome(claim.outcome) ? claim.outcome : "loss";
  const kills = clampInt(claim.kills, 0, KILL_CAP);
  const relays = clampInt(claim.relays, 0, RELAY_CAP);
  const clearedIn = clampInt(claim.cleared, 0, 4);
  const mission = isMission(claim.mission) ? claim.mission : "skirmish";
  const prices = sanitizePrices(claim.prices);
  const hold = isGood(claim.hold) ? claim.hold : null;
  const paidCap = hold ? band(GOODS.find((good) => good.id === hold)?.base ?? 40)[1] : 0;
  const paid = hold ? clampInt(claim.paid, 0, paidCap) : 0;
  const combat = (outcome === "win" ? 80 : outcome === "draw" ? 45 : 30) + kills * 12 + relays * 10;
  let cargo = 0;
  let cargoLine = "";
  if (hold) {
    const name = goodName(hold);
    if (outcome === "loss") {
      cargo = scrapValue(paid);
      cargoLine = `${name} burned on the way back. Scrap paid ${cargo}.`;
    } else if (outcome === "win") {
      cargo = winBid(prices[hold]);
      cargoLine = `${name} cleared the yard for ${cargo}.`;
    } else {
      cargo = prices[hold];
      cargoLine = `${name} sold flat for ${cargo}.`;
    }
  }
  const flown = sortieById(mission);
  let cleared = clearedIn;
  let advance = "";
  let bonus = 0;
  if (outcome === "win" && flown && flown.order === clearedIn && sortieUnlocked(mission, clearedIn)) {
    cleared = Math.min(4, clearedIn + 1);
    bonus = 40;
    const found = TECHS.find((tech) => tech.need === cleared);
    advance =
      cleared >= 4
        ? "The cage run is over. The yard stays open."
        : `Next sortie: ${SORTIES[cleared].name}.${found ? " " + found.name + " is on the rack." : ""}`;
  }
  return {
    gain: combat + cargo + bonus,
    combat,
    cargo,
    cargoLine,
    advance,
    cleared,
    prices: drift(prices, hold),
  };
}
