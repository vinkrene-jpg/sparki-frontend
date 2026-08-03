-- TRAINEN_DOELEN_SEIZOEN_01 F4: doelvorm per sporter (programma|seizoen|ritme).
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS goal_form text;
