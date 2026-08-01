-- SPARKI_INHAAL_01 BUILD_02 (besluitenpatch hoofdstuk C): één gedeelde
-- werkobjectlaag. Idempotent.
CREATE TABLE IF NOT EXISTS work_objects (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  event_id integer REFERENCES club_race_events(id) ON DELETE SET NULL,
  object_type text NOT NULL DEFAULT 'koersplan',
  title text NOT NULL,
  status text NOT NULL DEFAULT 'concept',
  staf_mag_elkaars_deel boolean NOT NULL DEFAULT false,
  created_by_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  shared_at timestamptz,
  shared_by_clerk_id text,
  finished_at timestamptz,
  copied_from_id integer,
  template_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_object_sections (
  id serial PRIMARY KEY,
  object_id integer NOT NULL REFERENCES work_objects(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  vast_onderdeel boolean NOT NULL DEFAULT true,
  owner_clerk_id text,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 0,
  filled_by_clerk_id text,
  filled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_object_comments (
  id serial PRIMARY KEY,
  section_id integer NOT NULL REFERENCES work_object_sections(id) ON DELETE CASCADE,
  author_clerk_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_object_tasks (
  id serial PRIMARY KEY,
  object_id integer NOT NULL REFERENCES work_objects(id) ON DELETE CASCADE,
  section_id integer REFERENCES work_object_sections(id) ON DELETE SET NULL,
  title text NOT NULL,
  assignee_clerk_id text NOT NULL,
  created_by_clerk_id text NOT NULL,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_object_history (
  id serial PRIMARY KEY,
  object_id integer NOT NULL REFERENCES work_objects(id) ON DELETE CASCADE,
  section_id integer,
  actor_clerk_id text NOT NULL,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_object_templates (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  object_type text NOT NULL DEFAULT 'koersplan',
  sections jsonb NOT NULL,
  created_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS work_object_templates_unique ON work_object_templates (club_id, name);
