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
const MIN_AI_FACTION_SHARE = 0.2;
const MAX_AI_FACTION_SHARE = 0.8;

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
 * Initial requested global AI hull mix. Accord-majority pilots create a larger
 * opposing USSF share; USSF-majority pilots mirror the result. This is a pure
 * policy only: callers must supply globally authoritative population data
 * before using it to change persistent fleets.
 */
export function desiredAiFactionMixFromActivePilots(counts: PilotFactionCounts) {
  const total = counts.ussf + counts.accord;
  if (![counts.ussf, counts.accord, counts.total].every(Number.isSafeInteger) ||
      counts.ussf < 0 || counts.accord < 0 || counts.total !== total) {
    throw new Error("Invalid active-pilot faction counts.");
  }
  const accordShare = total === 0 ? 0.5 : counts.accord / total;
  const rawUssf = Math.max(
    MIN_AI_FACTION_SHARE,
    Math.min(MAX_AI_FACTION_SHARE, 0.5 + 3 * (accordShare - 0.5)),
  );
  const ussf = Math.round(rawUssf * 1_000_000) / 1_000_000;
  return { ussf, accord: Math.round((1 - ussf) * 1_000_000) / 1_000_000 };
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
