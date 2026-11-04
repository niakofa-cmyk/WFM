import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import strikesRouter from "./strikes";
import marketRouter from "./market";
import worldRouter from "./world";
import worldOperationsRouter from "./world-operations";
import publicLeaderboardRouter from "./public-leaderboard";

export function createApiRouter(operationsRouter: IRouter = worldOperationsRouter): IRouter {
  const router: IRouter = Router();
  router.use(healthRouter);
  router.use(publicLeaderboardRouter);
  // Keep the public directory/SSE routes before routers with auth-wide middleware.
  router.use(operationsRouter);
  router.use(gameRouter);
  router.use(strikesRouter);
  router.use(marketRouter);
  router.use(worldRouter);
  return router;
}

export default createApiRouter();
