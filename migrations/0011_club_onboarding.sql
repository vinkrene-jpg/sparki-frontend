-- CLUB_ONBOARDING_01 — additief. Bestaande clubs behouden alles: de kolom
-- clubs.status is tekst met default 'actief'; er wordt geen bestaande rij
-- gewijzigd. Alleen nieuwe onboarding-clubs starten als 'concept'.

CREATE TABLE IF NOT EXISTS club_import_batches (
  id serial PRIMARY KEY,
  club_id integer NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by_clerk_id text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'wacht_op_bevestiging',
  total_rows integer NOT NULL DEFAULT 0,
  ok_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  confirmed_at timestamptz,
  purge_after timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_import_batches_club_idx ON club_import_batches(club_id);

CREATE TABLE IF NOT EXISTS club_import_rows (
  id serial PRIMARY KEY,
  batch_id integer NOT NULL REFERENCES club_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  email text,
  name text,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'ongeldig',
  message text,
  matched_clerk_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_import_rows_batch_idx ON club_import_rows(batch_id);

-- Migratieborging bestaande clubs: expliciet en idempotent — clubs zonder
-- geldige status (hoort niet voor te komen) worden op 'actief' gezet.
UPDATE clubs SET status = 'actief'
WHERE status IS NULL OR status NOT IN ('concept','actief','beperkt','geschorst','beeindigd');
