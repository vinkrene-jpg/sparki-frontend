-- Besluitenpatch 2026-08-01 (hoofdstuk B): clubbeheer kan een buiten de app
-- gegeven oudertoestemming registreren (relatie club_namens_ouder) met een
-- verplichte vastlegging van wie en hoe. Idempotent.
ALTER TABLE club_consents ADD COLUMN IF NOT EXISTS granted_note text;
