import { Router, type IRouter } from "express";
import {
  ApplyProgressionActionBody,
  ApplyProgressionActionResponse,
  UpdateLeaderboardProfileBody,
  UpdateLeaderboardProfileResponse,
  UpdateControlSchemeBody,
  UpdateControlSchemeResponse,
  GetGameProfileResponse,
} from "@workspace/api-zod";
import { requirePlayerAuth, playerIdFromRequest } from "../middlewares/playerAuth";
import {
  applyPlayerAction,
  getPlayerProfile,
  ProgressionError,
  updatePlayerControlScheme,
  updatePlayerLeaderboardProfile,
} from "../game/progression";

const router: IRouter = Router();
router.use(requirePlayerAuth);

router.get("/game/profile", async (req, res, next) => {
  try {
    const profile = await getPlayerProfile(playerIdFromRequest(req));
    res.json(GetGameProfileResponse.parse(profile));
  } catch (error) {
    next(error);
  }
});

router.patch("/game/profile/control-scheme", async (req, res, next): Promise<void> => {
  const parsed = UpdateControlSchemeBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_control_scheme" });
    return;
  }
  try {
    const profile = await updatePlayerControlScheme(
      playerIdFromRequest(req),
      parsed.data.scheme,
    );
    res.json(UpdateControlSchemeResponse.parse(profile));
  } catch (error) {
    next(error);
  }
});

router.patch("/game/profile/leaderboard", async (req, res, next): Promise<void> => {
  const parsed = UpdateLeaderboardProfileBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_leaderboard_preference" });
    return;
  }
  try {
    const profile = await updatePlayerLeaderboardProfile(
      playerIdFromRequest(req),
      parsed.data,
    );
    res.json(UpdateLeaderboardProfileResponse.parse(profile));
  } catch (error) {
    if (error instanceof ProgressionError) {
      res.status(error.status).json({ error: "invalid_leaderboard_preference" });
      return;
    }
    next(error);
  }
});

router.post("/game/profile/actions", async (req, res, next) => {
  const parsed = ApplyProgressionActionBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_progression_action" });
    return;
  }
  try {
    const result = await applyPlayerAction(playerIdFromRequest(req), parsed.data);
    res.json(
      ApplyProgressionActionResponse.parse({
        profile: result.profile,
        transaction: result.transaction,
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

export default router;
