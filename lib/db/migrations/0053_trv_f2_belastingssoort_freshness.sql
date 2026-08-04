-- TRAININGSVORMEN_01 F2 (TRV-29/30/31): tweede as (belastingssoort) op
-- geplande trainingen + frisheidskost-tabel (coachregel_v1, TRV-96).
-- Additief en omkeerbaar (TRV-89): één nullable kolom + één nieuwe tabel.

ALTER TABLE planned_workouts ADD COLUMN IF NOT EXISTS belastingssoort text;

CREATE TABLE IF NOT EXISTS freshness_costs (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  datum text NOT NULL,
  soort text NOT NULL,
  waarde_x10 integer NOT NULL,
  afkomstig_van text NOT NULL,
  methode text NOT NULL DEFAULT 'coachregel_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS freshness_costs_bron_soort_uq
  ON freshness_costs (clerk_id, afkomstig_van, soort);
CREATE INDEX IF NOT EXISTS freshness_costs_clerk_datum_idx
  ON freshness_costs (clerk_id, datum);
