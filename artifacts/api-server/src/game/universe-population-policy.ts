export type UniverseFaction = "ussf" | "accord";
export type PilotFactionCounts = Readonly<{ ussf: number; accord: number; total: number }>;

export type ActiveFlightPilotSample = Readonly<{
  userId: string;
  faction: UniverseFaction;
  authenticated: boolean;
  connected: boolean;
  spectator?: boolean;
  observedAt: number;
}>;

const FRESH_PILOT_WINDOW_MS = 15_000;
const DEFAULT_MAX_HOSTILE_AI_SHARE = 0.8;

export type EncounterAiFactionMix = Readonly<{
  enemyFaction: UniverseFaction;
  friendlyFaction: UniverseFaction;
  enemyShare: number;
  friendlyShare: number;
}>;

/** Encounter hostility is always relative to the authenticated pilot group's faction. */
export function encounterAiFactionMixForCombat(
  friendlyFaction: UniverseFaction,
  enemyShare = DEFAULT_MAX_HOSTILE_AI_SHARE,
): EncounterAiFactionMix {
  if (!Number.isFinite(enemyShare) || enemyShare < 0.5 || enemyShare > 1) {
    throw new Error("Invalid encounter enemy share.");
  }
  return {
    enemyFaction: friendlyFaction === "ussf" ? "accord" : "ussf",
    friendlyFaction,
    enemyShare,
    friendlyShare: Math.round((1 - enemyShare) * 1_000_000) / 1_000_000,
  };
}

/**
 * Count distinct, authenticated, connected pilot seats with a fresh server
 * observation. Conflicting same-time seats fail closed rather than double
 * counting one account in both factions.
 */
export function countFreshActivePilots(
  samples: readonly ActiveFlightPilotSample[],
  now: number,
  freshnessWindowMs = FRESH_PILOT_WINDOW_MS,
): PilotFactionCounts {
  if (!Number.isFinite(now) || !Number.isFinite(freshnessWindowMs) || freshnessWindowMs <= 0) {
    throw new Error("Invalid active-pilot freshness window.");
  }
  const latest = new Map<string, ActiveFlightPilotSample>();
  const conflicted = new Set<string>();
  for (const sample of samples) {
    if (!sample.authenticated || !sample.connected || sample.spectator ||
        !sample.userId || (sample.faction !== "ussf" && sample.faction !== "accord") ||
        !Number.isFinite(sample.observedAt) || sample.observedAt > now ||
        now - sample.observedAt > freshnessWindowMs) continue;
    const previous = latest.get(sample.userId);
    if (!previous || sample.observedAt > previous.observedAt) {
      latest.set(sample.userId, sample);
      conflicted.delete(sample.userId);
    } else if (sample.observedAt === previous.observedAt && sample.faction !== previous.faction) {
      conflicted.add(sample.userId);
    }
  }
  let ussf = 0;
  let accord = 0;
  for (const [userId, sample] of latest) {
    if (conflicted.has(userId)) continue;
    if (sample.faction === "ussf") ussf += 1;
    else accord += 1;
  }
  return { ussf, accord, total: ussf + accord };
}

/**
 * Initial, adjustable global AI hull mix. Accord-majority pilots create a
 * larger opposing USSF share and a smaller friendly Accord share; USSF-majority
 * pilots mirror it. This fleet-wide target does not define every pilot's local
 * view; encounterAiFactionMixForCombat supplies faction-relative composition.
 * This is a pure policy only: callers must supply globally authoritative
 * population data before using it to change persistent fleets.
 */
export function desiredAiFactionMixFromActivePilots(
  counts: PilotFactionCounts,
  maximumHostileShare = DEFAULT_MAX_HOSTILE_AI_SHARE,
) {
  const total = counts.ussf + counts.accord;
  if (![counts.ussf, counts.accord, counts.total, maximumHostileShare].every(Number.isFinite) ||
      ![counts.ussf, counts.accord, counts.total].every(Number.isSafeInteger) ||
      counts.ussf < 0 || counts.accord < 0 || counts.total !== total) {
    throw new Error("Invalid active-pilot faction counts.");
  }
  if (maximumHostileShare < 0.5 || maximumHostileShare > 1) {
    throw new Error("Invalid maximum hostile AI share.");
  }
  const accordShare = total === 0 ? 0.5 : counts.accord / total;
  const minimumFactionShare = 1 - maximumHostileShare;
  const rawUssf = Math.max(
    minimumFactionShare,
    Math.min(maximumHostileShare, 0.5 + 3 * (accordShare - 0.5)),
  );
  const ussf = Math.round(rawUssf * 1_000_000) / 1_000_000;
  return { ussf, accord: Math.round((1 - ussf) * 1_000_000) / 1_000_000 };
}

export type PersistentAiHullCounts = Readonly<{ ussf: number; accord: number }>;
export type AiHullReinforcementPlan = Readonly<{
  faction: UniverseFaction | null;
  hullCount: number;
  totalBefore: number;
  totalAfter: number;
}>;

/**
 * Plan additive, bounded reinforcements only. Existing hulls and casualties are
 * never removed or restored; reserve fleets are created with new durable IDs.
 */
export function planAiHullReinforcements(
  current: PersistentAiHullCounts,
  target: Readonly<{ ussf: number; accord: number }>,
  maximumTotalHulls: number,
  maximumAddedHulls: number,
  minimumShareGap = 0.05,
): AiHullReinforcementPlan {
  const values = [
    current.ussf, current.accord, target.ussf, target.accord,
    maximumTotalHulls, maximumAddedHulls, minimumShareGap,
  ];
  if (!values.every(Number.isFinite) ||
      ![current.ussf, current.accord, maximumTotalHulls, maximumAddedHulls]
        .every(Number.isSafeInteger) ||
      current.ussf < 0 || current.accord < 0 ||
      maximumTotalHulls < 0 || maximumAddedHulls < 0 ||
      target.ussf < 0 || target.ussf > 1 ||
      target.accord < 0 || target.accord > 1 ||
      Math.abs(target.ussf + target.accord - 1) > 1e-6 ||
      minimumShareGap < 0 || minimumShareGap > 1) {
    throw new Error("Invalid persistent AI hull balance input.");
  }

  const totalBefore = current.ussf + current.accord;
  const available = Math.min(maximumTotalHulls - totalBefore, maximumAddedHulls);
  if (totalBefore === 0 || available < 2) {
    return { faction: null, hullCount: 0, totalBefore, totalAfter: totalBefore };
  }

  const gaps = {
    ussf: target.ussf - current.ussf / totalBefore,
    accord: target.accord - current.accord / totalBefore,
  };
  const faction: UniverseFaction = gaps.ussf >= gaps.accord ? "ussf" : "accord";
  const gap = gaps[faction];
  if (gap < minimumShareGap) {
    return { faction: null, hullCount: 0, totalBefore, totalAfter: totalBefore };
  }

  const targetShare = target[faction];
  const currentFactionCount = current[faction];
  const required = targetShare >= 1
    ? available
    : Math.max(2, Math.ceil(
      (targetShare * totalBefore - currentFactionCount) / (1 - targetShare),
    ));
  // Persistent formations contain 2–4 ships; keep every epoch's addition even
  // so it can be stored as complete, deterministic patrol formations.
  const hullCount = Math.floor(Math.min(required, available) / 2) * 2;
  if (hullCount < 2) {
    return { faction: null, hullCount: 0, totalBefore, totalAfter: totalBefore };
  }
  return { faction, hullCount, totalBefore, totalAfter: totalBefore + hullCount };
}

export type UniverseRegionClass =
  | "safe-core"
  | "established-route"
  | "contested-frontier"
  | "deep-space";

const REGION_THREAT_MULTIPLIERS: Readonly<Record<
  UniverseRegionClass,
  { minimum: number; typical: number; maximum: number; rareMaximum?: number }
>> = {
  "safe-core": { minimum: 0.5, typical: 0.65, maximum: 0.8 },
  "established-route": { minimum: 0.8, typical: 0.9, maximum: 1.0 },
  "contested-frontier": { minimum: 1.0, typical: 1.25, maximum: 1.5 },
  "deep-space": { minimum: 1.0, typical: 1.25, maximum: 1.5, rareMaximum: 2.5 },
};

/**
 * Convert human threat-equivalent strength into a proposed regional encounter
 * envelope. It is not a ship-count multiplier and does not spawn actors.
 */
export function encounterThreatEnvelope(
  region: UniverseRegionClass,
  humanThreatBudget: number,
) {
  if (!Number.isFinite(humanThreatBudget) || humanThreatBudget < 0) {
    throw new Error("Invalid human threat budget.");
  }
  const multipliers = REGION_THREAT_MULTIPLIERS[region];
  if (!multipliers) throw new Error("Unknown universe region class.");
  return {
    minimum: humanThreatBudget * multipliers.minimum,
    typical: humanThreatBudget * multipliers.typical,
    maximum: humanThreatBudget * multipliers.maximum,
    rareMaximum: humanThreatBudget * (multipliers.rareMaximum ?? multipliers.maximum),
  };
}

export type AppliedAiMix = Readonly<{ ussf: number; accord: number; appliedAt: number }>;

/**
 * Bound population updates with a cooldown and hysteresis. Persistent fleet
 * mutation must still be transactional, lease-aware, and casualty-preserving.
 */
export function shouldApplyAiMix(
  previous: AppliedAiMix | null,
  next: Pick<AppliedAiMix, "ussf" | "accord">,
  now: number,
  minimumIntervalMs = 60_000,
  minimumShareChange = 0.08,
): boolean {
  if (![next.ussf, next.accord, now, minimumIntervalMs, minimumShareChange].every(Number.isFinite) ||
      next.ussf < 0 || next.ussf > 1 || next.accord < 0 || next.accord > 1 ||
      Math.abs(next.ussf + next.accord - 1) > 1e-6 ||
      minimumIntervalMs < 0 || minimumShareChange < 0 || minimumShareChange > 1) {
    throw new Error("Invalid AI population mix.");
  }
  if (!previous) return true;
  if (![previous.ussf, previous.accord, previous.appliedAt].every(Number.isFinite) ||
      previous.ussf < 0 || previous.ussf > 1 || previous.accord < 0 || previous.accord > 1 ||
      Math.abs(previous.ussf + previous.accord - 1) > 1e-6 ||
      now < previous.appliedAt ||
      now - previous.appliedAt < minimumIntervalMs) return false;
  return Math.max(
    Math.abs(next.ussf - previous.ussf),
    Math.abs(next.accord - previous.accord),
  ) >= minimumShareChange;
}
