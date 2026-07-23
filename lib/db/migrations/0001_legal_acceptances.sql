-- Migratie 0001 — legal_acceptances (additief, idempotent, niet-destructief).
-- Acceptatiebewijs per (gebruiker, documentsoort, versie) voor de verplichte
-- privacy- en voorwaardenacceptatie. Ontbrekend bewijs = niet geaccepteerd.
-- Veilig herhaald uit te voeren; bestaande data wordt nooit gewijzigd of
-- verwijderd.

CREATE TABLE IF NOT EXISTS "legal_acceptances" (
  "id" serial PRIMARY KEY,
  "clerk_id" text NOT NULL,
  "kind" text NOT NULL,
  "version" text NOT NULL,
  "accepted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "source" text NOT NULL DEFAULT 'onbekend',
  "revoked_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "legal_acceptances_clerk_kind_idx"
  ON "legal_acceptances" ("clerk_id", "kind");
