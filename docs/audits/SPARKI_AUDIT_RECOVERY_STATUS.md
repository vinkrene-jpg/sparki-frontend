# SPARKI_AUDIT_RECOVERY_AND_COMPLETION_01 — statusregister

Gestart: 2026-08-01. Start-SHA: `fcaf35ac` (laatst gepushte main).
Bronnen gelezen: docs/build-packages (alle *_MIRROR_TOETS), docs/SPARKI_EVIDENCE_MATRIX_v1.1.yaml, docs/SPARKI_MODULE_BUILD_MATRIX.md, docs/ONTWIKKEL_HERSTELLOG.md, .agents/open-choices.md, takenlijst, commitgeschiedenis.

## Blok A — open-puntenmatrix
- `MIRROR_FINDINGS_REGISTER.csv` aangemaakt (23 bevindingen: 6×P0, 7×P1, 10×P2).
- `MIRROR_OPEN_FIXES.md` aangemaakt (alleen open P0/P1).
- Dubbele opdrachten voorkomen: bestaande herstelopdrachten per bevinding verwezen (SPARKI_BUILD_01 F1/F2, taak #547, MEDIA_UITLEG_01-herstelprotocol).

## Afgeronde punten (met bewijs)

| Finding | Herstel-SHA | Bewijs | Prod |
|---|---|---|---|
| F-P0-06 migratie 0017 op prod | 2cf546be (bron) | prod-leescontrole 01-08: consent_grants-tabel + ended_at-kolommen aanwezig; migratie idempotent (IF NOT EXISTS) met rollbackpad in bestand | JA |
| F-P0-02 (coach/ouder-deel) | fcaf35ac | test-links-end-isolation 3/3; test-cross-account-isolation 19/19 (run 01-08) | code wacht op publish |
| F-P1-02 mobiele wizard | cd214832 | e2e routeplanner-mobiel-v2, 62 checks 375/412/desktop | wacht op publish |
| F-P1-03 wandelen/hiken | e8773aba + fcaf35ac | e2e wandelen-hiken 17/17; admin-smoke 13/13; route-alternates 9/9; typecheck groen; SANITY_5B-rapport | wacht op publish |

## Productie-realiteit (gemeten 01-08)
- Prod-URL: https://sparki-frontend.replit.app (autoscale, public, build succesvol).
- `GET /api/version` prod: `commit: "onbekend"`, **geen buildtijd-veld** → prod draait een build van vóór `e8773aba`. De Publish-klik van 01-08 (~12:41 UTC) dateert van vóór de laatste pushes.
- Gevolg: wandelen/hiken, mobiele wizard-fixes en versie-embed staan nog NIET live. **Nieuwe Publish nodig.**
- Migratie 0018 (routes.sport) gaat bij die Publish automatisch mee via Replit's schema-diff (agent mag prod-DDL niet zelf draaien; 0017 stond al op prod).

## Openstaande productbesluiten (geregistreerd, geen bouwstop)
- K1–K6 governance-correctiepakket: vraag staat uit bij René (`.agents/open-choices.md`).
- MEDIA_UITLEG_01 F3: wacht op rechtenvrij testmediabestand (input-gap; afhankelijk van K6).

## Volgorde van uitvoering
1. ✅ Blok A (dit register).
2. P0: F-P0-03 rol-URL-gate (audit+fix+test) → F-P0-01 consentservice-dekking → F-P0-04/05 matrices.
3. P1: F-P1-06 web version.json (klein, direct) → F-P1-05 analyse mobiel → F-P1-04 jobfout-scenario's → F-P1-07 CI.
4. P2-blokken (D t/m M) daarna, onafhankelijk waar mogelijk.

Per afgerond blok wordt hier start-SHA, eind-SHA, tests+exitcodes, evidence en prod-status bijgeschreven. Mirror toetst parallel; rapporteren is geen wachtmoment.
