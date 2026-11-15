-- Additive staging/development migration for the opt-in public Wing leaderboard.
-- This does not expose player IDs, profile history, email, or online presence.
-- Apply only after independently confirming the target environment.
-- Commit the enum addition before using the new value in a partial index.
ALTER TYPE progression_event_kind ADD VALUE IF NOT EXISTS 'wing_reward';

BEGIN;

ALTER TABLE player_progress
  ADD COLUMN IF NOT EXISTS public_leaderboard_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE player_progress
  ADD COLUMN IF NOT EXISTS public_leaderboard_callsign text;

CREATE INDEX IF NOT EXISTS player_progress_public_leaderboard_idx
  ON player_progress (user_id)
  WHERE public_leaderboard_opt_in = true;

CREATE INDEX IF NOT EXISTS progression_events_online_wing_idx
  ON progression_events (user_id)
  WHERE kind = 'wing_reward' AND result->>'mode' = 'online-wing';

COMMIT;
