-- SPARKI_BUILD_04 F5/F6/F8 — diensten, terugkerende coaching, facturen. Idempotent.

CREATE TABLE IF NOT EXISTS trainer_services (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  vat_rate_bps integer NOT NULL DEFAULT 2100,
  unit text NOT NULL DEFAULT 'maand',
  duration_note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_services_trainer_idx ON trainer_services (trainer_clerk_id);

CREATE TABLE IF NOT EXISTS recurring_billing (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id integer NOT NULL REFERENCES trainer_clients(id) ON DELETE CASCADE,
  cycle text NOT NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL,
  vat_rate_bps integer NOT NULL DEFAULT 2100,
  kor_applied boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date date,
  payment_term_days integer NOT NULL DEFAULT 14,
  active boolean NOT NULL DEFAULT true,
  billed_through date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recurring_billing_trainer_idx ON recurring_billing (trainer_clerk_id);
CREATE INDEX IF NOT EXISTS recurring_billing_client_idx ON recurring_billing (client_id);

CREATE TABLE IF NOT EXISTS trainer_invoices (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id integer NOT NULL REFERENCES trainer_clients(id) ON DELETE RESTRICT,
  athlete_clerk_id text,
  invoice_number text,
  invoice_date date,
  period_start date,
  period_end date,
  service_date date,
  due_date date,
  client_snapshot jsonb,
  business_snapshot jsonb,
  description text NOT NULL DEFAULT '',
  amount_excl_cents integer NOT NULL DEFAULT 0,
  vat_breakdown jsonb,
  amount_incl_cents integer NOT NULL DEFAULT 0,
  kor_applied boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'concept',
  template_version integer,
  recurring_billing_id integer,
  sent_at timestamptz,
  paid_at timestamptz,
  paid_cents integer NOT NULL DEFAULT 0,
  credit_note_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_invoices_number_uq ON trainer_invoices (trainer_clerk_id, invoice_number);
CREATE INDEX IF NOT EXISTS trainer_invoices_trainer_idx ON trainer_invoices (trainer_clerk_id);
CREATE INDEX IF NOT EXISTS trainer_invoices_client_idx ON trainer_invoices (client_id);

CREATE TABLE IF NOT EXISTS trainer_invoice_lines (
  id serial PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES trainer_invoices(id) ON DELETE CASCADE,
  service_id integer,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL,
  vat_rate_bps integer NOT NULL DEFAULT 2100,
  amount_cents integer NOT NULL,
  evidence_work_object_id integer
);
CREATE INDEX IF NOT EXISTS trainer_invoice_lines_invoice_idx ON trainer_invoice_lines (invoice_id);

CREATE TABLE IF NOT EXISTS trainer_credit_notes (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  invoice_id integer NOT NULL REFERENCES trainer_invoices(id) ON DELETE RESTRICT,
  credit_number text NOT NULL,
  reason text NOT NULL,
  partial boolean NOT NULL DEFAULT false,
  amount_incl_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'verzonden',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_credit_notes_number_uq ON trainer_credit_notes (trainer_clerk_id, credit_number);
CREATE INDEX IF NOT EXISTS trainer_credit_notes_invoice_idx ON trainer_credit_notes (invoice_id);
