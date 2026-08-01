-- BUILD_03 Dagschema & logistiek (besluitenpatch hoofdstuk D). Idempotent.
CREATE TABLE IF NOT EXISTS club_race_day_schedule (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  clerk_id text NOT NULL,
  depart_time text NOT NULL,
  meet_point text NOT NULL,
  return_time text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_race_day_schedule_unique
  ON club_race_day_schedule (event_id, clerk_id);
CREATE TABLE IF NOT EXISTS club_race_vehicles (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  seats integer,
  driver_clerk_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS club_race_vehicle_seats (
  id serial PRIMARY KEY,
  vehicle_id integer NOT NULL REFERENCES club_race_vehicles(id) ON DELETE CASCADE,
  clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_race_vehicle_seats_unique
  ON club_race_vehicle_seats (vehicle_id, clerk_id);
CREATE TABLE IF NOT EXISTS club_race_material_items (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES club_race_events(id) ON DELETE CASCADE,
  rider_clerk_id text NOT NULL,
  item text NOT NULL,
  loaded_at timestamptz,
  loaded_by_clerk_id text,
  created_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS club_material_templates (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  items jsonb NOT NULL,
  created_by_clerk_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_material_templates_unique
  ON club_material_templates (club_id, name);
