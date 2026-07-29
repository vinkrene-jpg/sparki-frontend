---
name: Sparki trainer access tiers
description: Twee toegangstiers voor coaches/trainers — directe link vs. club-toewijzing; welke routes elk vereisen.
---

# Sparki trainer access tiers

## Besluit (29 juli 2026)
Club-toegewezen trainer heeft BEPERKTE rechten; directe coach-sporterlink geeft volledige individuele rechten.

## De twee functies

| Functie | Geldig voor | Gebruikt bij |
|---|---|---|
| `hasDirectCoachLink(coach, athlete)` | Alleen geaccepteerde `coach_athlete_links`-rij | Individuele cockpit, alle schrijfacties, berichten, analyse-feedback |
| `hasCoachAccess(coach, athlete)` | Directe link ÓF geldige clubtoewijzing | Sportersoverzicht (roster), dashboard-overzicht |

## Club-trainer mag WEL
- Sportersoverzicht en dashboard inzien
- Team-/groepstraining voorstellen (geen interface nog)
- Communiceren binnen team-/clubcontext

## Club-trainer mag NIET
- Individuele cockpit (signalen, trainingen, berichten, context-items)
- Plan adopteren / aanpassen
- Analyse-feedback geven op observaties van een sporter

**Why:** productbesluit na expliciete bevestiging. Vóór dit besluit gaf `hasCoachAccess` onbedoeld volledige individuele rechten aan club-toegewezen trainers.

**How to apply:** elke nieuwe per-atleet route of schrijfactie gebruikt `hasDirectCoachLink`, niet `hasCoachAccess`. Alleen roster- en dashboard-aggregaties mogen `hasCoachAccess`/`clubAssignedAthleteIds` gebruiken.

Zie ook: `docs/besluit-club-trainer-rechten.md`
