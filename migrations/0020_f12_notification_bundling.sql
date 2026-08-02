-- SPARKI_BUILD F12 (NOT-01) — bundeling van meldingen per logisch object.
--
-- Ontdubbeling (dedupeKey) bestond al. Bundeling ontbrak: meerdere wijzigingen
-- aan HETZELFDE logische object (bijv. één wedstrijdplan) binnen een tijdvenster
-- moeten uitgroeien tot ÉÉN gebundelde melding ("7 wijzigingen in wedstrijdplan
-- X"), niet losse rijen. Kritieke categorieën (privacy/veiligheid) worden NOOIT
-- gebundeld — die krijgen bundle_key = NULL.
--
--   • bundle_key   — identificeert het logische object (category+source+object-
--                    referentie, afgeleid van dedupeKey/actionUrl). NULL = niet
--                    bundelbaar.
--   • bundle_count — aantal onderliggende gebeurtenissen dat de rij dekt
--                    (1 = losse melding; ≥ drempel = meegegroeide bundel).

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS bundle_key text;
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS bundle_count integer NOT NULL DEFAULT 1;

-- Snel de laatste open bundel/losse rij voor één object vinden binnen het
-- tijdvenster. Partieel: alleen bundelbare, nog-openstaande rijen.
CREATE INDEX IF NOT EXISTS notif_clerk_bundle_idx
  ON notifications (clerk_id, bundle_key, created_at)
  WHERE bundle_key IS NOT NULL AND resolved_at IS NULL;
