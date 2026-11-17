BEGIN;

CREATE TABLE public.universe_population_state (
  controller_id text PRIMARY KEY,
  epoch integer NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz,
  last_applied_at timestamptz,
  last_census_at timestamptz,
  active_ussf_pilots integer NOT NULL DEFAULT 0,
  active_accord_pilots integer NOT NULL DEFAULT 0,
  target_ussf_share_bps integer NOT NULL DEFAULT 5000,
  actual_ussf_hull_count integer NOT NULL DEFAULT 0,
  actual_accord_hull_count integer NOT NULL DEFAULT 0,
  last_added_patrol_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT universe_population_singleton CHECK (controller_id = 'global'),
  CONSTRAINT universe_population_epoch_nonnegative CHECK (epoch >= 0),
  CONSTRAINT universe_population_pilots_nonnegative CHECK (
    active_ussf_pilots >= 0 AND active_accord_pilots >= 0
  ),
  CONSTRAINT universe_population_target_range CHECK (
    target_ussf_share_bps BETWEEN 0 AND 10000
  ),
  CONSTRAINT universe_population_hulls_nonnegative CHECK (
    actual_ussf_hull_count >= 0 AND actual_accord_hull_count >= 0
  ),
  CONSTRAINT universe_population_added_ids_array CHECK (
    jsonb_typeof(last_added_patrol_ids) = 'array'
  )
);

CREATE TABLE public.universe_population_epochs (
  epoch integer PRIMARY KEY,
  census_captured_at timestamptz NOT NULL,
  active_ussf_pilots integer NOT NULL,
  active_accord_pilots integer NOT NULL,
  target_ussf_share_bps integer NOT NULL,
  ussf_hulls_before integer NOT NULL,
  accord_hulls_before integer NOT NULL,
  added_faction text NOT NULL,
  added_hull_count integer NOT NULL,
  patrol_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT universe_population_epoch_positive CHECK (epoch > 0),
  CONSTRAINT universe_population_epoch_pilots_nonnegative CHECK (
    active_ussf_pilots >= 0 AND active_accord_pilots >= 0
  ),
  CONSTRAINT universe_population_epoch_target_range CHECK (
    target_ussf_share_bps BETWEEN 0 AND 10000
  ),
  CONSTRAINT universe_population_epoch_hulls_nonnegative CHECK (
    ussf_hulls_before >= 0 AND accord_hulls_before >= 0
  ),
  CONSTRAINT universe_population_epoch_added_faction CHECK (
    added_faction IN ('ussf', 'accord')
  ),
  CONSTRAINT universe_population_epoch_added_hulls CHECK (
    added_hull_count BETWEEN 2 AND 8
  ),
  CONSTRAINT universe_population_epoch_patrol_ids_array CHECK (
    jsonb_typeof(patrol_ids) = 'array'
  )
);

CREATE INDEX universe_population_epochs_created_idx
  ON public.universe_population_epochs (created_at);

COMMIT;
