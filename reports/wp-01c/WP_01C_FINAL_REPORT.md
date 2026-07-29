# WP-01C — Eindrapport: rechtendifferentiatie en echte privénotities

Datum: 29 juli 2026 · Status: **WP_01C_RIGHTS_AND_PRIVATE_NOTES_READY**

## 1. Capabilityverschillen (vast besluit, geïmplementeerd)
- **Directe coach** (geaccepteerde link): alles individueel binnen het deelniveau — detail, plan, context, signalen, trainingen, voorstellen, individuele berichten, coachafspraken, privénotities.
- **Alleen club-/teamtrainer** (geldige toewijzing, geen link): sporter identificeren (naam/discipline/`relation:"team"` in roster & dashboard) + team-/clubscope (clubroutes ongewijzigd). GEEN cockpit, individuele data, individueel plan of individuele berichten.
- Unie bij beide; niets zonder relatie. Bron: `lib/sharing.ts` (`getTrainerRelation`, `trainerCapabilities`, `hasDirectCoachAccess`, `hasClubTeamTrainerAccess`).

## 2. Routes (zie 03_ROUTE_CAPABILITY_MAP.md)
Alle individuele routes in `coach.ts`, `coach-cockpit.ts` en `analysis-feedback.ts` eisen nu een directe koppeling (`gateAthlete` geeft een duidelijke 403 "Individuele begeleiding vereist een directe koppeling" voor team-only). Rosters/dashboard behouden de unie maar geven voor alleen-toewijzing uitsluitend basisinfo. `hasCoachAccess` is nog uitsluitend zichtbaarheidsbegrip.

## 3. Datamodel — additief: ja
Nieuwe tabel `coach_private_notes` (owner_coach_clerk_id, athlete_clerk_id, body, context, timestamps). Geen bestaande tabellen gewijzigd of hernoemd; `coach_context_items` blijft de transparante "Coachafspraak"-laag (UI-label was al "Afspraken & context").

## 4. Privénotitie-garanties (bewijs = testsuite B)
- Alleen eigenaar leest/wijzigt (owner-filter in elke query); niet overdraagbaar.
- Sporter, andere trainers, hoofdtrainer: nooit zichtbaar (B7/B8).
- Nooit in AI-context (`buildAthleteContext` raakt de tabel niet — functioneel getest B9).
- Nooit in sporterexport (eigenaar-only uitzondering in `account-privacy.ts`, B10; wél in trainer-eigen export, B11).
- Audit: alleen metadata (`privenotitie_aangemaakt/gewijzigd/verwijderd`), nooit inhoud.
- Einde koppeling trekt API-toegang direct in (guard op elke route, B13).
- UI: aparte sectie "Privénotities" met vaste copy "alleen zichtbaar voor jou", los van "Afspraken & context".

## 5. Testresultaten
- `trainer-rights`: 19/19 (A1–A4 matrix, B1–B15 vangnet).
- Regressie: trainer-workspace-isolation 6/6, governor-role-foundation 11/11, sharing-levels 13/13, share-nothing 15/15, private-memory 3/3, shared-raw-fields 3/3, links-unlink 5/5, links-end 3/3, cross-account 19/19, admin-smoke 12/12. Typecheck api + web schoon.

## 6. Commits
f7299eac (stap 1 matrix/guards) · cb1166d0 (stap 2+3 routes + kaart) · edc61c77 (stap 4 privénotitielaag) · stap 5 tests + dit rapport.

## 7. Publicatie-advies
Veilig te publiceren: puur additief + strengere guards. Let op: bestaande club-toegewezen trainers verliezen individuele cockpit-toegang die ze na WP-01 tijdelijk hadden — dat is precies het bedoelde besluit (sluit ook aan op taken #411/#412/#413).
