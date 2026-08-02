-- SPARKI_BUILD_04 F7 — briefpapier/templates (4.6). Idempotent.

CREATE TABLE IF NOT EXISTS trainer_letterheads (
  id serial PRIMARY KEY,
  trainer_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  file_path text NOT NULL,
  file_format text NOT NULL,
  -- Doorlopende templateversie per trainer; verzonden facturen dragen de
  -- gebruikte versie en veranderen nooit meer (F7 harde regel).
  template_version integer NOT NULL,
  margins_ok boolean NOT NULL DEFAULT false,
  readability_ok boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trainer_letterheads_version_uq
  ON trainer_letterheads (trainer_clerk_id, template_version);
