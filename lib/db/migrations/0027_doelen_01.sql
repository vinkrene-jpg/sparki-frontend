-- DOELEN_01 F1 — doelsoorten, herkomst, leeftijdsband en trainervoorstel.
-- Non-destructief: alleen guarded ADD COLUMN; bestaande rijen blijven onaangeroerd
-- (null = legacy, DOE-58 — nooit met verzonnen waarden aangevuld).

ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS theme_level integer;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS age_band_at_creation text;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS translation jsonb;

ALTER TABLE goal_proposals ADD COLUMN IF NOT EXISTS proposer_role text NOT NULL DEFAULT 'sparki';
ALTER TABLE goal_proposals ADD COLUMN IF NOT EXISTS proposer_clerk_id text;
ALTER TABLE goal_proposals ADD COLUMN IF NOT EXISTS decline_reason text;

ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS trainer_clerk_id text;
