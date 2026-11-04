-- Additive development/staging rollout. Production requires its own reviewed migration.
-- No inventory is deleted or truncated to fit the new capacity policy.
ALTER TABLE player_progress ADD COLUMN IF NOT EXISTS shield_mk2 boolean NOT NULL DEFAULT false;
ALTER TABLE player_progress ADD COLUMN IF NOT EXISTS cargo_expansion boolean NOT NULL DEFAULT false;
ALTER TABLE player_progress ADD COLUMN IF NOT EXISTS drive_efficiency boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS economy_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  idempotency_key text NOT NULL,
  action text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS economy_rejections_user_action_key_uq
ON economy_rejections (user_id, action, idempotency_key);
