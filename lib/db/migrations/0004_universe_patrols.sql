BEGIN;

CREATE TABLE public.universe_patrols (
  patrol_id text PRIMARY KEY,
  origin_location_id text NOT NULL,
  current_location_id text NOT NULL,
  faction text NOT NULL,
  objective text NOT NULL,
  callsign text NOT NULL,
  ship_roster jsonb NOT NULL,
  route jsonb NOT NULL,
  route_index integer NOT NULL DEFAULT 0,
  last_moved_at timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT universe_patrols_location_nonempty
    CHECK (length(current_location_id) > 0 AND length(origin_location_id) > 0),
  CONSTRAINT universe_patrols_faction_valid
    CHECK (faction IN ('ussf', 'accord')),
  CONSTRAINT universe_patrols_objective_valid
    CHECK (objective IN ('recon', 'route-security', 'escort', 'supply-screen')),
  CONSTRAINT universe_patrols_route_index_nonnegative
    CHECK (route_index >= 0),
  CONSTRAINT universe_patrols_revision_nonnegative
    CHECK (revision >= 0),
  CONSTRAINT universe_patrols_callsign_nonempty
    CHECK (length(callsign) > 0),
  CONSTRAINT universe_patrols_roster_is_array
    CHECK (jsonb_typeof(ship_roster) = 'array'),
  CONSTRAINT universe_patrols_route_is_array
    CHECK (jsonb_typeof(route) = 'array')
);

CREATE INDEX universe_patrols_current_location_idx
  ON public.universe_patrols (current_location_id);
CREATE INDEX universe_patrols_origin_location_idx
  ON public.universe_patrols (origin_location_id);

COMMIT;
