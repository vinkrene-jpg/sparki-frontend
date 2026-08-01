-- TEAM_ONBOARDING_01 (01-08-2026) — zelfstandige Team-organisatie op de
-- BESTAANDE clubs-container. Volledig additief en idempotent; bestaande
-- Club-organisaties blijven byte-voor-byte ongemoeid (default 'CLUB').

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS organisation_type text NOT NULL DEFAULT 'CLUB';

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS organogram_template text;

-- Stafplekken: conceptstructuur uit de organogram-kaarten. Geen rechten,
-- geen personen — namen en rechten lopen uitsluitend via club_members.
CREATE TABLE IF NOT EXISTS organisation_staff_slots (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  team_id integer REFERENCES club_teams(id) ON DELETE CASCADE,
  role text NOT NULL,
  medical_specialty text,
  label text,
  created_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organisation_staff_slots_club_idx
  ON organisation_staff_slots (club_id);
