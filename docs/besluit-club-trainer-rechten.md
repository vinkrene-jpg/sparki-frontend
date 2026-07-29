# Besluit: Rechten van een club-toegewezen trainer

**Datum:** 29 juli 2026  
**Status:** Definitief — vastgelegd na expliciete bevestiging door René

---

## Beslissing

Een club-toegewezen trainer (via `club_trainer_assignments`) heeft **beperkte** rechten,
niet dezelfde als een direct gekoppelde coach.

### Wat een club-toegewezen trainer WEL mag

| Bevoegdheid | Toelichting |
|---|---|
| Sportersoverzicht inzien | Ziet de toegewezen sporters in het roster/dashboard (naam, status, gedeelde samenvattingsdata) |
| Gedeelde team-/clubinformatie bekijken | Teamtrainingen, clubinformatie, gedeelde context |
| Team- of groepstraining voorstellen | Richting de hele groep/het team, niet individueel per sporter |
| Communiceren binnen team-/clubcontext | Berichten op groeps-/teamniveau |

### Wat een club-toegewezen trainer NIET mag

| Beperking | Reden |
|---|---|
| Geen volledige individuele coachcockpit | Vereist directe coachkoppeling (`coach_athlete_links`) |
| Geen individuele planaanpassing | Alleen de direct gekoppelde coach past het individuele plan aan |
| Geen toegang tot niet-gedeelde herstel-, gezondheids- of privécoachdata | Valt buiten teamcontext; `coachSharingLevel` blijft gelden |
| Geen individuele berichten buiten team-/clubcontext | Persoonlijke één-op-één berichtenstroom vereist directe koppeling |

### Directe coach behoudt volledige rechten

De direct gekoppelde coach behoudt alle individuele coachrechten binnen het deelniveau van
de sporter (`dataSharingCoach`). De club-toewijzing raakt deze relatie niet.

---

## Toegangsmodel in code

Twee expliciete toegangstiers in `lib/sharing.ts`:

### Tier 1 — `hasDirectCoachLink(coachClerkId, athleteClerkId)`

Controleer of er een geaccepteerde `coach_athlete_links`-rij bestaat.  
**Vereist voor:** individuele cockpit-routes, alle schrijf-/actie-endpoints,
persoonlijke berichten, analyse-feedback op andermans observaties.

### Tier 2 — `hasCoachAccess(coachClerkId, athleteClerkId)`

Directe link ÓF geldige club/teamtoewijzing.  
**Gebruikt voor:** sportersoverzicht (`GET /athletes`), dashboard (`GET /dashboard`).

---

## Gevolgen voor bestaande routes

Na dit besluit zijn de volgende routes bijgewerkt (waren: `hasCoachAccess`,
zijn nu: `hasDirectCoachLink`):

| Route | Bestand |
|---|---|
| `GET /api/coach/athletes/:athleteId` | coach.ts |
| `GET /api/coach/athletes/:athleteId/plan` | coach.ts |
| `GET /api/coach/athletes/:athleteId/context` | coach.ts |
| `POST /api/coach/athletes/:athleteId/plan/adopt` | coach.ts |
| `POST /api/coach/athletes/:athleteId/plan/decision` | coach.ts |
| `gateAthlete()` (dekt alle cockpit per-atleet routes) | coach-cockpit.ts |
| `POST /api/coach/workouts/bulk` | coach-cockpit.ts |
| `GET /api/coach/athletes/:athleteId/messages` | coach-cockpit.ts |
| `POST /api/coach/athletes/:athleteId/messages` | coach-cockpit.ts |
| `POST /api/coach/messages/reply` | coach-cockpit.ts |
| Coach-feedback op observaties van anderen | analysis-feedback.ts |

De roster- en dashboard-routes (`GET /athletes`, `GET /dashboard`) gebruiken
`clubAssignedAthleteIds` direct of via `hasCoachAccess` — club-toegewezen trainers
zien hun sporters daar wél, maar kunnen niet doorklikken naar de individuele cockpit.

---

## Achtergrond

Vóór dit besluit gaf `hasCoachAccess` (die club-toewijzing en directe links gelijk
behandelde) club-toegewezen trainers onbedoeld volledige individuele coachrechten.
WP-01 bouwde dit als fundament; het productbesluit over de rechtengrens moest nog
expliciet worden vastgelegd. Dit document is het resultaat.

Zie ook: `reports/wp-01-trainer/WP_01_FINAL_REPORT.md`
