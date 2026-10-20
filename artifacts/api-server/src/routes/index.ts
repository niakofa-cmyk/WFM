import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import strikesRouter from "./strikes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gameRouter);
router.use(strikesRouter);

export default router;
