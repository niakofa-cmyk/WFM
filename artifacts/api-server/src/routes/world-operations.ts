import { Router, type IRouter } from "express";
import {
  GetWorldExplorationResultsResponse,
  GetWorldOperationsResponse,
  GetWorldPatrolsResponse,
  LeaveWorldOperationInstanceParams,
  RegisterWorldOperationInstanceBody,
  RegisterWorldOperationInstanceParams,
  RegisterWorldOperationInstanceResponse,
} from "@workspace/api-zod";
import { requirePlayerAuth, playerIdFromRequest } from "../middlewares/playerAuth";
import { OperationError, operationCoordinator } from "../game/operation-network";
import { logger } from "../lib/logger";
import { getRecentSectorScoutResults } from "../game/sector-progression";
import { getUniversePatrolDirectory } from "../game/universe-patrols";
import type { WorldPatrolDirectory } from "@workspace/api-zod";

function storeUnavailable(res: import("express").Response, error: unknown, action: string): void {
  logger.error(
    { errorType: error instanceof Error ? error.name : "unknown" },
    `World operation ${action} unavailable`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(503).json({ error: "operation_service_unavailable" });
}

let activeSubscriptions = 0;
const MAX_OPERATION_EVENT_SUBSCRIPTIONS = 100;

export function createWorldOperationsRouter(
  coordinator = operationCoordinator,
  eventIntervalMs = 15_000,
  readPatrols: (userId: string) => Promise<WorldPatrolDirectory> = getUniversePatrolDirectory,
): IRouter {
  const router: IRouter = Router();
  router.get("/world/patrols", requirePlayerAuth, async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const patrols = await readPatrols(playerIdFromRequest(req));
      res.json(GetWorldPatrolsResponse.parse(patrols));
    } catch (error) {
      storeUnavailable(res, error, "strategic patrol directory");
    }
  });
  router.get("/world/exploration/results", requirePlayerAuth, async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const results = await getRecentSectorScoutResults(playerIdFromRequest(req));
      res.json(GetWorldExplorationResultsResponse.parse({ results }));
    } catch (error) {
      storeUnavailable(res, error, "scout result history");
    }
  });
  router.get("/world/operations", async (_req, res, next) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=10");
      res.json(GetWorldOperationsResponse.parse(await coordinator.getDirectory()));
    } catch (error) {
      storeUnavailable(res, error, "directory");
    }
  });
  router.get("/world/operations/events", async (req, res, next) => {
    try {
      if (activeSubscriptions >= MAX_OPERATION_EVENT_SUBSCRIPTIONS) {
        res.status(503).end();
        return;
      }
      activeSubscriptions++;
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.write(`retry: ${eventIntervalMs}\n\n`);
      const sendSnapshot = async () => {
        if (res.writableEnded) return;
        try {
          const snapshot = GetWorldOperationsResponse.parse(await coordinator.getDirectory());
          res.write(`event: operations.snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
        } catch {
          // Keep database details and identifiers out of the public event stream.
          res.write("event: operations.unavailable\ndata: {\"message\":\"Status temporarily unavailable.\"}\n\n");
        }
      };
      await sendSnapshot();
      const timer = setInterval(() => void sendSnapshot(), eventIntervalMs);
      timer.unref();
      let released = false;
      res.on("close", () => {
        clearInterval(timer);
        if (!released) {
          activeSubscriptions--;
          released = true;
        }
      });
    } catch (error) {
      storeUnavailable(res, error, "event stream");
    }
  });
  router.post("/world/presence/heartbeat", requirePlayerAuth, async (req, res) => {
    try {
      await coordinator.heartbeatPresence(playerIdFromRequest(req));
      res.setHeader("Cache-Control", "no-store");
      res.status(204).end();
    } catch (error) {
      storeUnavailable(res, error, "presence heartbeat");
    }
  });
  router.post("/world/operations/:operationId/instances", requirePlayerAuth, async (req, res, next) => {
    const params = RegisterWorldOperationInstanceParams.safeParse(req.params);
    const body = RegisterWorldOperationInstanceBody.strict().safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_operation_registration" });
      return;
    }
    try {
      const { result, created } = await coordinator.register(
        playerIdFromRequest(req),
        params.data.operationId,
        body.data,
      );
      res.status(created ? 201 : 200).json(RegisterWorldOperationInstanceResponse.parse(result));
    } catch (error) {
      if (error instanceof OperationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      storeUnavailable(res, error, "registration");
    }
  });
  router.post("/world/operations/instances/:instanceId/leave", requirePlayerAuth, async (req, res, next) => {
    const params = LeaveWorldOperationInstanceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "invalid_operation_instance" });
      return;
    }
    try {
      await coordinator.leave(playerIdFromRequest(req), params.data.instanceId);
      res.status(204).end();
    } catch (error) {
      if (error instanceof OperationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      storeUnavailable(res, error, "leave");
    }
  });
  return router;
}

export default createWorldOperationsRouter();
