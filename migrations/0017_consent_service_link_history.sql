-- SPARKI_BUILD_01 F1+F2 — centrale toestemmingsservice + relatiehistorie.
-- Idempotent; rollback onderaan. Het oude model (privacy_settings,
-- parent_athlete_links) blijft onaangetast — dat is het rollbackpad (M-1).

-- F1: consent_grants — één centrale toestemmingsregistratie.
CREATE TABLE IF NOT EXISTS consent_grants (
  id serial PRIMARY KEY,
  subject_clerk_id text NOT NULL REFERENCES user_profiles(clerk_id) ON DELETE CASCADE ON UPDATE CASCADE,
  grantor_clerk_id text REFERENCES user_profiles(clerk_id) ON DELETE SET NULL ON UPDATE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  granted_at timestamptz,
  revoked_at timestamptz,
  valid_until timestamptz,
  legal_basis text,
  source text,
  reconfirmation_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_grants_subject_idx ON consent_grants (subject_clerk_id);

-- F1: backfill bevestigde ouder-koppelingen → granted parental_consent (idempotent).
INSERT INTO consent_grants (subject_clerk_id, grantor_clerk_id, type, status, granted_at, legal_basis, source)
SELECT l.athlete_clerk_id, l.parent_clerk_id, 'parental_consent', 'granted', l.consent_confirmed_at,
       'ouderlijk gezag', 'migratie:parent_athlete_links'
FROM parent_athlete_links l
WHERE l.status = 'accepted' AND l.consent_confirmed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM consent_grants g
    WHERE g.subject_clerk_id = l.athlete_clerk_id
      AND g.grantor_clerk_id = l.parent_clerk_id
      AND g.type = 'parental_consent'
      AND g.source = 'migratie:parent_athlete_links'
  );

-- F2 (BB-09): relatiehistorie — beëindigen = ended_at zetten, rij blijft.
ALTER TABLE coach_athlete_links  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE coach_athlete_links  ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE parent_athlete_links ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE parent_athlete_links ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE friend_links         ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE friend_links         ADD COLUMN IF NOT EXISTS ended_at timestamptz;
UPDATE coach_athlete_links  SET started_at = created_at WHERE started_at > created_at;
UPDATE parent_athlete_links SET started_at = created_at WHERE started_at > created_at;
UPDATE friend_links         SET started_at = created_at WHERE started_at > created_at;

-- Rollback (M-1):
--   DROP TABLE IF EXISTS consent_grants;
--   ALTER TABLE coach_athlete_links  DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS ended_at;
--   ALTER TABLE parent_athlete_links DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS ended_at;
--   ALTER TABLE friend_links         DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS ended_at;
