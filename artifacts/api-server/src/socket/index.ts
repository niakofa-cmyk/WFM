import { startWingSocketServer } from "./server";
import { parseSocketOrigins } from "./origin-policy";
import { createClerkSessionVerifier } from "./clerk-session-verifier";
import { resolveClerkIssuer } from "./clerk-issuer-policy";
import { getSocketFeatureReadiness } from "./reward-config";
import { sectorFlightEnabled } from "./sector-feature";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const allowedOrigins = parseSocketOrigins(process.env.WING_ALLOWED_ORIGINS);
if (process.env.NODE_ENV === "production" && !allowedOrigins?.size) {
  throw new Error(
    "WING_ALLOWED_ORIGINS must be configured before running the socket server in production.",
  );
}

const issuer = resolveClerkIssuer(process.env);

const verifySessionToken = createClerkSessionVerifier({
  secretKey: process.env.CLERK_SECRET_KEY,
  issuer,
  audience: process.env.CLERK_AUDIENCE,
  authorizedParties: allowedOrigins ? [...allowedOrigins] : undefined,
});

const featureReadiness = getSocketFeatureReadiness(process.env);
const {
  competitiveQueueEnabled,
  casualAiQueueEnabled,
  wingRewardsEnabled,
} = featureReadiness;
process.stdout.write(
  `${JSON.stringify({
    event: "socket_feature_readiness",
    ...featureReadiness,
  })}\n`,
);
const settleWingMatch = wingRewardsEnabled
  ? (await import("../game/wing-rewards")).settleCompletedWingMatch
  : undefined;
const enableSectorFlight = sectorFlightEnabled(process.env);
const sectorProgression = enableSectorFlight && Boolean(process.env.DATABASE_URL)
  ? await import("../game/sector-progression")
  : undefined;
const operationNetwork = (enableSectorFlight || competitiveQueueEnabled) && Boolean(process.env.DATABASE_URL)
  ? await import("../game/operation-network")
  : undefined;
const publishCompetitiveMatch = operationNetwork
  ? async (state: Parameters<typeof operationNetwork.operationCoordinator.syncCompetitiveMatch>[0]) => {
      try {
        await operationNetwork.operationCoordinator.syncCompetitiveMatch(state);
      } catch (error) {
        process.stderr.write(`${JSON.stringify({
          event: "competitive_operation_sync_failed",
          errorName: error instanceof Error ? error.name : "UnknownError",
        })}\n`);
      }
    }
  : undefined;
const publishSectorOperation = operationNetwork
  ? async (state: Parameters<typeof operationNetwork.operationCoordinator.syncCooperativeRoom>[0]) => {
      try {
        await operationNetwork.operationCoordinator.syncCooperativeRoom(state);
      } catch (error) {
        process.stderr.write(`${JSON.stringify({
          event: "operation_presence_sync_failed",
          errorName: error instanceof Error ? error.name : "UnknownError",
        })}\n`);
      }
    }
  : undefined;

const runtime = await startWingSocketServer(port, "0.0.0.0", {
  allowedOrigins,
  verifySessionToken,
  enableCompetitiveQueue: competitiveQueueEnabled,
  enableCasualAiQueue: casualAiQueueEnabled,
  enableWingRewards: wingRewardsEnabled,
  settleWingMatch,
  enableSectorFlight,
  loadSectorProgress: sectorProgression?.loadSectorProgress,
  settleSectorDiscovery: sectorProgression?.settleSectorDiscovery,
  isAtCinderRing: operationNetwork?.operationCoordinator.isAtCinderRing,
  publishSectorOperation,
  publishCompetitiveMatch,
});
process.stdout.write(`Wing socket server listening on ${runtime.port}\n`);

function shutdown() {
  void runtime.close().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Wing socket shutdown failed: ${reason}\n`);
    process.exitCode = 1;
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
