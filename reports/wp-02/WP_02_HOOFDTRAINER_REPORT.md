# WP-02 — Hoofdtraineruitbreiding

Scope afgeleid uit Governor Beslisblok 02 (rolsectie HOOFDTRAINER/COACH):
alles van trainer + trainers beheren binnen toegewezen organisatiecontext +
sporters en groepen verdelen + plan-/coachkwaliteit bewaken + geen
ongeautoriseerde medische/privédata + beoordelen zonder stil overschrijven.

## Gebouwd
1. **Sporters verdelen** — `POST /api/clubs/:id/teams/:teamId/members` en
   `POST /api/clubs/:id/groups/:groupId/members` staan nu ook open voor de
   clubrol `hoofdtrainer` (naast beheer/teammanager/groepstrainer). Audit
   ongewijzigd aanwezig (`teamindeling_gewijzigd`/`groepsindeling_gewijzigd`).
2. **Geen stil overschrijven** — `PUT /api/clubs/:id/trainings/:trainingId`
   schrijft nu een audit-detail: `eigenTraining`, bij andermans training ook
   `trainerVanTraining` + de gewijzigde `velden`.
3. **Hoofdtraineroverzicht** — nieuw `GET /api/clubs/:id/hoofdtrainer/overview`
   (guard: `canManageTrainerAssignments` = beheer + hoofdtrainer). Per trainer:
   naam, rol, team-/groepstoewijzingen, aantal toegewezen sporters,
   clubtrainingen laatste 30 dagen. BEWUST zonder gezondheids-, herstel- of
   privédata.
4. **UI** — `/club` toont voor de hoofdtrainer een sectie "Trainers in jouw
   organisatie" (organisatorische feiten + expliciete privacy-voetnoot).
5. **Bugfix onderweg** — teamindeling-upsert faalde met 500: partial unique
   index (`ended_at IS NULL`) vereist `targetWhere` in `onConflictDoUpdate`.

## Niet gedaan (bewust)
- Geen automatische inzage in individuele sportersdata voor de hoofdtrainer:
  individuele begeleiding blijft directe koppeling vereisen (WP-01C-regel).
- Geen apart beoordelingscijfer-systeem voor trainerwerk: de rolspec eist
  audittrail bij overschrijven, geen rating-product; dat zou een nieuw
  productbesluit zijn.

## Tests
`src/tests/hoofdtrainer-workspace.ts` (governor-fixtures, echte app):
H1 teamindeling (hoofdtrainer 201 / trainer 403), H2 groepsindeling,
H3 overview-toegang (hoofdtrainer+beheer 200 / trainer 403), H4 geen
gezondheids-/privévelden in overview, H5 audit-detail bij andermans training,
H6 buitenstaander overal geweigerd — **6/6 groen**.
Regressie: trainer-rights 20/20, admin-smoke 12/12, typecheck api + web schoon.
