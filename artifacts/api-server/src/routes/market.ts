import { Router, type IRouter } from "express";
import { GetMarketResponse, TradeMarketBody, TradeMarketResponse } from "@workspace/api-zod";
import { requirePlayerAuth, playerIdFromRequest } from "../middlewares/playerAuth";
import { getMarketSnapshot, MarketError, tradeMarket } from "../game/market";

const router: IRouter = Router();
router.use(requirePlayerAuth);

router.get("/market", async (req, res, next) => {
  try {
    res.json(GetMarketResponse.parse(await getMarketSnapshot(playerIdFromRequest(req))));
  } catch (error) {
    next(error);
  }
});

router.post("/market/trades", async (req, res, next) => {
  const parsed = TradeMarketBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_market_trade" });
    return;
  }
  try {
    res.json(
      TradeMarketResponse.parse(
        await tradeMarket(playerIdFromRequest(req), parsed.data),
      ),
    );
  } catch (error) {
    if (error instanceof MarketError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
