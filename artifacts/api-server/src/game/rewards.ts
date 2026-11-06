import { relaysHeld, createMatch, step, type Disc, type Goal, type Pace, type StepInput } from "./sim";
import { SHIPS, type Faction, type ShipId } from "./ships";
import { prepareOrbital } from "./orbital-sim";
import {
  isOrbitalRuntimeId,
  LEGACY_SURFACE_RUNTIME_ID,
  ORBITAL_RUNTIME_ID,
  orbitalRulesVersionForRuntime,
  type CombatRuntimeId,
} from "@workspace/orbital-sim";

export const STRIKE_STEP_LIMIT = 360 * 60;
export const PRACTICE_STEP_LIMIT = 120 * 60;
export const GOOD_IDS = ["salt", "iron", "dust", "resin"] as const;
export type GoodId = (typeof GOOD_IDS)[number];
export type MissionId = "skirmish" | "contact" | "beacon" | "warden" | "cage";
export type FlightModel = CombatRuntimeId;
export class InvalidStrikeReplay extends Error {
  constructor(message = "The replay contains invalid control input.") {
    super(message);
    this.name = "InvalidStrikeReplay";
  }
}
export class IncompleteStrikeReplay extends Error {
  constructor() {
    super("The replay ended before the match was resolved.");
    this.name = "IncompleteStrikeReplay";
  }
}
export type ReplayClaim = {
  seed: number;
  shipId: ShipId;
  faction: Faction;
  refit: number;
  shieldMk2?: boolean;
  pace: Pace;
  goal: Goal;
  disc: Disc;
  allyCount: number;
  foeCount: number;
  tech: "stick" | "barrels" | "mark" | null;
  inputs: StepInput[];
  mission: MissionId;
  /** Missing on already-issued runs; those retain the original surface replay. */
  flightModel?: FlightModel;
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
const STEP_INPUT_KEYS = new Set([
  "throttle",
  "yaw",
  "strafe",
  "pitch",
  "fire",
  "ult",
  "lock",
  "evade",
  "preset",
]);
const ORBITAL_CONTROL_KEYS = new Set([
  "vertical",
  "roll",
  "boost",
  "brake",
  "inertial",
  "missile",
  "aimAssist",
]);
const ORBITAL_STEP_INPUT_KEYS = new Set([...STEP_INPUT_KEYS, ...ORBITAL_CONTROL_KEYS]);

type ReplayInputMode = FlightModel | "any";

export function validateStrikeReplayInputs(
  inputs: unknown,
  pace: Pace,
  mode: ReplayInputMode = LEGACY_SURFACE_RUNTIME_ID,
): asserts inputs is StepInput[] {
  const maxFrames = pace === "strike" ? STRIKE_STEP_LIMIT : PRACTICE_STEP_LIMIT;
  if (!Array.isArray(inputs) || inputs.length > maxFrames) {
    throw new InvalidStrikeReplay("The replay exceeds the maximum frame count for this match.");
  }

  let previous: StepInput | undefined;
  let detectedMode: FlightModel | null = null;
  for (const frame of inputs) {
    if (frame === null || typeof frame !== "object" || Array.isArray(frame)) {
      throw new InvalidStrikeReplay();
    }
    const record = frame as Record<string, unknown>;
    const keys = Object.keys(record);
    const orbital = keys.some((key) => ORBITAL_CONTROL_KEYS.has(key));
    const frameMode: FlightModel = orbital
      ? isOrbitalRuntimeId(mode) ? mode : ORBITAL_RUNTIME_ID
      : LEGACY_SURFACE_RUNTIME_ID;
    const expectedKeys = orbital ? ORBITAL_STEP_INPUT_KEYS : STEP_INPUT_KEYS;
    if (
      (mode !== "any" && mode !== frameMode) ||
      (detectedMode !== null && detectedMode !== frameMode) ||
      keys.length !== expectedKeys.size ||
      keys.some((key) => !expectedKeys.has(key))
    ) {
      throw new InvalidStrikeReplay();
    }
    detectedMode = frameMode;
    for (const axis of ["throttle", "yaw", "strafe", "pitch", "evade"] as const) {
      if (typeof record[axis] !== "number" || !Number.isFinite(record[axis]) || record[axis] < -1 || record[axis] > 1) {
        throw new InvalidStrikeReplay();
      }
    }
    if (
      typeof record.fire !== "boolean" ||
      typeof record.ult !== "boolean" ||
      typeof record.lock !== "boolean" ||
      !(record.preset === null || record.preset === 0 || record.preset === 1 || record.preset === 2 || record.preset === 3)
    ) {
      throw new InvalidStrikeReplay();
    }
    if (orbital) {
      for (const axis of ["vertical", "roll"] as const) {
        if (typeof record[axis] !== "number" || !Number.isFinite(record[axis]) || record[axis] < -1 || record[axis] > 1) {
          throw new InvalidStrikeReplay();
        }
      }
      for (const control of ["boost", "brake", "inertial", "missile", "aimAssist"] as const) {
        if (typeof record[control] !== "boolean") throw new InvalidStrikeReplay();
      }
    }
    const input = frame as StepInput;
    if (
      previous &&
      ((previous.ult && input.ult) ||
        (previous.lock && input.lock) ||
        (previous.evade !== 0 && input.evade !== 0) ||
        (previous.preset !== null && input.preset !== null) ||
        (previous.inertial === true && input.inertial === true) ||
        (previous.missile === true && input.missile === true) ||
        (previous.aimAssist === true && input.aimAssist === true))
    ) {
      throw new InvalidStrikeReplay("One-shot controls must include a release frame between activations.");
    }
    previous = input;
  }
}

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
  const flightModel = claim.flightModel ?? LEGACY_SURFACE_RUNTIME_ID;
  if (flightModel !== LEGACY_SURFACE_RUNTIME_ID && !isOrbitalRuntimeId(flightModel)) {
    throw new InvalidStrikeReplay("The issued flight model is not supported.");
  }
  if (isOrbitalRuntimeId(flightModel) && claim.mission !== "contact") {
    throw new InvalidStrikeReplay("Orbital flight is not authorized for this campaign sortie.");
  }
  validateStrikeReplayInputs(claim.inputs, claim.pace, flightModel);
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
    shieldMk2: claim.shieldMk2,
    orbitalRulesVersion: isOrbitalRuntimeId(flightModel) ? orbitalRulesVersionForRuntime(flightModel) : undefined,
  });
  if (isOrbitalRuntimeId(flightModel)) prepareOrbital(match, orbitalRulesVersionForRuntime(flightModel));
  for (const input of claim.inputs) {
    if (match.over) {
      throw new InvalidStrikeReplay("The replay contains control frames after the match ended.");
    }
    step(match, input, 1 / 60);
  }

  if (!match.over) throw new IncompleteStrikeReplay();
  const outcome = match.over;
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
        : claim.mission === "contact" && cleared === 1
          ? "Contact front secured. Pale Beacons are now charted; reach them through Rust Disc. Next sortie: Beacon."
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
