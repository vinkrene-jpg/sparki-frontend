-- AIE2 F1 — adviesdossier (guarded, non-destructief)
CREATE TABLE IF NOT EXISTS advice_dossiers (
  id serial PRIMARY KEY,
  clerk_id varchar(64) NOT NULL,
  advice_type varchar(48) NOT NULL,
  advice_key varchar(160) NOT NULL,
  title text NOT NULL,
  advice_text text NOT NULL,
  based_on jsonb NOT NULL,
  sources_used jsonb NOT NULL,
  sources_excluded jsonb NOT NULL,
  rules_applied jsonb NOT NULL,
  knowledge_refs jsonb NOT NULL,
  confidence_factors jsonb NOT NULL,
  confidence_level varchar(24) NOT NULL,
  alternatives_considered jsonb NOT NULL,
  why_alternative_rejected text NOT NULL,
  risks jsonb NOT NULL,
  valid_until timestamp,
  computed_by jsonb NOT NULL,
  ai_involvement jsonb NOT NULL,
  audience varchar(24) NOT NULL DEFAULT 'sporter',
  outcome text,
  outcome_at timestamp,
  status varchar(40) NOT NULL DEFAULT 'actief',
  dedupe_key varchar(200) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS advice_dossiers_dedupe_idx ON advice_dossiers (dedupe_key);
CREATE INDEX IF NOT EXISTS advice_dossiers_user_idx ON advice_dossiers (clerk_id, advice_type, created_at);
CREATE INDEX IF NOT EXISTS advice_dossiers_key_idx ON advice_dossiers (clerk_id, advice_key);
