---
name: Sparki hoofdtraineruitbreiding
description: Hoofdtrainer-rol in de clubomgeving — verdelen, overzicht, audittrail-regels
---

# Hoofdtraineruitbreiding (clubomgeving)

- Hoofdtrainer = clubRole, werkt UITSLUITEND binnen de eigen club-context (ctxOr403 + canManageTrainerAssignments). Individuele sportersdata blijft directe coach-koppeling vereisen — hoofdtrainer-rol geeft dat nooit automatisch.
- **Verdelen**: hoofdtrainer mag team- én groepsindeling wijzigen (naast beheer/teammanager/groepstrainer).
- **Geen stil overschrijven**: wijzigen van andermans clubtraining schrijft audit-detail `eigenTraining:false` + `trainerVanTraining` + gewijzigde `velden`. **Why:** rolspec Beslisblok-02 eist beoordelen-met-audittrail, geen rating-productlaag (bewust niet gebouwd — zou nieuw productbesluit zijn).
- **Overzicht** `/clubs/:id/hoofdtrainer/overview`: alleen organisatorische feiten (toewijzingen, sportersaantallen, trainingsaantallen 30d); gezondheids-/herstel-/privévelden bewust afwezig én getest via banned-words-check. Tellen gebeurt bulk (twee ledenqueries + in-memory), nooit per-trainer helper-calls (N+1).
- **Trap**: `club_team_members` unique index is partial (`ended_at IS NULL`) — elke onConflictDoUpdate daarop MOET `targetWhere` meegeven of de insert 500't.
- Test: `hoofdtrainer-workspace` (governor-fixtures, echte app, via shell run-test).
