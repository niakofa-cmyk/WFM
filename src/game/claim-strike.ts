import { createServerFn } from "@tanstack/react-start";
import { adjudicateStrike, type ReplayClaim } from "./replay";

export const claimStrike = createServerFn({ method: "POST" })
  .inputValidator((data: ReplayClaim) => data)
  .handler(async ({ data }) => adjudicateStrike(data));
