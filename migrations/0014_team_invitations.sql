-- TEAM_ONBOARDING_01 addendum (parallelle teams): uitnodigingen kunnen aan een
-- specifieke selectie (club_teams) hangen. Additief en idempotent.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS team_id integer;
