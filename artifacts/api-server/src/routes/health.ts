import { Router, type IRouter } from "express";
import { GetReadinessResponse, HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json(GetReadinessResponse.parse({ status: "ready", database: true }));
  } catch (error) {
    logger.error({ err: error }, "Database readiness check failed");
    res.status(503).json(
      GetReadinessResponse.parse({ status: "unavailable", database: false }),
    );
  }
});

export default router;
