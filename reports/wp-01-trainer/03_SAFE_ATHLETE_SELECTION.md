# WP-01 — STAP 3: VEILIGE SPORTERSELECTIE

## Wijziging (additief, geen tweede model)
- `lib/sharing.ts`: nieuw `clubAssignedAthleteIds(coachId)` — sporters via GELDIGE club/teamtoewijzing: expliciete rij in `club_trainer_assignments` + trainer actief clublid + sporter actief team/groepslid + sporter actief clublid; alles op leesmoment (nooit gecachet). Nieuw `hasCoachAccess(coach, athlete)` = geaccepteerde directe link ÓF geldige toewijzing.
- `routes/coach.ts`, `routes/coach-cockpit.ts`, `routes/analysis-feedback.ts`: alle 12 toegangschecks van `hasAcceptedCoachLink` → `hasCoachAccess`; roster (`/api/coach/athletes`) en dashboard (`/api/coach/dashboard`) tonen de UNIE van directe links + toewijzingen. Deelniveaus (`coachSharingLevel`, incl. jeugd-fail-closed) blijven onverkort per sporter gelden — zichtbaarheid ≠ data.
- Fixtures: sporters zijn nu actief teamlid van Team A (idempotent), zodat het toewijzingspad een echt leespad heeft.
- Geen client-side filtering als beveiliging: alle checks zitten server-side per read.

## Bewijs
Nieuwe test `trainer-workspace-isolation` — **6/6 groen** (1 herstelpoging: ontbrekende import in fixturescript):
1. trainer-1 toegang via link én teamtoewijzing;
2. trainer-2 (clublid zonder toewijzing/link) ziet niets;
3. buitenstaander ziet niets;
4. beëindigd teamlidmaatschap sluit toewijzingspad direct, directe link blijft;
5. beëindigd clublidmaatschap van de trainer sluit alle toewijzings-toegang;
6. jeugd zonder ouderconsent: zichtbaar in werkruimte, data "none" (fail-closed).

API-typecheck: 0 fouten.
