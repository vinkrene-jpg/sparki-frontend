# RELEASE_01 — AFHANKELIJKHEDEN

## 1. Exact nodig
| Nodig | Vindplaats | Waarvoor |
|---|---|---|
| Releasestraat | `scripts/release-check.mjs` | fasen uitbreiden, niet vervangen |
| Rolfixtures | `scripts/governor/create-role-test-fixtures.sh` | basis voor de personaset |
| Store-controle | `scripts/store-release-check.mjs` | mobiele eindcontrole |
| Back-up en herstel | `src/tests/backup-restore.ts` | herstelproef |
| Health | `routes/health.ts` | productiechecklist |
| Auditlog | `schema/admin-ops-log.ts` | bewijs van beheeracties tijdens de doorloop |

## 2. Verplicht MIRROR_PROVEN vóór start

Alle domeinpakketten. Een pakket zonder Mirror-rapport is in deze ronde niet toetsbaar; Mirror noteert dat en gaat door.

`ROUTE_PAKKET_01` t/m `02d` · `DATA_TRUST_01` · `ABONNEMENT_01` · `ABONNEE_ADMIN_01` · `DOCUMENTEN_COMMUNICATIE_01` · `TRAINER_CLUB_01` · `CLUB_ONBOARDING_01` · `CLUB_RECHTEN_01` · `CLUB_LEDEN_01` · `JEUGD_OUDER_01` · `TRAINER_KOPPELING_01` · `ACTIVITEITEN_01` · `MECHANIEKER_01` · `TRAINING_FLOW_01` · `COACH_ADAPTIEF_01` · `WEDSTRIJD_01` · `VOEDING_01` · `EBIKE_01` · `ANALYSE_01` · `AI_GRENZEN_01` · `AI_CONTEXT_01` · `AI_KWALITEIT_01` · `WANDELEN_01`

## 3. Restpunten die niet blokkeren
| Restpunt | Gevolg |
|---|---|
| Een storingsschakelaar niet te bouwen zonder productiepaden te raken | dat foutpad wordt met unittests gedekt en als niet-getoetst gemeld |
| Een domein zonder Mirror-rapport | niet toetsbaar in deze ronde; blokkeert de andere domeinen niet |
| Prestatiemeting onvolledig | meten en melden; dit pakket optimaliseert niet |
| Stripe nog niet live | de betaaldoorloop draait in testmodus; livegang is een apart besluit |
| Bewaartermijnen nog als besluitpunt gemarkeerd | blokkeert de doorloop niet, wél de betaalde publieke release |

Een restpunt is pas een blokkade wanneer het identiteit, rechten, privacy, data-trust of een betaalstatus raakt.

## 4. Positie
Dit is het laatste pakket. Het voegt niets toe en bewijst alleen. Wat het aantoont dat ontbreekt, gaat terug naar het domein dat het bouwde.
