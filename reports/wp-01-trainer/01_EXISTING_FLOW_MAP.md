# WP-01 — STAP 1: BESTAANDE COACHFLOW IN KAART

Datum: 29 juli 2026. Geen productcode gewijzigd in deze stap.

## Frontend (artifacts/sparki)

| Onderdeel | Route | Bestand / component |
|---|---|---|
| CoachHome (start) | `/` en `/vandaag` bij `activeRole==='coach'` | `src/components/sparki/coach-home.tsx` (CoachHome, AthleteCard, BulkPlanner) |
| Cockpit per sporter | `/coach/athletes/:athleteId/cockpit` | `src/pages/coach-cockpit.tsx` (SignalCard, PlanningSection, ProposalCard, MessagesSection, ContextSection) |
| Adviesplan/planadoptie | `/coach/athletes/:athleteId/plan` | `src/pages/coach-athlete-plan.tsx` (SuggestedDay "Overnemen in mijn plan", ObservationRow) |
| Uitnodigingen | `/invitations` (+ `/invite/:token`) | `src/pages/invitations.tsx` (StatusBadge: pending/accepted/expired/revoked) |
| Rolwisselaar | Instellingen-sheet (YouPage) | `src/contexts/UserContext.tsx`; App.tsx kiest homepage op `profile.activeRole`; `src/lib/chapters.ts` `chaptersForRole` (coach-nav: Vandaag · Samen · Uitnodigen · Profiel) |
| Berichten | in cockpit | `useCoachMessages` / `useSendCoachMessage` |
| Privénotities/context | in cockpit | `useCoachContextItems` → `coach_context_items` |

Sporterlijst gevoed door `useCoachDashboard` → `GET /api/coach/dashboard`.

## API (artifacts/api-server)

- `GET /api/coach/athletes` (coach.ts:70) en `GET /api/coach/dashboard` — uitsluitend via `coach_athlete_links` met `status='accepted'`.
- Cockpit-routes (coach-cockpit.ts) — link-check per read; cross-coach: coach mag alleen eigen aangemaakte trainingen wijzigen (coach-cockpit.ts:495).
- Deleniveaus `lib/sharing.ts`: none/summary/full; **<16 zonder parent_consent ⇒ geforceerd none** (sharing.ts:112).
- Privénotities: context-memory `visibility='private'`; gedeelde memories geprojecteerd zonder rauwe velden.
- Planadoptie: bestaand pad, source="coach", dedupe op datum+source.
- Rolwissel: `PUT /api/auth/me/role` (auth.ts) + audit.
- **Bevinding:** `club_trainer_assignments` bestaat in schema en fixtures, maar wordt in de API **nog nergens** gebruikt om de sporterlijst te bepalen — dit is precies het gat dat WP-01 stap 3 additief vult (unificatie directe links + club-toewijzing).

## Tests (bestaand bewijs)

| Test | Bewijst |
|---|---|
| coach-parent-link-isolation (13) | alleen geaccepteerde link geeft toegang; revoke sluit direct |
| coach-parent-sharing-levels | none/summary/full-gedrag per surface |
| coach-parent-share-nothing | "deel niets" ⇒ lege payloads + 403 op adoptie |
| coach-parent-private-memory | alleen visibility=shared+enabled zichtbaar |
| coach-parent-shared-raw-fields | nooit rauwe statement/response naar coach |
| links-end/unlink-isolation | beëindigen alleen door eigenaar; scoped |
| cross-account-isolation (19) | fundamentele sporter-isolatie |
| governor-role-foundation (11) | fixtures, club A≠B, einde lidmaatschap, multi-role |

**Gat:** geen directe regressietest op `PUT /api/auth/me/role` (rolwissel) — wordt in stap 7 meegenomen in de nieuwe trainer-testsuite.

## Controlepoort stap 1

- Concrete routes, componenten, API's, tabellen en tests benoemd: ✔
- Geen tweede model nodig: ✔ — de bestaande link-laag + club-toewijzingen dekken alles; stap 3 unificeert alleen leespaden.
- Geen onverklaard rechtenconflict: ✔ — enige spanning is dat clubrol `trainer` nog geen sporters oplevert; dat is het geplande werk, geen conflict.
