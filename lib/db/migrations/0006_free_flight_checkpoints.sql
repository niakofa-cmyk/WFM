BEGIN;

CREATE TABLE public.free_flight_checkpoints (
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
);

CREATE INDEX free_flight_checkpoints_updated_idx
  ON public.free_flight_checkpoints (updated_at);

COMMIT;
