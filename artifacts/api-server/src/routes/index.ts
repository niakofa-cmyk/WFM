import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import strikesRouter from "./strikes";
import marketRouter from "./market";
import worldRouter from "./world";
import worldOperationsRouter from "./world-operations";
import publicLeaderboardRouter from "./public-leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicLeaderboardRouter);
router.use(gameRouter);
router.use(strikesRouter);
router.use(marketRouter);
router.use(worldOperationsRouter);
router.use(worldRouter);

export default router;
