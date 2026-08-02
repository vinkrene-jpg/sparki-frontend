-- SPARKI_BUILD_04 F1 — zelfstandige trainer: onderneming en profiel.
-- Idempotent; geen bestaande data geraakt.

CREATE TABLE IF NOT EXISTS trainer_business (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  company_name text,
  trade_name text,
  address text,
  kvk_number text,
  vat_number text,
  iban text,
  logo_path text,
  letterhead_template_id integer,
  contact_email text,
  contact_phone text,
  payment_term_days integer,
  kor_active boolean NOT NULL DEFAULT false,
  invoice_prefix text,
  next_invoice_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_business_clerk_uq ON trainer_business (clerk_id);

CREATE TABLE IF NOT EXISTS trainer_profiles (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  display_name text,
  bio text,
  specialisations jsonb,
  certifications jsonb,
  availability_note text,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_clerk_uq ON trainer_profiles (clerk_id);
