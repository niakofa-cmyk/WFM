import { Router, type IRouter } from "express";
import { z } from "zod";
import { adjudicateStrike, GOOD_IDS, STRIKE_STEP_LIMIT, type ReplayClaim } from "../game/rewards";

const stepInput = z.object({
  throttle: z.number().finite().min(-1).max(1),
  yaw: z.number().finite().min(-1).max(1),
  strafe: z.number().finite().min(-1).max(1),
  pitch: z.number().finite().min(-1).max(1),
  fire: z.boolean(),
  ult: z.boolean(),
  lock: z.boolean(),
  evade: z.number().finite().min(-1).max(1),
  preset: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).nullable(),
});

const goodId = z.enum(GOOD_IDS);
const claimSchema = z.object({
  seed: z.number().int().min(1).max(0x7fffffff),
  shipId: z.enum(["mandjet", "shakuna", "sundara", "tripura", "duskbreaker", "sentinel", "splitter", "glide"]),
  faction: z.enum(["accord", "ussf"]),
  refit: z.number().int().min(0).max(5),
  pace: z.enum(["practice", "strike"]),
  goal: z.enum(["disc", "beacons", "ace", "extract"]),
  disc: z.enum(["rust", "beacon", "night", "dust"]),
  allyCount: z.number().int().min(1).max(4),
  foeCount: z.number().int().min(1).max(5),
  tech: z.enum(["stick", "barrels", "mark"]).nullable(),
  inputs: z.array(stepInput).max(STRIKE_STEP_LIMIT),
  mission: z.enum(["skirmish", "contact", "beacon", "warden", "cage"]),
  cleared: z.number().int().min(0).max(4),
  hold: goodId.nullable(),
  paid: z.number().int().min(0).max(209),
  prices: z.object({
    salt: z.number().finite().optional(),
    iron: z.number().finite().optional(),
    dust: z.number().finite().optional(),
    resin: z.number().finite().optional(),
  }),
});

const router: IRouter = Router();

router.post("/strikes/claim", (req, res) => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_strike_claim" });
    return;
  }
  res.json(adjudicateStrike(parsed.data as ReplayClaim));
});

export default router;
