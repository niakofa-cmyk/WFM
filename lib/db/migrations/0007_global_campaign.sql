BEGIN;
CREATE TABLE IF NOT EXISTS universe_campaign (
  id text PRIMARY KEY,
  completed_operations integer NOT NULL DEFAULT 0 CHECK (completed_operations >= 0),
  target_operations integer NOT NULL CHECK (target_operations > 0),
  concluded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_operations <= target_operations)
);
CREATE TABLE IF NOT EXISTS universe_campaign_events (
  campaign_id text NOT NULL REFERENCES universe_campaign(id),
  encounter_id text NOT NULL,
  fingerprint text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, encounter_id)
);
CREATE TABLE IF NOT EXISTS universe_campaign_participants (
  campaign_id text NOT NULL REFERENCES universe_campaign(id),
  user_id text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);
COMMIT;
