import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeFlightCheckpointsTable } from "@workspace/db/schema";

const MAX_CHECKPOINT_BYTES = 4 * 1024 * 1024;

export type FreeFlightCheckpointRow = {
  stateVersion: number;
  fencingToken: number;
  checkpointSequence: number;
  snapshot: Record<string, unknown>;
};

export async function ensureFreeFlightCheckpointSchema(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS public.free_flight_checkpoints (
      session_key text PRIMARY KEY,
      state_version integer NOT NULL,
      fencing_token bigint NOT NULL,
      checkpoint_sequence bigint NOT NULL,
      snapshot jsonb NOT NULL,
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT free_flight_checkpoints_session_key_nonempty
        CHECK (length(session_key) BETWEEN 2 AND 128),
      CONSTRAINT free_flight_checkpoints_state_version_supported
        CHECK (state_version = 1),
      CONSTRAINT free_flight_checkpoints_fencing_token_positive
        CHECK (fencing_token > 0),
      CONSTRAINT free_flight_checkpoints_sequence_nonnegative
        CHECK (checkpoint_sequence >= 0),
      CONSTRAINT free_flight_checkpoints_snapshot_object
        CHECK (jsonb_typeof(snapshot) = 'object')
    )
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS free_flight_checkpoints_updated_idx
      ON public.free_flight_checkpoints (updated_at)
  `));
  await db.select({ sessionKey: freeFlightCheckpointsTable.sessionKey })
    .from(freeFlightCheckpointsTable)
    .limit(0);
}

export async function loadFreeFlightCheckpoint(
  sessionKey: string,
): Promise<FreeFlightCheckpointRow | null> {
  const [row] = await db.select({
    stateVersion: freeFlightCheckpointsTable.stateVersion,
    fencingToken: freeFlightCheckpointsTable.fencingToken,
    checkpointSequence: freeFlightCheckpointsTable.checkpointSequence,
    snapshot: freeFlightCheckpointsTable.snapshot,
  }).from(freeFlightCheckpointsTable)
    .where(sql`${freeFlightCheckpointsTable.sessionKey} = ${sessionKey}`)
    .limit(1);
  if (row && (row.stateVersion !== 1 ||
      !Number.isSafeInteger(row.fencingToken) || row.fencingToken <= 0 ||
      !Number.isSafeInteger(row.checkpointSequence) || row.checkpointSequence < 0 ||
      !row.snapshot || typeof row.snapshot !== "object" || Array.isArray(row.snapshot))) {
    throw new Error("Stored free-flight checkpoint has an unsupported or invalid shape.");
  }
  return row ?? null;
}

/**
 * A stale owner may finish an async write after losing its Redis lease. The
 * monotonic fencing token and per-owner sequence prevent that write replacing
 * a newer snapshot.
 */
export async function saveFreeFlightCheckpoint(
  sessionKey: string,
  snapshot: Record<string, unknown>,
  fencingToken: number,
  checkpointSequence: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(fencingToken) || fencingToken <= 0 ||
      !Number.isSafeInteger(checkpointSequence) || checkpointSequence < 0) {
    throw new Error("Invalid free-flight checkpoint version.");
  }
  if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > MAX_CHECKPOINT_BYTES) {
    throw new Error("Free-flight checkpoint exceeds the 4 MiB storage limit.");
  }
  const now = new Date();
  const rows = await db.insert(freeFlightCheckpointsTable).values({
    sessionKey,
    stateVersion: 1,
    fencingToken,
    checkpointSequence,
    snapshot,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: freeFlightCheckpointsTable.sessionKey,
    set: {
      stateVersion: 1,
      fencingToken,
      checkpointSequence,
      snapshot,
      updatedAt: now,
    },
    setWhere: sql`
      ${freeFlightCheckpointsTable.fencingToken} < excluded.fencing_token
      OR (
        ${freeFlightCheckpointsTable.fencingToken} = excluded.fencing_token
        AND ${freeFlightCheckpointsTable.checkpointSequence} < excluded.checkpoint_sequence
      )
    `,
  }).returning({ sessionKey: freeFlightCheckpointsTable.sessionKey });
  return rows.length === 1;
}
