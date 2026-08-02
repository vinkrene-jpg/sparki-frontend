-- SPARKI_BUILD_04 F14 — opvolging (3b-E) + klanthistorie (3b-H).
-- Idempotent: alleen toevoegen, nooit bestaande gegevens raken.

ALTER TABLE trainer_invoices
  ADD COLUMN IF NOT EXISTS payment_agreement_date date,
  ADD COLUMN IF NOT EXISTS payment_agreement_note text,
  ADD COLUMN IF NOT EXISTS uncollectible_reason text;

CREATE TABLE IF NOT EXISTS trainer_client_events (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles (clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id integer NOT NULL REFERENCES trainer_clients (id) ON DELETE CASCADE,
  invoice_id integer REFERENCES trainer_invoices (id) ON DELETE SET NULL,
  kind text NOT NULL,
  body text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'geregistreerd',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trainer_client_events_client_idx ON trainer_client_events (client_id);
CREATE INDEX IF NOT EXISTS trainer_client_events_trainer_idx ON trainer_client_events (trainer_clerk_id);
