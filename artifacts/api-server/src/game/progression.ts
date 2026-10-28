import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  playerProgressTable,
  playerWorldStateTable,
  progressionEventsTable,
  strikeRunsTable,
  type MarketPrices,
  type PlayerProgress,
} from "@workspace/db";
import {
  adjudicateStrike,
  IncompleteStrikeReplay,
  InvalidStrikeReplay,
  validateStrikeReplayInputs,
  type GoodId,
  type MissionId,
  type ReplayClaim,
} from "./rewards";
import type { Disc, Goal, Pace, StepInput } from "./sim";
import { ROSTER, type Faction, type ShipId } from "./ships";

type StrikeStartInput = {
  shipId: ShipId;
  faction: Faction;
  scheme: "arc" | "strafe";
  pace: Pace;
  mission: MissionId;
  tech: "stick" | "barrels" | "mark" | null;
};
type StrikeClaimInputs = StepInput[];

export type GameProfile = {
  credits: number;
  faction: Faction;
  shipId: ShipId;
  scheme: "arc" | "strafe";
  refit: number;
  shieldMk2: boolean;
  prices: MarketPrices;
  hold: GoodId | null;
  paid: number;
  pace: Pace;
  mission: MissionId;
  cleared: number;
  tech: "stick" | "barrels" | "mark" | null;
  drilled: boolean;
  revision: number;
};

type StrikeConfig = Omit<ReplayClaim, "inputs"> & { profileRevision: number };

type MissionConfig = {
  pace: Pace;
  goal: Goal;
  disc: Disc;
  allyCount: number;
  foeCount: number;
};

const DEFAULT_PRICES: MarketPrices = { salt: 40, iron: 70, dust: 110, resin: 55 };
const MISSION_ORDER: Record<MissionId, number> = {
  skirmish: -1,
  contact: 0,
  beacon: 1,
  warden: 2,
  cage: 3,
};
const MISSION_CONFIG: Record<MissionId, MissionConfig> = {
  skirmish: { pace: "practice", goal: "disc", disc: "rust", allyCount: 4, foeCount: 5 },
  contact: { pace: "practice", goal: "disc", disc: "rust", allyCount: 4, foeCount: 4 },
  beacon: { pace: "practice", goal: "beacons", disc: "beacon", allyCount: 2, foeCount: 3 },
  warden: { pace: "strike", goal: "ace", disc: "night", allyCount: 4, foeCount: 5 },
  cage: { pace: "practice", goal: "extract", disc: "dust", allyCount: 3, foeCount: 4 },
};
const TECH_UNLOCK: Record<NonNullable<GameProfile["tech"]>, number> = {
  stick: 1,
  barrels: 2,
  mark: 3,
};

export class ProgressionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProgressionError";
  }
}

function toProfile(row: PlayerProgress): GameProfile {
  return {
    credits: row.credits,
    faction: row.faction as Faction,
    shipId: row.shipId as ShipId,
    scheme: row.scheme as GameProfile["scheme"],
    refit: row.refit,
    shieldMk2: row.shieldMk2,
    prices: row.prices,
    hold: row.hold as GoodId | null,
    paid: row.paid,
    pace: row.pace as Pace,
    mission: row.mission as MissionId,
    cleared: row.cleared,
    tech: row.tech as GameProfile["tech"],
    drilled: row.drilled,
    revision: row.revision,
  };
}

async function lockOrCreateProfile(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
): Promise<PlayerProgress> {
  await tx.insert(playerProgressTable).values({ userId }).onConflictDoNothing();
  const [profile] = await tx
    .select()
    .from(playerProgressTable)
    .where(eq(playerProgressTable.userId, userId))
    .for("update");
  if (!profile) throw new Error("Player profile could not be loaded.");
  return profile;
}

export async function getPlayerProfile(userId: string): Promise<GameProfile> {
  await db.insert(playerProgressTable).values({ userId }).onConflictDoNothing();
  const [profile] = await db
    .select()
    .from(playerProgressTable)
    .where(eq(playerProgressTable.userId, userId));
  if (!profile) throw new Error("Player profile could not be loaded.");
  return toProfile(profile);
}

export async function updatePlayerControlScheme(
  userId: string,
  scheme: GameProfile["scheme"],
): Promise<GameProfile> {
  return db.transaction(async (tx) => {
    const current = await lockOrCreateProfile(tx, userId);
    if (current.scheme === scheme) return toProfile(current);

    const [updated] = await tx
      .update(playerProgressTable)
      // Control preferences must not advance progression revision: issued runs
      // use that revision to bind their server-authoritative reward claim.
      .set({ scheme, updatedAt: new Date() })
      .where(eq(playerProgressTable.userId, userId))
      .returning();
    if (!updated) throw new Error("Player control preference could not be saved.");
    return toProfile(updated);
  });
}

function missionAvailable(mission: MissionId, cleared: number): boolean {
  return mission === "skirmish" || MISSION_ORDER[mission] <= cleared;
}

export async function startPlayerStrike(userId: string, input: StrikeStartInput) {
  return db.transaction(async (tx) => {
    const current = await lockOrCreateProfile(tx, userId);
    const mission = input.mission as MissionId;
    if (!ROSTER[input.faction].includes(input.shipId)) {
      throw new ProgressionError("That ship is not available to the selected faction.", 400);
    }
    if (!missionAvailable(mission, current.cleared)) {
      throw new ProgressionError("That campaign sortie is still locked.", 400);
    }
    if (input.tech && current.cleared < TECH_UNLOCK[input.tech]) {
      throw new ProgressionError("That technology has not been unlocked.", 400);
    }

    const missionConfig = MISSION_CONFIG[mission];
    const pace = mission === "skirmish" ? input.pace : missionConfig.pace;
    const [updated] = await tx
      .update(playerProgressTable)
      .set({
        faction: input.faction,
        shipId: input.shipId,
        scheme: input.scheme,
        pace,
        mission,
        tech: input.tech,
        revision: current.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerProgressTable.userId, userId))
      .returning();
    if (!updated) throw new Error("Player profile could not be saved.");

    const seed = randomInt(1, 0x80000000);
    const config: StrikeConfig = {
      seed,
      shipId: input.shipId,
      faction: input.faction,
      refit: current.refit,
      shieldMk2: current.shieldMk2,
      ...missionConfig,
      pace,
      tech: input.tech,
      mission,
      cleared: current.cleared,
      hold: current.hold as GoodId | null,
      paid: current.paid,
      prices: current.prices,
      profileRevision: updated.revision,
    };
    const runId = randomUUID();
    await tx.insert(strikeRunsTable).values({
      id: runId,
      userId,
      config,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });

    return { runId, seed, config, profile: toProfile(updated) };
  });
}

export async function applyPlayerAction(
  userId: string,
  input: {
    idempotencyKey: string;
    action: "refit";
  },
) {
  return db.transaction(async (tx) => {
    const profile = await lockOrCreateProfile(tx, userId);
    const [previous] = await tx
      .select()
      .from(progressionEventsTable)
      .where(
        and(
          eq(progressionEventsTable.userId, userId),
          eq(progressionEventsTable.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (previous) {
      const previousResult = previous.result as { action?: string; goodId?: string | null };
      if (previousResult.action !== input.action) {
        throw new ProgressionError("This request key was already used for a different action.", 409);
      }
      return {
        profile: toProfile(profile),
        transaction: {
          id: previous.id,
          kind: previous.kind,
          amount: previous.amount,
          balanceBefore: previous.balanceBefore,
          balanceAfter: previous.balanceAfter,
        },
        replayed: true,
      };
    }

    await tx.insert(playerWorldStateTable).values({ userId }).onConflictDoNothing();
    const [world] = await tx.select().from(playerWorldStateTable).where(eq(playerWorldStateTable.userId, userId));
    if (world?.currentLocation !== "phobos-yard") throw new ProgressionError("Return to Phobos Yard for a ship refit.", 400);
    let refit = profile.refit;
    if (refit >= 5) throw new ProgressionError("The ship is already fully refitted.", 400);
    const amount = -120 * (refit + 1);
    if (profile.credits < -amount) {
      throw new ProgressionError("Not enough credits for this refit.", 400);
    }
    const credits = profile.credits + amount;
    const kind = "refit" as const;
    refit += 1;

    const [updated] = await tx
      .update(playerProgressTable)
      .set({ credits, refit, revision: profile.revision + 1, updatedAt: new Date() })
      .where(eq(playerProgressTable.userId, userId))
      .returning();
    if (!updated) throw new Error("Player profile could not be updated.");
    const transactionResult = {
      id: randomUUID(),
      kind,
      amount,
      balanceBefore: profile.credits,
      balanceAfter: credits,
    };
    await tx.insert(progressionEventsTable).values({
      id: transactionResult.id,
      userId,
      idempotencyKey: input.idempotencyKey,
      kind,
      amount,
      balanceBefore: profile.credits,
      balanceAfter: credits,
      result: { action: input.action },
    });
    return { profile: toProfile(updated), transaction: transactionResult, replayed: false };
  });
}

export async function claimPlayerStrike(
  userId: string,
  runId: string,
  inputs: StrikeClaimInputs,
) {
  try {
    validateStrikeReplayInputs(inputs, "strike");
  } catch (error) {
    if (error instanceof InvalidStrikeReplay) throw new ProgressionError(error.message, 400);
    throw error;
  }
  const replayHash = createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(strikeRunsTable)
      .where(and(eq(strikeRunsTable.id, runId), eq(strikeRunsTable.userId, userId)))
      .for("update");
    if (!run) throw new ProgressionError("Sortie not found for this player.", 404);

    const profile = await lockOrCreateProfile(tx, userId);
    if (run.status === "claimed") {
      if (run.replayHash !== replayHash) {
        throw new ProgressionError("This sortie was already claimed with a different replay.", 409);
      }
      return {
        ...(run.result as ReturnType<typeof adjudicateStrike>),
        profile: toProfile(profile),
        replayed: true,
      };
    }
    if (run.status !== "open" || run.expiresAt.getTime() <= Date.now()) {
      await tx.update(strikeRunsTable).set({ status: "expired" }).where(eq(strikeRunsTable.id, runId));
      return { error: "expired" as const };
    }

    const config = run.config as unknown as StrikeConfig;
    if (profile.revision !== config.profileRevision) {
      await tx.update(strikeRunsTable).set({ status: "expired" }).where(eq(strikeRunsTable.id, runId));
      return { error: "profile_changed" as const };
    }

    let grant: ReturnType<typeof adjudicateStrike>;
    try {
      grant = adjudicateStrike({ ...config, inputs } satisfies ReplayClaim);
    } catch (error) {
      if (error instanceof IncompleteStrikeReplay || error instanceof InvalidStrikeReplay) {
        throw new ProgressionError(error.message, 400);
      }
      throw error;
    }
    const credits = profile.credits + grant.gain;
    const [updated] = await tx
      .update(playerProgressTable)
      .set({
        credits,
        prices: grant.prices,
        cleared: grant.cleared,
        hold: null,
        paid: 0,
        revision: profile.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerProgressTable.userId, userId))
      .returning();
    if (!updated) throw new Error("Player profile could not be updated.");

    await tx.insert(progressionEventsTable).values({
      userId,
      idempotencyKey: `strike:${runId}`,
      kind: "strike_reward",
      amount: grant.gain,
      balanceBefore: profile.credits,
      balanceAfter: credits,
      runId,
      result: grant,
    });
    await tx
      .update(strikeRunsTable)
      .set({ status: "claimed", replayHash, result: grant, claimedAt: new Date() })
      .where(eq(strikeRunsTable.id, runId));

    return { ...grant, profile: toProfile(updated), replayed: false };
  });
}
