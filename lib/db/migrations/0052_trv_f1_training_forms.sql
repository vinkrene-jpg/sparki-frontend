-- TRAININGSVORMEN_01 F1 (TRV-26/TRV-61): bibliotheek van trainingsvormen.
-- Additief en omkeerbaar (TRV-89): drie nieuwe tabellen, niets bestaands geraakt.

CREATE TABLE IF NOT EXISTS training_forms (
  id serial PRIMARY KEY,
  slug text NOT NULL,
  naam text NOT NULL,
  discipline text NOT NULL,
  categorie text NOT NULL,
  belastingssoort text NOT NULL,
  doel text,
  effect text,
  uitleg text,
  gebruik text,
  veelgemaakte_fouten text,
  onderbouwingsniveau text NOT NULL DEFAULT 'praktijkvorm',
  onderbouwingstoelichting text NOT NULL DEFAULT 'nog niet ingeschaald',
  minimum_leeftijd integer,
  eigenaar_type text NOT NULL DEFAULT 'sparki',
  eigenaar_clerk_id text REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  zichtbaarheid text NOT NULL DEFAULT 'sparki',
  vereist_afspraak boolean NOT NULL DEFAULT false,
  versie integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'concept',
  laatste_controle timestamptz,
  media_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS training_forms_slug_uq ON training_forms (slug);
CREATE INDEX IF NOT EXISTS training_forms_discipline_idx ON training_forms (discipline);
CREATE INDEX IF NOT EXISTS training_forms_eigenaar_idx ON training_forms (eigenaar_clerk_id);

CREATE TABLE IF NOT EXISTS training_form_parameters (
  id serial PRIMARY KEY,
  form_id integer NOT NULL REFERENCES training_forms(id) ON DELETE CASCADE,
  duur_min integer,
  duur_max integer,
  duur_standaard integer,
  intensiteitsmaat text,
  intensiteit_min integer,
  intensiteit_max integer,
  intensiteit_standaard integer,
  herhalingen_min integer,
  herhalingen_max integer,
  pauze_min integer,
  pauze_max integer,
  blokken jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS training_form_parameters_form_uq ON training_form_parameters (form_id);

CREATE TABLE IF NOT EXISTS training_form_sources (
  id serial PRIMARY KEY,
  form_id integer NOT NULL REFERENCES training_forms(id) ON DELETE CASCADE,
  brontype text NOT NULL,
  titel text NOT NULL,
  uitgever text,
  jaar integer,
  url text,
  laag text NOT NULL DEFAULT 'vindlaag',
  toelichting text
);
CREATE INDEX IF NOT EXISTS training_form_sources_form_idx ON training_form_sources (form_id);
