import { Router, type IRouter } from "express";
import healthRouter from "./health";
import strikesRouter from "./strikes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(strikesRouter);

export default router;
