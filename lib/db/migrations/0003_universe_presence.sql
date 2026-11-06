BEGIN;

CREATE TABLE public.universe_presence (
  user_id text PRIMARY KEY,
  location_id text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT universe_presence_location_nonempty
    CHECK (length(location_id) > 0),
  CONSTRAINT universe_presence_expiry_after_heartbeat
    CHECK (expires_at > last_seen_at)
);

CREATE INDEX universe_presence_location_expiry_idx
  ON public.universe_presence (location_id, expires_at);
CREATE INDEX universe_presence_expiry_idx
  ON public.universe_presence (expires_at);

COMMIT;
