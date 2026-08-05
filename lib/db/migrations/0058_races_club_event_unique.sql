-- CLUB_AFRONDING_01 C4-onderzoek: de selectie-sync (club-race-sync.ts) upsert
-- op (clerk_id, club_event_id) met predicaat club_event_id IS NOT NULL, maar
-- de bijbehorende partiële unieke index bestond nergens — elke selectie-POST
-- faalde met 500. Niet-destructief: eerst eventuele dubbelen loskoppelen is
-- niet nodig (sync-rijen zijn per definitie uniek aangemaakt); bij bestaande
-- dubbelen faalt de CREATE en lossen we dat handmatig op i.p.v. data te wissen.
CREATE UNIQUE INDEX IF NOT EXISTS races_clerk_club_event_uq
  ON races (clerk_id, club_event_id)
  WHERE club_event_id IS NOT NULL;
