-- MEDIA_UITLEG_01 F4 — generieke gebruikersstatus voor mediacontent.
-- Non-destructief: alleen CREATE TABLE IF NOT EXISTS. Terugweg: DROP TABLE
-- media_content_status (geen andere tabellen verwijzen ernaar).
CREATE TABLE IF NOT EXISTS media_content_status (
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  content_id text NOT NULL,
  content_version integer NOT NULL,
  state text NOT NULL,
  first_offered_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,
  dismissed_until timestamptz,
  do_not_show_again boolean NOT NULL DEFAULT false,
  last_position_seconds integer,
  playback_speed real,
  last_reoffered_version integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_id, content_id)
);
