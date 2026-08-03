-- TRAINEN_DOELEN_SEIZOEN_01 F7: seizoenslaag — vormblokken per sporter.
CREATE TABLE IF NOT EXISTS season_blocks (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  phase text NOT NULL,
  label text NOT NULL,
  anchor_date date,
  anchor_title text,
  source text NOT NULL DEFAULT 'afgeleid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS season_blocks_clerk_idx ON season_blocks (clerk_id, start_date);
