# WP-01 — STAP 5: PLAN- EN ADVIESREGELS

Alle regels bleken al afgedwongen in de bestaande flow; er waren geen ontbrekende guards. Geen codewijziging in deze stap.

| Regel | Waar afgedwongen | Bewijs |
|---|---|---|
| Trainerplan leidend bij koppeling | compose-laag coach-first (race flow) + day-type-precedentie | bestaand ontwerp + test-day-type groen |
| Sparki analyseert/stelt voor, vervangt nooit stil | voorstellen zijn expliciete proposals; accepteren past pas toe | coach-cockpit: "voorstel: Sparki wijzigt niets zelf; accepteren past toe" ✓ |
| Wijziging door trainer krijgt audittrail | writeAudit op alle cockpit-mutaties (10 call-sites) | code-verificatie coach-cockpit.ts |
| Planadoptie maakt geen parallel plan | adoptie schrijft athlete-owned planned_workouts (source="coach", planId null), dedupe per datum+source, nooit overschrijven | coach.ts:366–451 + coach-cockpit-suite ✓ |
| Sporter ziet wat en door wie | source-label op elke training ("Jouw training"/coach vs Sparki) in sporter- en coachweergave | code-verificatie (source === "coach"-labels) |
| Autonome sportermodus ongewijzigd zonder trainer | plan-engine onaangeraakt; alleen leespaden coach-kant gewijzigd | diff stap 3 raakt geen plan-engine; test-feedback-adjust groen |

Cross-coach-grens: tweede gekoppelde coach kan trainingen van coach A niet aanraken (coach-cockpit-suite ✓).
