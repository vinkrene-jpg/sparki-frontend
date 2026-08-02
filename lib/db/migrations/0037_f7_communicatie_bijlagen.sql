-- SPARKI_BUILD_01 F7 — Communicatie met bijlagen.
--
-- Bouwt voort op de bestaande berichtenlaag (club_messages/club_message_reads)
-- en voegt toe:
--   1. Generiek bestandsmodel `files` (F11-voorschot) — metadata only, bytes in
--      object storage. Gesnift content-type, versie, ingetrokken-status,
--      retentiecategorie.
--   2. Bijlagen op berichten (`message_attachments`) — file of link.
--   3. Generalisatie van club_messages naar een tweede lijn (context
--      "coach_link": zelfstandige trainer <-> gekoppelde sporter), zonder een
--      tweede berichtensysteem.
-- Niet-destructief: uitsluitend nieuwe tabellen/kolommen (nullable of met
-- default), bestaand gedrag verandert niet.

-- ── 1. Generiek bestandsmodel ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "files" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_clerk_id" text NOT NULL REFERENCES "user_profiles"("clerk_id") ON DELETE cascade ON UPDATE cascade,
  "object_path" text NOT NULL,
  "original_name" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL DEFAULT 0,
  "sha256" text,
  "version" integer NOT NULL DEFAULT 1,
  "revoked_at" timestamp with time zone,
  "revoked_by_clerk_id" text,
  "retention_category" text NOT NULL DEFAULT 'algemeen',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "files_owner_idx" ON "files" ("owner_clerk_id");
CREATE INDEX IF NOT EXISTS "files_object_path_idx" ON "files" ("object_path");

-- ── 2. Berichten generaliseren (context + coach_link-deelnemers) ─────────────
-- club_id wordt nullable: voor context "coach_link" is er geen club. Voor
-- context "club" blijft club_id verplicht (afgedwongen op het schrijf-pad).
ALTER TABLE "club_messages" ALTER COLUMN "club_id" DROP NOT NULL;
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "context" text NOT NULL DEFAULT 'club';
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "coach_clerk_id" text
  REFERENCES "user_profiles"("clerk_id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "athlete_clerk_id" text
  REFERENCES "user_profiles"("clerk_id") ON DELETE cascade ON UPDATE cascade;
CREATE INDEX IF NOT EXISTS "club_messages_coach_link_idx"
  ON "club_messages" ("coach_clerk_id", "athlete_clerk_id");

-- ── 3. Bijlagen op berichten ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "message_attachments" (
  "id" serial PRIMARY KEY NOT NULL,
  "message_id" integer NOT NULL REFERENCES "club_messages"("id") ON DELETE cascade,
  "kind" text NOT NULL DEFAULT 'bestand',
  "file_id" integer,
  "link_url" text,
  "link_title" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "message_attachments_message_idx" ON "message_attachments" ("message_id");
