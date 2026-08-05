-- ANALYSE_UITBREIDING §3 — analyse op verzoek: bewaarde, terugleesbare analyses.
CREATE TABLE IF NOT EXISTS "analysis_requests" (
  "id" serial PRIMARY KEY,
  "clerk_id" varchar(64) NOT NULL,
  "kaarten" jsonb NOT NULL,
  "periode_days" integer NOT NULL,
  "data_digest" varchar(64) NOT NULL,
  "uitkomsten" jsonb NOT NULL,
  "tekst" text NOT NULL,
  "advice_dossier_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "analysis_requests_clerk_idx" ON "analysis_requests" ("clerk_id", "created_at");
CREATE INDEX IF NOT EXISTS "analysis_requests_digest_idx" ON "analysis_requests" ("clerk_id", "data_digest");
