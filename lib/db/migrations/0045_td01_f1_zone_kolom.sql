-- TRAINEN_DOELEN_SEIZOEN_01 F1: gestructureerde zonekolom.
-- Bestaande rijen blijven NULL — een zone wordt nooit achteraf geraden.
ALTER TABLE planned_workouts ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS zone text;
