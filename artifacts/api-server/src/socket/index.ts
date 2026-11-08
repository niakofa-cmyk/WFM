import { startWingSocketServer } from "./server";
import { eq } from "drizzle-orm";
import { isOrbitalFreeFlightEnabled } from "@workspace/orbital-sim";
import { SHIPS, type Faction, type ShipId } from "../game/ships";
import type { FreeFlightAdmission } from "./free-flight-runtime";
import { parseSocketOrigins } from "./origin-policy";
import { createClerkSessionVerifier } from "./clerk-session-verifier";
import { resolveClerkIssuer } from "./clerk-issuer-policy";
import { getSocketFeatureReadiness } from "./reward-config";
import { sectorFlightEnabled, sectorProtocolVersion } from "./sector-feature";
import { SECTOR_ORBITAL_PROTOCOL_VERSION } from "../game/sector-missions";
import {
  releaseUniversePatrolEncounter,
  reserveUniversePatrolEncounter,
  resolveUniversePatrolEncounter,
  resolveUniversePatrolEncounters,
} from "../game/universe-patrols";

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
const sectorWireProtocolVersion = sectorProtocolVersion(process.env);
process.stdout.write(
  `${JSON.stringify({
    event: "socket_feature_readiness",
    ...featureReadiness,
    sectorWireProtocolVersion,
  })}\n`,
);
const settleWingMatch = wingRewardsEnabled
  ? (await import("../game/wing-rewards")).settleCompletedWingMatch
  : undefined;
const enableSectorFlight = sectorFlightEnabled(process.env);
const enableFreeFlight = isOrbitalFreeFlightEnabled({
  environment: process.env.NODE_ENV ?? "production",
  featureFlag: process.env.ORBITAL_FREE_FLIGHT_ENABLED,
  prerequisitesReady: Boolean(process.env.DATABASE_URL),
});
const freeFlightLocations: Readonly<Record<string, string>> = {
  "phobos-yard": "mars-orbit",
  "cinder-asteroid": "cinder-ring",
  "rust-disc": "rust-disc",
  "night-side": "mars-night-side",
};
const resolveFreeFlightAdmission = enableFreeFlight
  ? async (userId: string): Promise<FreeFlightAdmission | null> => {
      const { db, playerProgressTable, playerWorldStateTable } = await import("@workspace/db");
      const [row] = await db
        .select({
          faction: playerProgressTable.faction,
          shipId: playerProgressTable.shipId,
          locationId: playerWorldStateTable.currentLocation,
        })
        .from(playerProgressTable)
        .innerJoin(
          playerWorldStateTable,
          eq(playerWorldStateTable.userId, playerProgressTable.userId),
        )
        .where(eq(playerProgressTable.userId, userId))
        .limit(1);
      if (!row || (row.faction !== "ussf" && row.faction !== "accord")) return null;
      const location = freeFlightLocations[row.locationId];
      if (!location) return null;
      const faction = row.faction as Faction;
      const shipId = row.shipId as ShipId;
      if (!Object.hasOwn(SHIPS, shipId) || SHIPS[shipId].faction !== faction) return null;
      return { sessionKey: `mars:${location}`, faction, shipId };
    }
  : undefined;
process.stdout.write(`${JSON.stringify({
  event: "orbital_freeflight_readiness",
  enabled: enableFreeFlight,
  admission: enableFreeFlight ? "database-backed" : "disabled",
})}\n`);
const sectorProgression = enableSectorFlight && Boolean(process.env.DATABASE_URL)
  ? await import("../game/sector-progression")
  : undefined;
const explorationRewards = (enableSectorFlight || enableFreeFlight) && Boolean(process.env.DATABASE_URL)
  ? await import("../game/exploration-rewards")
  : undefined;
process.stdout.write(`${JSON.stringify({
  event: "orbital_freeflight_combat_readiness",
  enabled: Boolean(enableFreeFlight && explorationRewards),
  contract: "freeflight-v1",
  sectorWireProtocolVersion,
})}\n`);
const storyEvidence = enableSectorFlight && Boolean(process.env.DATABASE_URL)
  ? await import("../game/story-evidence")
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
  enableFreeFlight,
  resolveFreeFlightAdmission,
  // Continuous flight has its own versioned contract. Do not couple its
  // persistent combat adapters to the co-op sector protocol rollout.
  freeFlightCombat: enableFreeFlight && explorationRewards ? {
    resolveUniversePatrols: resolveUniversePatrolEncounters,
    reserveUniversePatrol: reserveUniversePatrolEncounter,
    releaseUniversePatrol: releaseUniversePatrolEncounter,
    settleScoutEncounter: (receipt) => explorationRewards.settleCompletedExploration(receipt, true),
  } : undefined,
  sectorProtocolVersion: sectorWireProtocolVersion,
  loadSectorProgress: sectorProgression?.loadSectorProgress,
  settleSectorDiscovery: sectorProgression?.settleSectorDiscovery,
  recordScoutResults: sectorProgression?.saveSectorScoutResults,
  settleScoutEncounter: explorationRewards &&
    sectorWireProtocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
      ? (receipt) => explorationRewards.settleCompletedExploration(receipt, true)
      : undefined,
  recoverNarrativeEvidence: storyEvidence &&
    sectorWireProtocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
      ? storyEvidence.recoverNarrativeEvidence
      : undefined,
  isAtCinderRing: operationNetwork?.operationCoordinator.isAtCinderRing,
  resolveUniversePatrol: enableFreeFlight && explorationRewards &&
    sectorWireProtocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
      ? resolveUniversePatrolEncounter
      : undefined,
  resolveUniversePatrols: enableFreeFlight && explorationRewards &&
    sectorWireProtocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
      ? resolveUniversePatrolEncounters
      : undefined,
  reserveUniversePatrol: enableFreeFlight && explorationRewards &&
    sectorWireProtocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
      ? reserveUniversePatrolEncounter
      : undefined,
  releaseUniversePatrol: enableFreeFlight && explorationRewards &&
    sectorWireProtocolVersion === SECTOR_ORBITAL_PROTOCOL_VERSION
      ? releaseUniversePatrolEncounter
      : undefined,
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
