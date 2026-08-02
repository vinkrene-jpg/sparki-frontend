-- F11-01 — Sparki World media-engine op de centrale bestandslaag.
--
-- Puur ADDITIEF en idempotent: bestaande rijen blijven ongewijzigd werken.
-- Gegenereerde world-media bytes worden voortaan via lib/files.ts (registerFile)
-- geregistreerd en publiek geserveerd; virtual_media.file_id koppelt de rij aan
-- de centrale files-rij (bron van waarheid voor intrekking + retentie).

-- 1. Zichtbaarheid op de centrale files-rij: default "private"; world-media
--    krijgt "public" zodat het serve-pad het aan elke ingelogde gebruiker mag
--    tonen (dezelfde regel als de world-routes: de wereld-feed is voor iedereen
--    zichtbaar). Intrekking (revoked_at) blijft fail-closed, óók voor public.
ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'private';

-- 2. Systeem-eigenaar voor alle Sparki World-media. Geen echte, inlogbare
--    gebruiker: een synthetisch systeemprofiel puur zodat de files.owner_clerk_id
--    FK bevredigd is. Idempotent (ON CONFLICT). Nooit een login/rol die iets
--    doet — alleen eigenaar-veld voor systeem-eigen bestanden.
INSERT INTO "user_profiles" ("clerk_id", "email", "roles", "active_role")
VALUES ('sparki-world', 'sparki-world@system.local', ARRAY['athlete']::text[], 'athlete')
ON CONFLICT ("clerk_id") DO NOTHING;

-- 3. Koppeling van elke virtual_media-rij naar de centrale files-rij. NULLABLE:
--    mislukte generaties (geen bytes) en bestaande rijen (lui gekoppeld bij de
--    eerstvolgende serve) houden file_id NULL. Geen destructieve backfill.
ALTER TABLE "virtual_media"
  ADD COLUMN IF NOT EXISTS "file_id" integer;
