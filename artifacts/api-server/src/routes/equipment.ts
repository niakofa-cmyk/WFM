import { Router, type IRouter } from "express";
import { FitEquipmentBody, GetEquipmentResponse, RecoverEquipmentBody } from "@workspace/api-zod";
import { playerIdFromRequest, requirePlayerAuth } from "../middlewares/playerAuth";
import { EquipmentError, fitEquipment, getEquipmentLocker, recoverEquipment } from "../game/equipment";
import { equipmentEnabled } from "../game/equipment-rollout";

const router: IRouter = Router();
router.use(requirePlayerAuth);
router.use((_req, res, next) => {
  if (!equipmentEnabled()) {
    res.status(503).json({ error: "Modular equipment is awaiting this environment's reviewed schema migration and rollout." });
    return;
  }
  next();
});
router.get("/game/equipment", async (req, res, next): Promise<void> => {
  try { res.json(GetEquipmentResponse.parse(await getEquipmentLocker(playerIdFromRequest(req)))); }
  catch (error) { next(error); }
});
router.post("/game/equipment/fit", async (req, res, next): Promise<void> => {
  const parsed = FitEquipmentBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid equipment fitting request." }); return; }
  try { res.json(GetEquipmentResponse.parse(await fitEquipment(playerIdFromRequest(req), parsed.data))); }
  catch (error) {
    if (error instanceof EquipmentError) { res.status(error.status).json({ error: error.message }); return; }
    next(error);
  }
});
router.post("/game/equipment/recover", async (req, res, next): Promise<void> => {
  const parsed = RecoverEquipmentBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid salvage recovery request." }); return; }
  try { res.json(GetEquipmentResponse.parse(await recoverEquipment(playerIdFromRequest(req), parsed.data))); }
  catch (error) {
    if (error instanceof EquipmentError) { res.status(error.status).json({ error: error.message }); return; }
    next(error);
  }
});
export default router;
