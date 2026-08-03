-- F6 — VOG en jeugdveiligheid: bewijsreferentie (kenmerk), géén documentopslag.
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS vog_reference text;
