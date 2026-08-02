-- SPARKI_BUILD_04 F3 — sportergroepen (organisatie, géén rechtenbron). Idempotent.

CREATE TABLE IF NOT EXISTS trainer_groups (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_groups_name_uq ON trainer_groups (trainer_clerk_id, name);
CREATE INDEX IF NOT EXISTS trainer_groups_trainer_idx ON trainer_groups (trainer_clerk_id);

CREATE TABLE IF NOT EXISTS trainer_group_members (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES trainer_groups(id) ON DELETE CASCADE,
  athlete_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_group_members_uq ON trainer_group_members (group_id, athlete_clerk_id);
CREATE INDEX IF NOT EXISTS trainer_group_members_athlete_idx ON trainer_group_members (athlete_clerk_id);
