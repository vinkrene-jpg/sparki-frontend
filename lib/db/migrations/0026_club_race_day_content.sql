-- BUILD_03 Wedstrijddag-inhoud (besluitenpatch hoofdstuk D). Idempotent.
CREATE TABLE IF NOT EXISTS club_race_briefings (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'iedereen',
  title text NOT NULL,
  body text NOT NULL,
  created_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS club_race_assignments (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  rider_clerk_id text NOT NULL,
  body text NOT NULL,
  updated_by_clerk_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_race_assignments_unique
  ON club_race_assignments (event_id, rider_clerk_id);
CREATE TABLE IF NOT EXISTS club_race_results (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  rider_clerk_id text NOT NULL,
  position integer,
  note text,
  entered_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_race_results_unique
  ON club_race_results (event_id, rider_clerk_id);
CREATE TABLE IF NOT EXISTS club_race_evaluations (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  author_clerk_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS club_race_guests (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by_clerk_id text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
