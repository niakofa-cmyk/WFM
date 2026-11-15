ALTER TABLE universe_patrols
  ADD COLUMN active_encounter_id text,
  ADD COLUMN encounter_lease_expires_at timestamptz;

ALTER TABLE universe_patrols
  ADD CONSTRAINT universe_patrols_encounter_lease_pair
  CHECK ((active_encounter_id IS NULL) = (encounter_lease_expires_at IS NULL));
