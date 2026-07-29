# BESLISBLOK 02 — FASE 5: CLUB VERSUS TEAM (FUNCTIONEEL MODEL)

Datum: 29 juli 2026 · Machineleesbaar: `governance/club-team-feature-model-v1.json`.
Geen prijzen; per functie staat de eerlijke bouwstatus — geen verkooptekst alsof functies af zijn.

## Kernbesluit

Club en Team zijn **twee productprofielen op hetzelfde organisatiemodel** (zie fase 3): één tabellenset, ander profiel. Een club kan opwaarderen naar Team zonder datamigratie.

## CLUB — laagdrempelige club- en acquisitielaag

| Functie | Basis in code | Status |
|---|---|---|
| Leden verbinden | `club_members` + joinCode | gebouwd |
| Basisgroepen | `club_groups` | gebouwd |
| Clubkalender | `club_trainings`, `club_race_events` | gebouwd |
| Uitnodigingen | invitations (club_*-types), limieten óók bij accept | gebouwd |
| Communicatie | `club_messages` per scope | gebouwd |
| Eenvoudige aanwezigheid | `club_training_signups` | gebouwd |
| Veilige jeugd-/ouderkoppeling | `club_consents` + parent-laag, fail-closed | gebouwd |
| Trainer koppelen | trainer-rol + `club_trainer_assignments` | gebouwd |
| Beperkte beheeromgeving | `/club/beheer` (owner/admin) | gebouwd (scherm CURRENT_STATE_NOT_APPROVED) |
| Kennismaking met Sparki | leden gebruiken eigen (Gratis) sporterapp | gebouwd |

Bewust **niet** in Club: meerdere selecties, hoofdtrainer-kwaliteitsbewaking, ploegleider-/mechanieker-werkruimtes, live koerscontext per team, rapportages, diepe ledenanalyse.

## TEAM — professioneel betaald product

| Functie | Basis | Eerlijke status |
|---|---|---|
| Meerdere selecties | `club_teams` + parent_team_id (uitbreiding) | fundament nodig |
| Trainers + hoofdtrainer | contextrollen + assignments | rollen gebouwd, werkruimte niet |
| Rollen & verantwoordelijkheden | role-capability-matrix-v1 | model klaar |
| Individuele + groepstraining | bulkplanner + club_trainings team-scoped | deels gebouwd |
| Aanwezigheid & uitvoering | signups + plan-execution-koppeling | deels gebouwd |
| Wedstrijdkamer | `race_rooms` multi-user-fase | single-user gebouwd |
| Ploegleider | teammanager-rol + teamscope | fundament nodig |
| Mechanieker | mechanieker-rol + materiaal per renner | fundament nodig |
| Live koerscontext | live-location (audience team) + volgauto | bouwstenen gebouwd, teamrechten niet |
| Materiaal per renner | garage + mechanieker-toewijzing | sporter-eigen gebouwd |
| Rapportages | zelfde analyse-engines, teampresentatie | niet gebouwd |
| Audit & rechtenbeheer | `club_audit_log` + beheer-UI | log gebouwd, UI beperkt |
| Diepere analyse & coaching | zelfde engines, teampresentatie | niet gebouwd |

## Grensregels

1. Team omvat alles van Club.
2. Jeugd-/consentregels identiek in beide profielen — veiligheid is nooit productonderscheid.
3. Sporterdata blijft van de sporter: Team koopt werkruimte en organisatie, nooit inzage voorbij consent.
4. Status per functie blijft eerlijk zichtbaar tot het werkpakket dat hem bouwt is afgerond.
