-- 0004 — Coach privénotities (coach_private_notes)
-- Alleen zichtbaar voor de eigenaar-coach; nooit voor de sporter, andere
-- trainers of AI-engines. Toegang vereist een actieve directe koppeling.
-- Puur additief: geen bestaande kolommen worden gewijzigd.

CREATE TABLE IF NOT EXISTS coach_private_notes (
  id              serial PRIMARY KEY,
  owner_coach_clerk_id text NOT NULL
    REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  athlete_clerk_id text NOT NULL
    REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  body            text NOT NULL,
  context         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_private_notes_owner_pair_idx
  ON coach_private_notes (owner_coach_clerk_id, athlete_clerk_id);
