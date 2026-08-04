-- TRAININGSVORMEN_01 F3 (TRV-32/33/61): schemaplekken, geplaatste sessies en
-- ruimte-instelling per trainer×sporter. Additief en omkeerbaar (TRV-89).

CREATE TABLE IF NOT EXISTS plan_slots (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  datum text NOT NULL,
  bedoeling text NOT NULL,
  belastingssoort text,
  duur_min integer,
  duur_max integer,
  intensiteitsmaat text,
  intensiteit_min integer,
  intensiteit_max integer,
  vervangcategorie text,
  herkomst text NOT NULL,
  status text NOT NULL DEFAULT 'leeg',
  afwijkingstoelichting text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_slots_clerk_datum_idx ON plan_slots (clerk_id, datum);

CREATE TABLE IF NOT EXISTS planned_sessions (
  id serial PRIMARY KEY,
  slot_id integer NOT NULL REFERENCES plan_slots(id) ON DELETE CASCADE,
  form_id integer NOT NULL REFERENCES training_forms(id) ON DELETE RESTRICT,
  planned_workout_id integer,
  gekozen_parameters jsonb,
  geschatte_belasting integer,
  belasting_bekend boolean NOT NULL DEFAULT false,
  frisheidskost_per_soort jsonb,
  keuzebron text NOT NULL,
  advies_dossier_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS planned_sessions_slot_uq ON planned_sessions (slot_id);

CREATE TABLE IF NOT EXISTS trainer_slot_defaults (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  sporter_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  ruimte text NOT NULL,
  geldig_vanaf timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_slot_defaults_uq
  ON trainer_slot_defaults (trainer_clerk_id, sporter_clerk_id);
