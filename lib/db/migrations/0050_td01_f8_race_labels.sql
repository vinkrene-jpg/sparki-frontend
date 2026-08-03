-- TRAINEN_DOELEN_SEIZOEN_01 F8: ploegbelang + eigen rol als gescheiden labels.
ALTER TABLE races ADD COLUMN IF NOT EXISTS team_importance text;
ALTER TABLE races ADD COLUMN IF NOT EXISTS own_role text;
