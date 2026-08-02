-- SPARKI_BUILD_04 F4 — werkobjectlaag draagt ook zelfstandige-trainer-
-- documenten. Non-destructief en idempotent: bestaande clubrijen ongemoeid.

ALTER TABLE work_objects ADD COLUMN IF NOT EXISTS owner_trainer_clerk_id text
  REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE work_objects ALTER COLUMN club_id DROP NOT NULL;

-- Precies één scope: club óf zelfstandige trainer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_objects_scope_ck'
  ) THEN
    ALTER TABLE work_objects ADD CONSTRAINT work_objects_scope_ck
      CHECK ((club_id IS NOT NULL) <> (owner_trainer_clerk_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS work_objects_owner_trainer_idx
  ON work_objects (owner_trainer_clerk_id);
