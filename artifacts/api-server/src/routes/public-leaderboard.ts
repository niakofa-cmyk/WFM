import { Router, type IRouter } from "express";
import {
  getPublicWingLeaderboard,
  type PublicWingLeaderboardEntry,
} from "../game/public-leaderboard";

export function createPublicLeaderboardRouter(
  listEntries: () => Promise<PublicWingLeaderboardEntry[]> = getPublicWingLeaderboard,
): IRouter {
  const router: IRouter = Router();

  router.get("/game/leaderboard", async (_req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ entries: await listEntries() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createPublicLeaderboardRouter();
