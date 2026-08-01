MIRROR_OPEN_FIXES — openstaande correcties

Bijgewerkt: 2026-08-01. Bron: docs/audits/MIRROR_FINDINGS_REGISTER.csv (Pass 1). Alleen openstaande punten; gesloten/BEWEZEN GOED bevindingen staan alleen in het register.

P0 ONMIDDELLIJK

Geen P0-bevindingen aangetroffen in Pass 1. Sectie E van DATA_TRUST_01 (isolatie/lekken, cross-account, ouder-kind, dev-impersonatie) is met live server-side probes getoetst en MIRROR_PROVEN: geen datalek, geen cross-account-lek, geen consent-lek, geen entitlementlek gevonden.

P1 EERSTVOLGENDE HERSTELSTROOM

MIR-2026-001 (F3-GERICHT-HERSTEL-01): Onbekende-rolmelding toont lege aanhalingstekens in plaats van de echte rolnaam. Status: HERSTEL NODIG, overgedragen, wacht op herstel-SHA.

MIR-2026-002 (F3-GERICHT-HERSTEL-01): Directe rol-start toegang zonder rolbezit moet herbevestigd worden na de F3-fix, onderdeel van dezelfde drie-punts hertoets.

MIR-2026-003 (MIR-FIX-CI-01): Branch protection op main vereist drie status checks (validators, typecheck, admin-smoke) maar de workflows-map bestaat niet: geen enkele PR kan ooit groene CI krijgen. Bevestigd opnieuw live op PR 5, waar de drie vereiste checks op Waiting for status to be reported staan.

MIR-2026-004 (MIR-FIX-VERSION-01): Productie versie-endpoint retourneert commit onbekend in plaats van een echte SHA.

MIR-2026-007 (MIR-FIX-FIXTURES-01): Geen testfixture voor nutrition specialist of medical staff, blokkeert toetsing van die rollen.

MIR-2026-009, herverificatie aanbevolen: Mobiele routeplanner niet zichtbaar of geactiveerd; Wandelen en Hiken verborgen door flags; routegeneratiejob kan blijven hangen. Overgenomen uit eerdere sessie, nog niet in Pass 1 live herverifieerd.

MIR-2026-010, herverificatie aanbevolen: MEDIA_UITLEG_01 F3 volledig overgeslagen; F4-endpoint gebouwd maar niet aangesloten. Overgenomen uit eerdere sessie, nog niet in Pass 1 live herverifieerd.

P2 BUNDELEN PER MODULE

MIR-2026-006 (MIR-FIX-FIXTURES-01): Cross-team isolatie, team A tegenover team B, niet apart bewijsbaar omdat beide testfixture-teams dezelfde manager delen.

PRODUCTBESLUIT NODIG

MIR-2026-008: PRODUCT_EXPERIENCE_REALITY_01, audit gestart maar nog niet uitgevoerd. Wacht op batchgewijze start per sequencing-instructie, na DATA_TRUST_01, ABONNEMENT_01 en de PR-afhandeling.

NIET BEWIJSBAAR

MIR-2026-006: cross-team isolatie, zie hierboven, bewijsherstelopdracht MIR-FIX-FIXTURES-01 uitstaand.

MIR-2026-007: nutrition specialist en medical staff fixtures ontbreken, bewijsherstelopdracht MIR-FIX-FIXTURES-01 uitstaand.

OPENSTAANDE HERSTELOPDRACHTEN, SAMENGEVAT

F3-GERICHT-HERSTEL-01 omvat MIR-2026-001 en MIR-2026-002. Status: overgedragen, wacht op herstel-SHA.

MIR-FIX-CI-01 omvat MIR-2026-003. Status: gereed voor overdracht.

MIR-FIX-VERSION-01 omvat MIR-2026-004. Status: gereed voor overdracht.

MIR-FIX-FIXTURES-01 omvat MIR-2026-006 en MIR-2026-007. Status: gereed voor overdracht.
