export type FlightTally = { kills: number; assists: number; credits: number };
type Counts = { kills: number; assists: number; creditsAwarded: number };
export type FlightSettlement = Counts & { encounterId: string; totals: Counts | null };
const count = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
function counts(value: unknown): value is Counts {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return count(v.kills) && count(v.assists) && count(v.creditsAwarded);
}

export function readFlightSettlement(value: unknown): FlightSettlement | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const encounterId = v.encounterId, totals = v.totals;
  if (v.type !== "freeflight_combat_result" || v.status !== "settled" ||
      typeof encounterId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(encounterId) || !counts(v) ||
      totals !== undefined && !counts(totals)) return null;
  return { encounterId, kills: v.kills, assists: v.assists,
    creditsAwarded: v.creditsAwarded, totals: counts(totals) ? totals : null };
}

/** Called outside React's state updater: StrictMode must not consume a receipt twice. */
export function acceptFlightSettlement(seen: Set<string>, receipt: FlightSettlement): boolean {
  if (seen.has(receipt.encounterId)) return false;
  seen.add(receipt.encounterId);
  if (seen.size > 256) seen.delete(seen.values().next().value!);
  return true;
}

export function settlementTallyAfter(previous: FlightTally, receipt: FlightSettlement): FlightTally {
  if (receipt.totals) return {
    kills: Math.max(previous.kills, receipt.totals.kills),
    assists: Math.max(previous.assists, receipt.totals.assists),
    credits: Math.max(previous.credits, receipt.totals.creditsAwarded),
  };
  return { kills: previous.kills + receipt.kills, assists: previous.assists + receipt.assists,
    credits: previous.credits + receipt.creditsAwarded };
}
