-- Additive only. Apply in each isolated environment; do not run against production
-- without that environment's migration review and release approval.
ALTER TYPE progression_event_kind ADD VALUE IF NOT EXISTS 'world_service';
ALTER TABLE player_world_state ADD COLUMN IF NOT EXISTS hyperdrive_tier integer NOT NULL DEFAULT 1;
ALTER TABLE universe_events ADD COLUMN IF NOT EXISTS supply_applied boolean NOT NULL DEFAULT false;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'world_hyperdrive_tier_range') THEN
    ALTER TABLE player_world_state ADD CONSTRAINT world_hyperdrive_tier_range CHECK (hyperdrive_tier BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'world_accord_standing_range') THEN
    ALTER TABLE player_world_state ADD CONSTRAINT world_accord_standing_range CHECK (accord_reputation BETWEEN -100 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'world_ussf_standing_range') THEN
    ALTER TABLE player_world_state ADD CONSTRAINT world_ussf_standing_range CHECK (ussf_reputation BETWEEN -100 AND 100);
  END IF;
END $$;
