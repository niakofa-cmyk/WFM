import { Router, type IRouter } from "express";
import { ClaimStrikeBody, ClaimStrikeResponse, StartStrikeBody, StartStrikeResponse } from "@workspace/api-zod";
import { requirePlayerAuth, playerIdFromRequest } from "../middlewares/playerAuth";
import {
  claimPlayerStrike,
  ProgressionError,
  startPlayerStrike,
} from "../game/progression";
import { z } from "zod";

const router: IRouter = Router();
router.use(requirePlayerAuth);

router.post("/strikes/start", async (req, res, next) => {
  const parsed = StartStrikeBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_strike_start" });
    return;
  }
  try {
    const run = await startPlayerStrike(playerIdFromRequest(req), parsed.data);
    const { profileRevision: _profileRevision, ...config } = run.config;
    res.status(201).json(
      StartStrikeResponse.parse({
        runId: run.runId,
        seed: run.seed,
        config,
        profile: run.profile,
      }),
    );
  } catch (error) {
    if (error instanceof ProgressionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/strikes/:runId/claim", async (req, res, next) => {
  const params = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  const parsed = ClaimStrikeBody.strict().safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "invalid_strike_claim" });
    return;
  }
  try {
    const result = await claimPlayerStrike(
      playerIdFromRequest(req),
      params.data.runId,
      parsed.data.inputs,
    );
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(ClaimStrikeResponse.parse(result));
  } catch (error) {
    if (error instanceof ProgressionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
