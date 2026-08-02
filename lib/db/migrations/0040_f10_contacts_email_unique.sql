-- SPARKI_BUILD_01 F10 (PD-3) — racebestendige e-maildeduplicatie.
--
-- Aanvulling op 0039: naast het clerkId-anker (uniek waar niet-null) leggen we
-- óók op databaseniveau vast dat één genormaliseerd, niet-leeg e-mailadres maar
-- bij één contact kan horen. Zonder deze index kunnen twee gelijktijdige
-- creates met hetzelfde e-mailadres beide slagen (race). De applicatie
-- normaliseert e-mail al (lowercase, getrimd) vóór opslag; de index gebruikt
-- lower(trim(...)) zodat hij óók bestand is tegen niet-genormaliseerde rijen.
--
-- Niet-destructief. Als er onverhoopt al dubbelen bestaan, faalt het aanmaken
-- van de index — draai dan eerst de ontdubbeling. In dev is gecontroleerd dat
-- er GEEN dubbelen zijn.

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_primary_email_norm_uq"
  ON "contacts" (lower(trim("primary_email")))
  WHERE "primary_email" IS NOT NULL AND trim("primary_email") <> '';
