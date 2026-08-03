-- TRAINEN_DOELEN_SEIZOEN_01 F3: belasting op hartslag, apart herkenbaar van
-- de vermogensbelasting. Bestaande rijen blijven NULL (eerlijk leeg).
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS resting_hr integer;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS max_hr integer;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS hr_load integer;
