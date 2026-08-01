-- HERSTEL EN AANSLUITING TEAM_ABONNEMENT_01 (2026-08-01)
-- Rolmapping definitief: "medic" wordt "medical_staff"; "ploegleider" wordt
-- een aparte rolwaarde (geen datamigratie nodig — er bestonden op het moment
-- van wijziging 0 rijen met rol medic/teammanager/member/alleen_lezen in dev
-- én productie; de UPDATE hieronder is een idempotent vangnet).
-- Idempotent: veilig om meermaals te draaien.

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS medical_specialty text;

-- Vangnet: eventuele bestaande medic-toekenningen worden medical_staff.
UPDATE club_members SET role = 'medical_staff' WHERE role = 'medic';

-- Rollback (handmatig, alleen indien nodig):
--   UPDATE club_members SET role = 'medic' WHERE role = 'medical_staff';
--   ALTER TABLE club_members DROP COLUMN IF EXISTS medical_specialty;
