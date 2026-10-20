import { adjudicateStrike, type ReplayClaim } from "./replay";

export async function claimStrike({ data }: { data: ReplayClaim }) {
  return adjudicateStrike(data);
}
