import { Router, type IRouter } from "express";
import { GetReadinessResponse, HealthCheckResponse, type ReadinessDiagnostics } from "@workspace/api-zod";
import {
  checkDatabaseConnectivity, checkPlayerProfileSchema, checkProfileInitializationPrivileges,
} from "../lib/profile-readiness";
import { logger } from "../lib/logger";

const defaultProbes = {
  databaseConnectivity: checkDatabaseConnectivity,
  profileSchema: checkPlayerProfileSchema,
  profileInitializationPrivileges: checkProfileInitializationPrivileges,
};
type ReadinessProbes = Record<keyof typeof defaultProbes, () => Promise<void>>;

export function createHealthRouter(probes: ReadinessProbes = defaultProbes): IRouter {
  const router: IRouter = Router();
  router.get("/healthz", (_req, res) => {
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  });

  router.get("/readyz", async (_req, res): Promise<void> => {
    const checks: ReadinessDiagnostics = {
      databaseConnectivity: null, profileSchema: null, profileInitializationPrivileges: null,
    };
    const order = ["databaseConnectivity", "profileSchema", "profileInitializationPrivileges"] as const;
    for (const check of order) {
      try {
        await probes[check]();
        checks[check] = true;
      } catch {
        checks[check] = false;
        // Do not expose connection details, SQL or account data in a public probe.
        logger.error({ check }, "API readiness check failed");
        break;
      }
    }
    const ready = order.every(check => checks[check] === true);
    res.status(ready ? 200 : 503).json(GetReadinessResponse.parse({
      status: ready ? "ready" : "unavailable",
      database: checks.databaseConnectivity === true,
      checks,
    }));
  });
  return router;
}

export default createHealthRouter();
