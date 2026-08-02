-- SPARKI_BUILD_01 F8 — Clubdocumenten (versies + publicatie + zichtbaarheid).
--
-- Bouwt voort op de bestaande club_documents-tabel (HA-26/HA-27) en op de
-- F7-bestandenlaag (files). Voegt toe:
--   1. Rol-afhankelijke zichtbaarheid per document (leden_en_ouders default |
--      trainers_bestuur), plus current_version_id (actieve gepubliceerde versie)
--      en updated_at.
--   2. Versietabel club_document_versions met expliciete status (concept →
--      gepubliceerd), versienummer en publicatiedatum. Oude versies blijven
--      altijd bewaard.
--   3. NIET-DESTRUCTIEVE migratie van bestaande rijen: elke bestaande
--      club_documents-rij was al zichtbaar voor leden, dus wordt versie 1 en
--      DIRECT gepubliceerd (published_at = created_at). object_path/media_type
--      worden nullable (nieuwe uploads schrijven ze niet meer; de bytes leven
--      dan in de versietabel + files).
--
-- Alle wijzigingen zijn additief of niet-destructief (nullable / met default).

-- ── 1. club_documents: zichtbaarheid + actieve versie + updated_at ───────────
ALTER TABLE "club_documents" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'leden_en_ouders';
ALTER TABLE "club_documents" ADD COLUMN IF NOT EXISTS "current_version_id" integer;
ALTER TABLE "club_documents" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();
-- Legacy-kolommen worden voor nieuwe uploads niet meer geschreven: nullable maken.
ALTER TABLE "club_documents" ALTER COLUMN "object_path" DROP NOT NULL;
ALTER TABLE "club_documents" ALTER COLUMN "media_type" DROP NOT NULL;

-- ── 2. Versietabel ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_document_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_id" integer NOT NULL REFERENCES "club_documents"("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'concept',
  "file_id" integer,
  "object_path" text NOT NULL,
  "media_type" text NOT NULL,
  "size_bytes" integer,
  "uploaded_by_clerk_id" text NOT NULL,
  "published_at" timestamp with time zone,
  "published_by_clerk_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "club_document_versions_doc_idx" ON "club_document_versions" ("document_id");
CREATE UNIQUE INDEX IF NOT EXISTS "club_document_versions_number_unique"
  ON "club_document_versions" ("document_id", "version_number");

-- ── 3. Migratie bestaande rijen → versie 1, direct gepubliceerd ──────────────
-- Alleen rijen die nog geen versie hebben (idempotent) en die legacy-bytes
-- bezitten. Ze waren al zichtbaar voor leden, dus meteen gepubliceerd.
INSERT INTO "club_document_versions"
  ("document_id", "version_number", "status", "object_path", "media_type",
   "size_bytes", "uploaded_by_clerk_id", "published_at", "published_by_clerk_id", "created_at")
SELECT d."id", 1, 'gepubliceerd', d."object_path", d."media_type",
       d."size_bytes", d."uploaded_by_clerk_id", d."created_at", d."uploaded_by_clerk_id", d."created_at"
FROM "club_documents" d
WHERE d."object_path" IS NOT NULL
  AND d."media_type" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "club_document_versions" v WHERE v."document_id" = d."id"
  );

-- Wijs de zojuist gemigreerde versie 1 aan als de actieve gepubliceerde versie.
UPDATE "club_documents" d
SET "current_version_id" = v."id"
FROM "club_document_versions" v
WHERE v."document_id" = d."id"
  AND v."version_number" = 1
  AND d."current_version_id" IS NULL;
