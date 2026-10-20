import { Router, type IRouter } from "express";
import {
  ExecuteWorldServiceBody,
  ExecuteWorldServiceResponse,
  ActOnWorldQuestBody,
  ActOnWorldQuestParams,
  ActOnWorldQuestResponse,
  ExploreLocationBody,
  ExploreLocationParams,
  ExploreLocationResponse,
  GetWorldResponse,
  TravelWorldBody,
  TravelWorldResponse,
} from "@workspace/api-zod";
import { requirePlayerAuth, playerIdFromRequest } from "../middlewares/playerAuth";
import { WorldError, actOnWorldQuest, exploreWorldLocation, getWorldSnapshot, travelToWorldLocation } from "../game/world";
import { executeWorldService } from "../game/world-services";

const router: IRouter = Router();
router.use(requirePlayerAuth);

router.post("/world/services", async (req, res, next) => {
  const body = ExecuteWorldServiceBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "invalid_station_request" }); return; }
  try {
    res.json(ExecuteWorldServiceResponse.parse(await executeWorldService(playerIdFromRequest(req), body.data)));
  } catch (error) {
    if (error instanceof WorldError) { res.status(error.status).json({ error: error.message }); return; }
    next(error);
  }
});

router.get("/world", async (req, res, next) => {
  try {
    res.json(GetWorldResponse.parse(await getWorldSnapshot(playerIdFromRequest(req))));
  } catch (error) {
    next(error);
  }
});

router.post("/world/travel", async (req, res, next) => {
  const body = TravelWorldBody.strict().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid_travel_request" });
    return;
  }
  try {
    res.json(
      TravelWorldResponse.parse(
        await travelToWorldLocation(
          playerIdFromRequest(req),
          body.data.destinationId,
          body.data.idempotencyKey,
          body.data.maxCost,
        ),
      ),
    );
  } catch (error) {
    if (error instanceof WorldError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/world/locations/:locationId/explore", async (req, res, next) => {
  const params = ExploreLocationParams.safeParse(req.params);
  const body = ExploreLocationBody.strict().safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "invalid_explore_request" });
    return;
  }
  try {
    res.json(
      ExploreLocationResponse.parse(
        await exploreWorldLocation(
          playerIdFromRequest(req),
          params.data.locationId,
          body.data.idempotencyKey,
        ),
      ),
    );
  } catch (error) {
    if (error instanceof WorldError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/world/quests/:questId/actions", async (req, res, next) => {
  const params = ActOnWorldQuestParams.safeParse(req.params);
  const body = ActOnWorldQuestBody.strict().safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "invalid_quest_action" });
    return;
  }
  try {
    res.json(
      ActOnWorldQuestResponse.parse(
        await actOnWorldQuest(playerIdFromRequest(req), params.data.questId, body.data),
      ),
    );
  } catch (error) {
    if (error instanceof WorldError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
