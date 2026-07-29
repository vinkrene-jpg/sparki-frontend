# WP-01C stap 1 — Rechtenmatrix trainerwerkruimte

Datum: 29 juli 2026

## Relatievormen
| Relatie | Bron | Geldigheid |
|---|---|---|
| `direct_coach_link` | `coach_athlete_links.status='accepted'` | tot beëindiging link |
| `club_trainer_assignment` / `team_trainer_assignment` | `club_trainer_assignments` (team- of groepsrij) | op leesmoment: trainer actief clublid + sporter actief team/groepslid + sporter actief clublid |

Beide relatievormen worden in code samen vastgelegd als `TrainerRelation { directLink, clubTeamAssignment }` (team- en groepstoewijzing lopen door dezelfde read-time validatie in `clubAssignedAthleteIds`).

## Capabilitymatrix (pure functie `trainerCapabilities` in `lib/sharing.ts`)
| Capability | Directe coach | Alleen club-/teamtrainer |
|---|---|---|
| `hasAnyTrainerVisibility` (sporter identificeren, roster) | ✅ | ✅ |
| `individual_read` → `canReadIndividualCoachData` (cockpit, herstel/gezondheid binnen deelniveau) | ✅ | ❌ |
| `individual_plan_propose` → `canProposeIndividualTraining` (individuele training, planadoptie, voorstel-besluit) | ✅ | ❌ |
| `direct_message_individual` → `canMessageIndividually` | ✅ | ❌ |
| Coachafspraak/begeleidingscontext vastleggen → `canWriteCoachContext` | ✅ | ❌ |
| `private_note_create` + `private_note_read_own` → `canUsePrivateNotes` | ✅ (alleen eigen notities) | ❌ |
| `team_plan_propose` → `canProposeTeamTraining` | alleen mét toewijzing | ✅ |
| `team_message` → `canUseTeamCommunication` (club_messages-scopes) | alleen mét toewijzing | ✅ |

Aanvullende, ongewijzigde lagen bovenop élke capability:
- **Deelniveau** `coachSharingLevel` (none/summary/full; jeugd <16 zonder ouderconsent fail-closed `none`).
- **Club-/organisatie-isolatie**: clubroutes gaten op club-lidmaatschap en `readableScopeFilter` (`lib/club-permissions.ts`, `routes/club.ts`).

## Geen tweede rechtenengine
De matrix is één pure functie in het bestaande `lib/sharing.ts`; de DB-guards (`hasDirectCoachAccess`, `hasClubTeamTrainerAccess`, bestaand `hasCoachAccess` = zichtbaarheid) hergebruiken de bestaande link-/toewijzingsqueries. Clubrollen (`club-permissions.ts`) blijven de bron voor club-interne rechten.

## Matrixtest
`src/tests/trainer-rights.ts` (sectie A) test de pure matrix op alle vier relatiecombinaties, los van de database. Verdere DB-vangnettests volgen in stap 5 in hetzelfde bestand.
