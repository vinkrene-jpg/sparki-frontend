-- TRAINEN_DOELEN_SEIZOEN_01 F2: meetniveau per sporter + feitelijke signalen
-- per uitgevoerde sessie. Bestaande rijen blijven NULL (eerlijk onbekend).
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS measurement_level text;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS signals jsonb;
