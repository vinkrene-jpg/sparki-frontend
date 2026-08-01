-- BUILD_03: taak weigeren met reden (blijft open). Idempotent.
ALTER TABLE work_object_tasks ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE work_object_tasks ADD COLUMN IF NOT EXISTS decline_reason text;
