-- DATABRONNEN_EN_FTP_01 (05-08-2026)
-- H4: duur in seconden op training_sessions (TSS rekent voortaan exact).
-- H3/§3: gedownsamplede echte reeksen bij connector-activiteiten (vermogen,
-- hartslag, cadans …) zodat NP/hartslagspoor uit echte samples komen.

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS duration_sec integer;
ALTER TABLE connector_activities ADD COLUMN IF NOT EXISTS streams jsonb;
