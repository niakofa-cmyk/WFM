import { and, asc, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import {
  db,
  playerProgressTable,
  progressionEventsTable,
} from "@workspace/db";

export const PUBLIC_WING_LEADERBOARD_LIMIT = 25;
const CALLSIGN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,15}$/;

export type LeaderboardSourceRow = {
  userId: string;
  optIn: boolean;
  callsign: string | null;
  score: number | string;
};

export type PublicWingLeaderboardEntry = {
  rank: number;
  callsign: string;
  score: number;
};

export function normalizeLeaderboardProfileUpdate(input: {
  enabled: boolean;
  callsign?: string;
}): { enabled: boolean; callsign: string | null } {
  if (!input.enabled) return { enabled: false, callsign: null };
  const callsign = input.callsign?.trim();
  if (!callsign || !CALLSIGN_PATTERN.test(callsign)) {
    throw new Error("invalid_public_callsign");
  }
  return { enabled: true, callsign };
}

export function projectPublicWingLeaderboard(
  rows: LeaderboardSourceRow[],
): PublicWingLeaderboardEntry[] {
  const eligible = rows.flatMap((row) => {
    const callsign = row.callsign?.trim();
    const score = Number(row.score);
    if (
      !row.optIn ||
      !callsign ||
      !CALLSIGN_PATTERN.test(callsign) ||
      !Number.isSafeInteger(score) ||
      score <= 0
    ) {
      return [];
    }
    return [{ callsign, score }];
  });

  eligible.sort((left, right) =>
    right.score - left.score ||
    left.callsign.toLowerCase().localeCompare(right.callsign.toLowerCase()),
  );

  return eligible.slice(0, PUBLIC_WING_LEADERBOARD_LIMIT).map((entry, index) => ({
    rank: index + 1,
    callsign: entry.callsign,
    score: entry.score,
  }));
}

export async function getPublicWingLeaderboard(): Promise<PublicWingLeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: playerProgressTable.userId,
      optIn: playerProgressTable.publicLeaderboardOptIn,
      callsign: playerProgressTable.publicLeaderboardCallsign,
      score: sql<string>`coalesce(sum(${progressionEventsTable.amount}), 0)::text`,
    })
    .from(playerProgressTable)
    .innerJoin(
      progressionEventsTable,
      and(
        eq(progressionEventsTable.userId, playerProgressTable.userId),
        eq(progressionEventsTable.kind, "wing_reward"),
        gt(progressionEventsTable.amount, 0),
        sql`${progressionEventsTable.result}->>'mode' = 'online-wing'`,
      ),
    )
    .where(
      and(
        eq(playerProgressTable.publicLeaderboardOptIn, true),
        isNotNull(playerProgressTable.publicLeaderboardCallsign),
      ),
    )
    .groupBy(
      playerProgressTable.userId,
      playerProgressTable.publicLeaderboardOptIn,
      playerProgressTable.publicLeaderboardCallsign,
    )
    .orderBy(
      desc(sql`sum(${progressionEventsTable.amount})`),
      asc(playerProgressTable.publicLeaderboardCallsign),
    )
    .limit(PUBLIC_WING_LEADERBOARD_LIMIT);

  return projectPublicWingLeaderboard(rows);
}
