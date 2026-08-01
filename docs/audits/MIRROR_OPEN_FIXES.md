# MIRROR_OPEN_FIXES — actuele open herstelpunten (P0/P1)

Bijgewerkt: 2026-08-01. Bron: `MIRROR_FINDINGS_REGISTER.csv` (volledige matrix, ook P2).
Regel: dit bestand bevat uitsluitend nog niet afgeronde P0/P1-punten. Afgerond = verplaatst naar `SPARKI_AUDIT_RECOVERY_STATUS.md` met herstel-SHA.

## P0

| ID | Punt | Status | Volgende stap |
|---|---|---|---|
| F-P0-01 | Consentservice overal gebruikt | deels → audit gedaan (zie statusregister); leeftijdsdefinitie nu ÉÉN pad: dev.ts eigen kopie weg, parent-permissions.athleteAgeTier delegeert aan consent-service.getAgeClass (13/13 sharing-levels groen) | rest: privacy_settings-init-writes beoordeeld als instellingen (geen consent-besluiten) — documenteren in DATA_TRUST-matrix |
| F-P0-02 | Relatiehistorie endedAt op álle relatietypen (ook vriend/club/team), heropening = nieuwe periode | deels bewezen (coach/ouder groen 01-08: links-end 3/3, cross-account 19/19) | zelfde toets voor club/team/vriend-relaties; e2e beëindigde ouderrelatie = taak #547 |
| ~~F-P0-03~~ | ~~/rol-start/<rol> alleen bij rolbezit~~ | **KLAAR** — rolbezit-poort (globale rollen + actieve clubrollen, fail-closed) in `541d03f0`; e2e wp-f3-rolstart 10/10 incl. geen-toegang-zonder-structuurlek | — |
| F-P0-04 | DATA_TRUST_01 volledige testmatrix | deels | matrix afronden, gevonden problemen herstellen |
| F-P0-05 | ABONNEMENT_01 volledige entitlementmatrix, fail-closed, Stripe test/live gescheiden | deels | matrixtest 12 rollen/tiers client+server |
| ~~F-P0-06~~ | ~~Migratie 0017 naar prod~~ | **KLAAR** — prod geverifieerd 01-08 (consent_grants + ended_at aanwezig) | — |

## P1

| ID | Punt | Status | Volgende stap |
|---|---|---|---|
| ~~F-P1-01~~ | ~~Rolstartschermen: onbekende/lege rolparams~~ | **KLAAR** — onbekende rol = eerlijke melding (e2e-bewezen); lege param valt op onbekend-pad | — |
| F-P1-02 | Mobiele routeplanner-wizard standaard | GEBOUWD+BEWEZEN | wacht op nieuwe Publish (prod draait oude build) |
| F-P1-03 | Wandelen/Hiken alle fases | GEBOUWD+BEWEZEN (nav op wandeltempo eerlijk open) | nieuwe Publish; migratie 0018 gaat automatisch mee via publish-flow |
| ~~F-P1-04~~ | ~~Routegeneratie-jobs eindigen expliciet~~ | **KLAAR** — test:route-generation-errors 5/5 (ongeldige aanvraag→expliciete fout, onbekend id 404, ownership 404, finishJob idempotent, crash→502) | — |
| ~~F-P1-05~~ | ~~Analyse mobiel~~ | **KLAAR** — e2e/tests/analyse-mobiel-overflow.mjs: 375px+412px, alle 5 tabbladen met echte kliks, 12/12 geen horizontale overflow (productiebuild) | — |
| F-P1-06 | Productieversie | code KLAAR — /api/version én web /version.json (sha+buildtijd+omgeving+service, lokaal bewezen) | na Publish prod-curl bewijzen |
| F-P1-07 | CI start niet op PR #2/#3/#4 | open | connector mist workflow-scope; webeditor-route (zie github-actions-ci-env) |

## Vasthouden (hard stops, blok N)
Alleen het direct afhankelijke blok stopt bij: dataverlies, cross-account/consentlek, verzonnen persoonsgegevens, onveilige jeugd/medische werking, destructieve migratiefout zonder rollback, betaalstromen via Sparki, blijvend rode verplichte tests, echt nieuw productbesluit. Onafhankelijke blokken gaan door.
