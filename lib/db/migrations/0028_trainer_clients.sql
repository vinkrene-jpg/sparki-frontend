-- SPARKI_BUILD_04 F2 — klant, sporter en betaler (BB-62). Idempotent.

CREATE TABLE IF NOT EXISTS trainer_clients (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_number integer NOT NULL,
  name text NOT NULL,
  client_type text NOT NULL DEFAULT 'particulier',
  address text,
  contact_name text,
  email text,
  phone text,
  company_name text,
  vat_number text,
  kvk_number text,
  payment_term_days integer,
  default_service_note text,
  note text,
  status text NOT NULL DEFAULT 'actief',
  client_clerk_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_clients_number_uq ON trainer_clients (trainer_clerk_id, client_number);
CREATE INDEX IF NOT EXISTS trainer_clients_trainer_idx ON trainer_clients (trainer_clerk_id);

CREATE TABLE IF NOT EXISTS client_athlete_links (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES trainer_clients(id) ON DELETE CASCADE,
  athlete_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  relation_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS client_athlete_links_client_idx ON client_athlete_links (client_id);
CREATE INDEX IF NOT EXISTS client_athlete_links_athlete_idx ON client_athlete_links (athlete_clerk_id);

CREATE TABLE IF NOT EXISTS billing_parties (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES trainer_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  email text,
  vat_number text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS billing_parties_client_idx ON billing_parties (client_id);
