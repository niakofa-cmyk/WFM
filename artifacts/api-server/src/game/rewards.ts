import { relaysHeld, createMatch, step, type Disc, type Goal, type Pace, type StepInput } from "./sim";
import { SHIPS, type Faction, type ShipId } from "./ships";

export const STRIKE_STEP_LIMIT = 22_000;
export const GOOD_IDS = ["salt", "iron", "dust", "resin"] as const;
export type GoodId = (typeof GOOD_IDS)[number];
export type MissionId = "skirmish" | "contact" | "beacon" | "warden" | "cage";
export type ReplayClaim = {
  seed: number;
  shipId: ShipId;
  faction: Faction;
  refit: number;
  pace: Pace;
  goal: Goal;
  disc: Disc;
  allyCount: number;
  foeCount: number;
  tech: "stick" | "barrels" | "mark" | null;
  inputs: StepInput[];
  mission: MissionId;
  cleared: number;
  hold: GoodId | null;
  paid: number;
  prices: Partial<Record<GoodId, number>>;
};

const BASE_PRICES: Record<GoodId, number> = { salt: 40, iron: 70, dust: 110, resin: 55 };
const GOOD_NAMES: Record<GoodId, string> = {
  salt: "Solar salt",
  iron: "Void iron",
  dust: "Relic dust",
  resin: "Med resin",
};
const MISSION_ORDER: Record<MissionId, number> = {
  skirmish: -1,
  contact: 0,
  beacon: 1,
  warden: 2,
  cage: 3,
};

function clampInt(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, Math.floor(Number.isFinite(value) ? value : low)));
}

function band(base: number) {
  return [Math.round(base * 0.55), Math.round(base * 1.9)] as const;
}

function pricesFrom(claim: ReplayClaim): Record<GoodId, number> {
  return Object.fromEntries(
    GOOD_IDS.map((good) => {
      const value = claim.prices[good];
      const [low, high] = band(BASE_PRICES[good]);
      return [good, typeof value === "number" ? clampInt(value, low, high) : BASE_PRICES[good]];
    }),
  ) as Record<GoodId, number>;
}

function driftPrices(prices: Record<GoodId, number>, sold: GoodId | null) {
  return Object.fromEntries(
    GOOD_IDS.map((good) => {
      const [low, high] = band(BASE_PRICES[good]);
      const supply = sold === good ? 0.86 : 1;
      const next = Math.round(prices[good] * (0.9 + Math.random() * 0.22) * supply);
      return [good, Math.max(low, Math.min(high, next))];
    }),
  ) as Record<GoodId, number>;
}

function missionUnlocked(mission: MissionId, cleared: number) {
  if (mission === "skirmish" || mission === "contact") return true;
  return MISSION_ORDER[mission] <= cleared;
}

export function adjudicateStrike(claim: ReplayClaim) {
  const shipId = Object.hasOwn(SHIPS, claim.shipId) ? claim.shipId : "mandjet";
  const prices = pricesFrom(claim);
  const hold = claim.hold;
  const match = createMatch(shipId, claim.faction, claim.refit, claim.pace, {
    seed: claim.seed,
    goal: claim.goal,
    disc: claim.disc,
    allyCount: claim.allyCount,
    foeCount: claim.foeCount,
    tech: claim.tech,
  });
  for (const input of claim.inputs.slice(0, STRIKE_STEP_LIMIT)) {
    if (match.over) break;
    step(match, input, 1 / 60);
  }

  const outcome = match.over ?? "loss";
  const kills = clampInt(match.kills, 0, 40);
  const relays = clampInt(relaysHeld(match), 0, 3);
  const clearedIn = clampInt(claim.cleared, 0, 4);
  const combat = (outcome === "win" ? 80 : outcome === "draw" ? 45 : 30) + kills * 12 + relays * 10;
  let cargo = 0;
  let cargoLine = "";
  if (hold) {
    if (outcome === "loss") {
      cargo = Math.round(clampInt(claim.paid, 0, band(BASE_PRICES[hold])[1]) * 0.4);
      cargoLine = `${GOOD_NAMES[hold]} burned on the way back. Scrap paid ${cargo}.`;
    } else if (outcome === "win") {
      cargo = Math.round(prices[hold] * 1.35);
      cargoLine = `${GOOD_NAMES[hold]} cleared the yard for ${cargo}.`;
    } else {
      cargo = prices[hold];
      cargoLine = `${GOOD_NAMES[hold]} sold flat for ${cargo}.`;
    }
  }

  let cleared = clearedIn;
  let bonus = 0;
  let advance = "";
  if (
    outcome === "win" &&
    missionUnlocked(claim.mission, clearedIn) &&
    MISSION_ORDER[claim.mission] === clearedIn
  ) {
    cleared = Math.min(4, clearedIn + 1);
    bonus = 40;
    advance =
      cleared >= 4
        ? "The cage run is over. The yard stays open."
        : `Next sortie: ${(["Beacon", "Warden", "Cage", "Cage"] as const)[cleared - 1]}.`;
  }

  return {
    gain: combat + cargo + bonus,
    combat,
    cargo,
    cargoLine,
    advance,
    cleared,
    prices: driftPrices(prices, hold),
    outcome,
    kills,
    relays,
  };
}
