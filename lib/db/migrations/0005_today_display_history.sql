-- 0005 — Vandaag-weergavehistorie (today_display_history), WP-T1.
-- Presentatiegeheugen voor de Today Orchestrator: welke boodschap-sleutel
-- wanneer getoond is, of erop geklikt is en of de actie is afgerond.
-- Datumkolommen zijn Amsterdamse kalenderdagen (YYYY-MM-DD).
-- Puur additief: geen bestaande kolommen worden gewijzigd.

CREATE TABLE IF NOT EXISTS today_display_history (
  id             serial PRIMARY KEY,
  clerk_id       text NOT NULL
    REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  item_key       text NOT NULL,
  slot           text NOT NULL,
  first_shown_on date NOT NULL,
  last_shown_on  date NOT NULL,
  last_shown_at  timestamptz NOT NULL DEFAULT now(),
  days_shown     integer NOT NULL DEFAULT 1,
  clicked        boolean NOT NULL DEFAULT false,
  completed      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS today_history_user_item_idx
  ON today_display_history (clerk_id, item_key);
