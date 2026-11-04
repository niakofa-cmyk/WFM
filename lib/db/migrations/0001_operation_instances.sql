BEGIN;

CREATE TYPE public.operation_instance_status AS ENUM ('active', 'closed');
CREATE TYPE public.operation_instance_visibility AS ENUM ('public', 'unlisted');

CREATE TABLE public.operation_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  operation_id text NOT NULL,
  location_id text NOT NULL,
  owner_user_id text NOT NULL,
  idempotency_key uuid NOT NULL,
  runtime_id text NOT NULL,
  ruleset_id text NOT NULL,
  status public.operation_instance_status DEFAULT 'active' NOT NULL,
  visibility public.operation_instance_visibility DEFAULT 'unlisted' NOT NULL,
  registered_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT operation_instances_identity_nonempty
    CHECK (
      length(operation_id) > 0
      AND length(location_id) > 0
      AND length(runtime_id) > 0
      AND length(ruleset_id) > 0
    ),
  CONSTRAINT operation_instances_expiry_after_registration
    CHECK (expires_at > registered_at)
);

CREATE UNIQUE INDEX operation_instances_owner_idempotency_uq
  ON public.operation_instances USING btree (owner_user_id, idempotency_key);
CREATE UNIQUE INDEX operation_instances_one_active_owner_uq
  ON public.operation_instances USING btree (owner_user_id)
  WHERE status = 'active';
CREATE INDEX operation_instances_public_active_idx
  ON public.operation_instances USING btree (status, visibility, expires_at);

COMMIT;
