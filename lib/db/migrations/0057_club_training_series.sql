-- CLUB_AFRONDING_01 C1: herhalende clubtrainingen.
-- Zelfde reeksbehandeling als workout_series (F5): reeks materialiseert
-- echte club_trainings-rijen vooruit; losgekoppelde uitzonderingen krijgen
-- series_id NULL en blijven zelfstandig bestaan.

CREATE TABLE IF NOT EXISTS club_training_series (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  weekdays integer[],
  interval_days integer,
  start_date date NOT NULL,
  end_date date NOT NULL,
  exceptions date[],
  status text NOT NULL DEFAULT 'active',
  title text NOT NULL,
  start_time text,
  location text,
  location_id integer,
  route_id integer,
  level text,
  goal text,
  trainer_clerk_id text,
  team_id integer,
  group_id integer,
  max_participants integer,
  duration_min integer,
  material_info text,
  safety_info text,
  notes text,
  created_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_training_series_club_idx
  ON club_training_series (club_id);

ALTER TABLE club_trainings
  ADD COLUMN IF NOT EXISTS series_id integer REFERENCES club_training_series(id) ON DELETE SET NULL;
