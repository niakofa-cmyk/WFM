import type { SortieId } from "./campaign";
import type { GoodId } from "./market";
import type { Faction, ShipId } from "./ships";
import type { Disc, Goal, Pace, StepInput } from "./sim";

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
}

export type StrikeGrant = {
  gain: number;
  combat: number;
  cargo: number;
  cargoLine: string;
  advance: string;
  cleared: number;
  prices: Record<GoodId, number>;
  outcome: "win" | "loss" | "draw";
  kills: number;
  relays: number;
};

export async function claimStrike({ data }: { data: ReplayClaim }): Promise<StrikeGrant> {
  const response = await fetch("/api/strikes/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`The server rejected the sortie claim (${response.status}).`);
  const grant = (await response.json()) as Partial<StrikeGrant>;
  if (
    typeof grant.gain !== "number" ||
    !Number.isFinite(grant.gain) ||
    (grant.outcome !== "win" && grant.outcome !== "loss" && grant.outcome !== "draw") ||
    typeof grant.kills !== "number" ||
    typeof grant.relays !== "number" ||
    !grant.prices ||
    typeof grant.prices !== "object"
  ) {
    throw new Error("The server returned an invalid sortie result.");
  }
  return grant as StrikeGrant;
}
