-- SPARKI_BUILD F11 DEEL 1 — centrale bestands- en medialaag afmaken.
--
-- Generiek versiebeheer op de bestaande files-tabel (geen tweede opslag):
--   • logical_id       — stabiele id die alle versies van één logisch bestand
--                        deelt (bij de eerste versie = eigen id). Zo kan ELK
--                        bestand "vervangen zonder historieverlies".
--   • superseded_by_id — wijst naar de NIEUWERE file-rij die deze versie heeft
--                        vervangen (NULL = actuele/laatste versie). Oude versies
--                        blijven bewaard en downloadbaar voor bevoegden zolang
--                        ze niet zijn ingetrokken (revoked_at).
--
-- retention_category bestond al (F7); geen kolomwijziging nodig, alleen de
-- generieke categorieënset is nu in code vastgelegd (fileRetentionCategories).
--
-- Dedupe (F11 §2) gebruikt de bestaande sha256+size_bytes; we voegen een index
-- toe zodat "bestaand object van dezelfde eigenaar" snel te vinden is. Geen
-- fysieke ontdubbeling in de opslag zelf: een gedeeld object_path wordt door de
-- applicatielaag hergebruikt, intrekken werkt per files-rij.

ALTER TABLE files ADD COLUMN IF NOT EXISTS logical_id integer;
ALTER TABLE files ADD COLUMN IF NOT EXISTS superseded_by_id integer;

-- Bestaande rijen: elke rij is (zonder keten) een op zichzelf staande versie.
-- Zet logical_id gelijk aan de eigen id waar nog niet ingevuld.
UPDATE files SET logical_id = id WHERE logical_id IS NULL;

CREATE INDEX IF NOT EXISTS files_logical_idx ON files (logical_id);
CREATE INDEX IF NOT EXISTS files_owner_sha_idx ON files (owner_clerk_id, sha256, size_bytes);
