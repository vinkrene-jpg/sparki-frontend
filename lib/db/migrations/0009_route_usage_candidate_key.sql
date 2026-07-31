-- AANVULLING ROUTE_PAKKET_02a (besluit René 31-07-2026):
-- ook export van een nog niet opgeslagen routevoorstel telt. Daarvoor wordt
-- de bestaande stabiele kandidaat-identiteit gebruikt (geen parallel
-- routesysteem). Additief en niet-destructief.

ALTER TABLE route_usage_registrations
  ALTER COLUMN route_id DROP NOT NULL;

ALTER TABLE route_usage_registrations
  ADD COLUMN IF NOT EXISTS candidate_key text;

-- Precies één identiteit per registratie (bestaande rijen hebben route_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'route_usage_reg_identity_check'
  ) THEN
    ALTER TABLE route_usage_registrations
      ADD CONSTRAINT route_usage_reg_identity_check
      CHECK ((route_id IS NULL) <> (candidate_key IS NULL));
  END IF;
END $$;

-- Uniciteit wordt partieel: per route óf per kandidaat, binnen de maand.
DROP INDEX IF EXISTS route_usage_reg_user_route_month_idx;
CREATE UNIQUE INDEX IF NOT EXISTS route_usage_reg_user_route_month_idx
  ON route_usage_registrations (clerk_id, route_id, calendar_month)
  WHERE route_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS route_usage_reg_user_candidate_month_idx
  ON route_usage_registrations (clerk_id, candidate_key, calendar_month)
  WHERE candidate_key IS NOT NULL;
