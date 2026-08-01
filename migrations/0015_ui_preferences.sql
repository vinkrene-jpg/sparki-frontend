-- MEDIA_UITLEG_01 F1 — per-gebruiker UI-voorkeuren (Verminder beweging).
-- Niet-destructief: alleen CREATE TABLE IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS "ui_preferences" (
  "clerk_id" text PRIMARY KEY REFERENCES "user_profiles"("clerk_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  "reduce_motion" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
