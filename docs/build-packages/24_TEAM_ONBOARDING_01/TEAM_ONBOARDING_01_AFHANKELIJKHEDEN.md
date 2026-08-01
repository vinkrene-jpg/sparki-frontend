# TEAM_ONBOARDING_01 — AFHANKELIJKHEDEN

## 1. Exact nodig
| Nodig | Vindplaats | Waarvoor | Zonder dit |
|---|---|---|---|
| Rolwaarden `ploegleider`, `medical_staff` + functietype | `CLUB_RECHTEN_01` | organogram-kaarten en roltoekenning | kaarten tonen rollen die niet bestaan |
| Centrale rechten- en scopelaag | `CLUB_RECHTEN_01` | alle autorisatie | tweede rechtenlaag |
| Organisatiecontainer | `schema/club.ts` — `clubs`, `club_members`, `club_teams`, `club_groups`, `club_seasons` | organisatietype, selecties, groepen, seizoen | tweede organisatiesysteem |
| Onboardingpatroon | `CLUB_ONBOARDING_01`, commit `66a9931` | conceptstatus, hervatten, activatiepoort | tweede onboardingmachine |
| Uitnodigingsmechanisme | `routes/invitations.ts` | uitnodigingen | tweede mechanisme |
| `admin_ops_log` | `schema/admin-ops-log.ts` | audit op roltoekenning en activering | geen bewijs achteraf |
| Lege-toestandscontract | `DATA_TRUST_01` | de vier lege toestanden | verzonnen takenlijsten |

## 2. Verplicht MIRROR_PROVEN vóór start
1. **`CLUB_RECHTEN_01`** — het rolmodel met `ploegleider`, `medical_staff` en het functietype. Dit is een harde poort: zonder de rollen kan geen kaart worden getekend.
2. `DATA_TRUST_01` — lege toestanden en herkomst; dit pakket toont ledengegevens.
3. `ROUTE_PAKKET_01` — rechtenresolver en niet-legacy testidentiteiten.

`CLUB_ONBOARDING_01` hoeft niet Mirror-bewezen te zijn, maar het patroon eruit wordt wel hergebruikt. Loopt daar nog een herstelronde, stem dan af — bouw geen afwijkende tweede variant.

## 3. Restpunten die niet blokkeren
| Restpunt | Gevolg |
|---|---|
| `PLOEGLEIDER_01` nog niet gebouwd | seizoensbezetting werkt; wedstrijdbezetting is bewust afwezig |
| `TEAM_MECHANIEKER_01` nog niet gebouwd | `mechanieker` bestaat als rol; de materiaalflow volgt daar |
| `JEUGD_OUDER_01` nog niet gebouwd | jeugdleden uitnodigen mag, markeer ze als in afwachting van toestemming |
| Medische teamflow nog niet gebouwd | `medical_staff` bestaat als rol; toegang blijft dicht tot toestemming |
| `TEAM_ABONNEMENT_01` nog niet hertoetst | onboarding werkt; betaling is een aparte laag |
| Seizoensperiode niet formeel vastgesteld | configureerbaar maken en markeren als besluitpunt |
| `DOCUMENTEN_COMMUNICATIE_01` nog niet uitgevoerd | eenvoudige uitnodigings- en bevestigingsmails volstaan |

Een restpunt is pas een blokkade wanneer het punt 1, 2 of 3 uit hoofdstuk 2 raakt.

## 4. Positie in de reeks
Volgens de vastgestelde bouwvolgorde: `CLUB_RECHTEN_01` → Mirror → `CLUB_ONBOARDING_01` → **`TEAM_ONBOARDING_01`** → `PLOEGLEIDER_01` → `TEAM_MECHANIEKER_01` → medische teamflow → team-abonnement hertoetsen.
