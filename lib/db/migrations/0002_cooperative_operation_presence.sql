BEGIN;

CREATE TYPE public.operation_instance_phase AS ENUM (
  'assembling',
  'ready',
  'active',
  'complete',
  'closed'
);

ALTER TABLE public.operation_instances
  ADD COLUMN phase public.operation_instance_phase NOT NULL DEFAULT 'active',
  ADD COLUMN current_players integer NOT NULL DEFAULT 1,
  ADD COLUMN capacity integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT operation_instances_capacity_bounds
    CHECK (capacity BETWEEN 1 AND 200 AND current_players BETWEEN 0 AND capacity);

COMMIT;
