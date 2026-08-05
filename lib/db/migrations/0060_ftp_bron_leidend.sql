-- DATABRONNEN_EN_FTP_01 (05-08-2026) — H2/D2: herkomst + leidend-vlag per FTP-rij.
-- Rangorde van bronnen: trainer > sporter > sparki_afgeleid > import.
-- Niet-destructief: alleen kolommen toevoegen + bestaande rijen labelen.

ALTER TABLE ftp_history ADD COLUMN IF NOT EXISTS bron text NOT NULL DEFAULT 'sporter';
ALTER TABLE ftp_history ADD COLUMN IF NOT EXISTS leidend boolean NOT NULL DEFAULT true;

-- Bestaande rijen labelen op basis van test_type:
--   derived  -> sparki_afgeleid (eigen ondergrens-afleiding)
--   strava   -> import (extern profielveld)
--   overig   -> sporter (handmatig/test, in de app ingevoerd)
UPDATE ftp_history SET bron = 'sparki_afgeleid' WHERE test_type = 'derived' AND bron = 'sporter';
UPDATE ftp_history SET bron = 'import' WHERE test_type = 'strava' AND bron = 'sporter';

-- Achterhaalde afgeleide rijen zijn per definitie niet leidend.
UPDATE ftp_history SET leidend = false
WHERE test_type = 'derived' AND coalesce(notes, '') LIKE '[achterhaald]%' AND leidend = true;
