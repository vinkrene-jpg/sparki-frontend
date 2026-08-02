-- F11 DEEL 2 — omlegging van module-uploads naar de centrale bestandslaag.
--
-- Puur ADDITIEF en NULLABLE: bestaande rijen blijven ongewijzigd werken (lazy
-- koppeling — geen destructieve backfill). Nieuwe uploads lopen door de centrale
-- veiligheidspoort (registerFile) en vullen deze kolommen met de centrale
-- files-id (bron van waarheid, intrekbaar via files.revoked_at).

-- Journey-media: centrale files-rij per (afbeeldings-)media. Video's blijven
-- buiten de centrale her-encoding-poort en houden file_id NULL.
ALTER TABLE "journey_media"
  ADD COLUMN IF NOT EXISTS "file_id" integer;

-- Photo Lab: centrale files-rij van de originele upload.
ALTER TABLE "photo_lab_uploads"
  ADD COLUMN IF NOT EXISTS "original_file_id" integer;

-- Materiaalcoach: centrale files-id's per foto, parallel aan photo_paths.
ALTER TABLE "material_analyses"
  ADD COLUMN IF NOT EXISTS "photo_file_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Trainer-briefpapier: centrale files-rij van het geüploade briefpapier.
ALTER TABLE "trainer_letterheads"
  ADD COLUMN IF NOT EXISTS "file_id" integer;

-- Input Center: bijlagen dragen hun centrale file_id in de attachments-JSONB
-- (geen kolomwijziging nodig; het type is uitgebreid met een optioneel fileId).
