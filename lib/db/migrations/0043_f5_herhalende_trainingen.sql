-- F5 — Herhalende trainingen (SPARKI_BUILD_01).
--
-- Puur ADDITIEF en idempotent: bestaande losse trainingen blijven los en
-- worden nooit stil in reeksen veranderd. Een reeks genereert zelfstandig
-- bruikbare planned_workouts-rijen; verwijderen van een reeks laat de
-- gegenereerde trainingen staan (series_id -> NULL, historie behouden).

CREATE TABLE IF NOT EXISTS workout_series (
  id SERIAL PRIMARY KEY,
  clerk_id TEXT NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  frequency TEXT NOT NULL,
  weekdays JSONB,
  interval_days INTEGER,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  type TEXT NOT NULL DEFAULT 'ride',
  title TEXT NOT NULL,
  description TEXT,
  target_duration_min INTEGER,
  target_tss INTEGER,
  plan_details JSONB,
  source TEXT NOT NULL DEFAULT 'sparki',
  coach_clerk_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planned_workouts
  ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES workout_series(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workout_series_clerk_idx ON workout_series (clerk_id);
CREATE INDEX IF NOT EXISTS planned_workouts_series_idx ON planned_workouts (series_id);
