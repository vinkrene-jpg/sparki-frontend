-- Race-veilige idempotentie voor acceptaties: hooguit één actief
-- (niet-ingetrokken) akkoord per gebruiker + document + versie.
-- Idempotent en puur additief.
CREATE UNIQUE INDEX IF NOT EXISTS "legal_acceptances_active_unique_idx"
  ON "legal_acceptances" ("clerk_id", "kind", "version")
  WHERE "revoked_at" IS NULL;
