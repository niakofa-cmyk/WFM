CREATE TABLE IF NOT EXISTS equipment_lockers (
  user_id text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE IF NOT EXISTS equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  equipment_id text NOT NULL,
  source_key text NOT NULL,
  condition integer NOT NULL DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
  ship_id text,
  hardpoint_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_mount_pair CHECK ((ship_id IS NULL) = (hardpoint_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_items_source_uq ON equipment_items (user_id, source_key);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_items_mount_uq ON equipment_items (user_id, ship_id, hardpoint_id);
