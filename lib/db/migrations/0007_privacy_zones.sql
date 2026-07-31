-- 0007 — Privacyzones routebibliotheek (opdracht René 31-07-2026 §7).
-- Gebruikersbeheerde gevoelige locaties (woning/werk/gevoelig): elke gedeelde
-- of getoonde routeweergave voor niet-eigenaren verwijdert punten binnen de
-- zone op leesmoment. Plus eigenaarskeuze routes.suggest_exclude: Sparki mag
-- deze route niet gebruiken voor automatische voorstellen.
-- Puur additief: geen bestaande kolommen worden gewijzigd.

CREATE TABLE IF NOT EXISTS privacy_zones (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'gevoelig',
  lat real NOT NULL,
  lon real NOT NULL,
  radius_m integer NOT NULL DEFAULT 750,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_zones_clerk_idx ON privacy_zones (clerk_id);

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS suggest_exclude boolean NOT NULL DEFAULT false;
