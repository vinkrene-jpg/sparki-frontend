-- SPARKI_INHAAL_01 BUILD_03 (besluitenpatch hoofdstuk D — Structuur). Idempotent.
ALTER TABLE club_race_events ADD COLUMN IF NOT EXISTS route_id integer;
ALTER TABLE club_race_events ADD COLUMN IF NOT EXISTS deputy_clerk_id text;
ALTER TABLE races ADD COLUMN IF NOT EXISTS club_event_id integer;
-- Eén gesynchroniseerde persoonlijke wedstrijd per renner per clubwedstrijd.
CREATE UNIQUE INDEX IF NOT EXISTS races_club_event_unique
  ON races (clerk_id, club_event_id) WHERE club_event_id IS NOT NULL;
