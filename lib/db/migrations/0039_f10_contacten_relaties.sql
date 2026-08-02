-- SPARKI_BUILD_01 F10 (PD-3) — centrale contacten- en relatielaag.
--
-- Volledig additief / niet-destructief:
--   1. Nieuwe tabellen: contacts, contact_relations, contact_merge_review.
--   2. Nullable contact_id-verwijzingen op bestaande bronnen (trainer_clients,
--      billing_parties, emergency_contacts). Bestaande kolommen blijven intact;
--      niets wordt gesloopt. De bronnen gaan VERWIJZEN, niet dupliceren.
--
-- Er wordt in deze migratie GEEN data verplaatst of samengevoegd. Het vullen
-- van contacts/relaties gebeurt door het aparte migratiescript (eerst dry-run,
-- rapport naar René; de echte run volgt pas na akkoord).

-- ── 1. contacts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contacts" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_id" text,
  "primary_email" text,
  "display_name" text NOT NULL,
  "phone" text,
  "kind_tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "source_note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Eén contact per accountidentiteit; vele NULLs toegestaan onder de UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_clerk_uq"
  ON "contacts" ("clerk_id") WHERE "clerk_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "contacts_primary_email_idx"
  ON "contacts" ("primary_email");

-- ── 2. contact_relations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contact_relations" (
  "id" serial PRIMARY KEY NOT NULL,
  "from_contact_id" integer NOT NULL REFERENCES "contacts"("id") ON DELETE cascade,
  "to_contact_id" integer NOT NULL REFERENCES "contacts"("id") ON DELETE cascade,
  "relation_type" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at" timestamp with time zone,
  "source_note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contact_relations_from_idx"
  ON "contact_relations" ("from_contact_id");
CREATE INDEX IF NOT EXISTS "contact_relations_to_idx"
  ON "contact_relations" ("to_contact_id");
-- Eén actieve relatie van dit type tussen dit paar; historie mag meermaals.
CREATE UNIQUE INDEX IF NOT EXISTS "contact_relations_active_uq"
  ON "contact_relations" ("from_contact_id", "to_contact_id", "relation_type")
  WHERE "ended_at" IS NULL;

-- ── 3. contact_merge_review ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contact_merge_review" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "source_id" text,
  "contact_id" integer REFERENCES "contacts"("id") ON DELETE set null,
  "candidate_contact_ids" integer[],
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "decision" text,
  "decided_target_contact_id" integer REFERENCES "contacts"("id") ON DELETE set null,
  "decided_by_clerk_id" text,
  "decided_at" timestamp with time zone,
  "decision_note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contact_merge_review_status_idx"
  ON "contact_merge_review" ("status");
CREATE INDEX IF NOT EXISTS "contact_merge_review_source_idx"
  ON "contact_merge_review" ("source", "source_id");

-- ── 4. Nullable verwijzingen op bestaande bronnen (additief) ─────────────────
ALTER TABLE "trainer_clients"   ADD COLUMN IF NOT EXISTS "contact_id" integer;
ALTER TABLE "billing_parties"   ADD COLUMN IF NOT EXISTS "contact_id" integer;
ALTER TABLE "emergency_contacts" ADD COLUMN IF NOT EXISTS "contact_id" integer;
