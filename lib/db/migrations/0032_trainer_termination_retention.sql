-- SPARKI_BUILD_04 F11 — opzegging (BB-67) + centraal bewaartermijnregister.
-- Idempotent; geen juridische waarden geseed (open besluit).

ALTER TABLE trainer_business ADD COLUMN IF NOT EXISTS ended_at timestamptz;

CREATE TABLE IF NOT EXISTS retention_policies (
  key text PRIMARY KEY,
  retention_days integer,
  note text,
  updated_by_clerk_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
