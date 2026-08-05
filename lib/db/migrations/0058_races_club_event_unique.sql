-- CLUB_AFRONDING_01 C4-onderzoek: de selectie-sync (club-race-sync.ts) upsert
-- op (clerk_id, club_event_id) met predicaat club_event_id IS NOT NULL, maar
-- de bijbehorende partiële unieke index bestond nergens — elke selectie-POST
-- faalde met 500.
--
-- Preflight (review): mocht historische data toch dubbele sync-rijen bevatten
-- (zelfde clerk_id + club_event_id), dan houden we de nieuwste (hoogste id)
-- en verwijderen de oudere dubbelen. Dit raakt uitsluitend rijen die door de
-- sync zijn aangemaakt (club_event_id gevuld); handmatige races hebben
-- club_event_id NULL en blijven altijd staan.
DELETE FROM races a
USING races b
WHERE a.club_event_id IS NOT NULL
  AND b.club_event_id IS NOT NULL
  AND a.clerk_id = b.clerk_id
  AND a.club_event_id = b.club_event_id
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS races_clerk_club_event_uq
  ON races (clerk_id, club_event_id)
  WHERE club_event_id IS NOT NULL;
