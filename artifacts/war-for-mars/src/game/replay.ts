import type { SortieId } from "./campaign";
import type { GoodId } from "./market";
import { settleStrike } from "./payout";
import { SHIPS, type Faction, type ShipId } from "./ships";
import { createMatch, relaysHeld, step, type Disc, type Goal, type Pace, type StepInput } from "./sim";

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
  mission: SortieId;
  cleared: number;
  hold: GoodId | null;
  paid: number;
  prices: Partial<Record<GoodId, number>>;
};

const MAX_STEPS = 22000;

function num(value: unknown, lo: number, hi: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : 0;
}

function sanitize(raw: Partial<StepInput> | undefined): StepInput {
  const preset = raw?.preset;
  return {
    throttle: num(raw?.throttle, -1, 1),
    yaw: num(raw?.yaw, -1, 1),
    strafe: num(raw?.strafe, -1, 1),
    pitch: num(raw?.pitch, -1, 1),
    fire: raw?.fire === true,
    ult: raw?.ult === true,
    lock: raw?.lock === true,
    evade: num(raw?.evade, -1, 1),
    preset: preset === 0 || preset === 1 || preset === 2 || preset === 3 ? preset : null,
  };
}

export function adjudicateStrike(claim: ReplayClaim) {
  const shipId = claim.shipId && SHIPS[claim.shipId] ? claim.shipId : "mandjet";
  const faction = claim.faction === "ussf" ? "ussf" : "accord";
  const pace = claim.pace === "strike" ? "strike" : "practice";
  const goal = claim.goal === "beacons" || claim.goal === "ace" || claim.goal === "extract" ? claim.goal : "disc";
  const disc = claim.disc === "beacon" || claim.disc === "night" || claim.disc === "dust" ? claim.disc : "rust";
  const tech = claim.tech === "stick" || claim.tech === "barrels" || claim.tech === "mark" ? claim.tech : null;
  const seed = num(claim.seed, 1, 0x7fffffff) || 1;
  const match = createMatch(shipId, faction, num(claim.refit, 0, 5), pace, {
    seed,
    goal,
    disc,
    allyCount: num(claim.allyCount, 1, 4) || 1,
    foeCount: num(claim.foeCount, 1, 5) || 1,
    tech,
  });
  const inputs = Array.isArray(claim.inputs) ? claim.inputs.slice(0, MAX_STEPS) : [];
  for (const raw of inputs) {
    if (match.over) break;
    step(match, sanitize(raw), 1 / 60);
  }
  const outcome = match.over ?? "loss";
  const kills = match.kills;
  const relays = relaysHeld(match);
  return {
    ...settleStrike({
      outcome,
      kills,
      relays,
      mission: claim.mission,
      cleared: claim.cleared,
      hold: claim.hold,
      paid: claim.paid,
      prices: claim.prices,
    }),
    outcome,
    kills,
    relays,
  };
}
