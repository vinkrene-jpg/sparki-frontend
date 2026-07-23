# Sparki — Validatie recente opdrachten

**Peildatum:** 23 juli 2026. Per recente opdracht: is het werk werkelijk in de code aanwezig én bewezen werkend (test/codebewijs)?

| Opdracht | Aanwezig in code (bewijs) | Bewezen werkend | Oordeel |
|---|---|---|---|
| Clubomgeving | `routes/club.ts`, `lib/club-permissions.ts`, 16 `club_*`-tabellen, `pages/club.tsx` + `club-beheer.tsx` | `test:club` **23/23** | **Verwerkt** |
| Coachomgeving | `routes/coach-cockpit.ts`, `coach_change_proposals`, `planned_workouts.coach_clerk_id`, `pages/coach-cockpit.tsx` | `test:coach-cockpit` **19/19** | **Verwerkt** |
| Ouderomgeving | `routes/parent.ts`, `lib/parent-permissions.ts`, `parent_*`-tabellen | `test:parent-environment` **16/16** + sharing-levels **13/13** | **Verwerkt** |
| Lab | `pages/lab.tsx`, `lib/derived-load.ts`, `routes/mental.ts`, radar met eerlijke null-assen | `test:session-analysis` **13/13**, `test:performance-radar` **7/7**, `test:mental` **15/15** | **Verwerkt** |
| AI-helpdesk | `routes/support.ts`, `lib/support/`, `support_tickets`/`helpdesk_turns`, web + mobiel scherm | `test:support-helpdesk` **21/21** | **Verwerkt** |
| Contextuele uitleg | `components/viz/uitleg.tsx` (UitlegDot), registry `src/lib/uitleg-content.ts` | `test:uitleg-content` groen | **Verwerkt** |
| Fietsscan | `routes/bike-scan.ts`, `bike_scans`/`bike_scan_frames`, client-side achtergrondverwijdering | `test:scan-quality` **8/8** (+ `test:mechanieker` **17/17**) | **Verwerkt** |
| Wedstrijdmodus | `sparki-mobile/lib/race-mode.ts`, `races.localLaps`, race-blok in `GET /api/routes/:id` | `race-mode.test.ts` **11/11** | **Verwerkt** |
| Technische wedstrijdgids | `engines/document-analysis` → puntvoorstellen met bron/pagina/betrouwbaarheid; `guide-diff.ts` → needsReconfirm | `test:race-points` **9/9** | **Verwerkt** |
| GPX-course-points | `lib/race-export/` (GPX-waypoints + FIT Course via `lib/fit-encode.ts`), validatie + round-trip | `test:race-export` **17/17** | **Verwerkt** |
| Routeopmerkingen | `lib/route-remarks.ts`, `GET /api/routes/:id/remarks`, ODbL-bron zichtbaar | `test:route-remarks` **17/17** | **Verwerkt** |
| Hoogteprofiel met schuifbalk | `elevation-profile.tsx` — `InteractiveElevationProfile`, sleep/schuif, gradiëntkleuren, markers | ingest-tests **4/4 + 4/4 + 5/5**; interactie is frontend (codebewijs r.165–195) | **Verwerkt** |
| Koppeling kaart ↔ hoogteprofiel | `positionKm`-prop in profiel (r.165–195) ↔ `RouteMap` `positionKm`/`focusPoint` | Codebewijs (geen aparte suite; visueel gedrag) | **Verwerkt** |
| Wegtypen racefiets/gravel/MTB | `lib/route-surfaces.ts` r.333–414: `BikeType = racefiets\|gravelbike\|mountainbike`, `computeBikeSuitability` met transparante redenen | `test:route-surfaces` **24/24** | **Verwerkt** |

**Conclusie:** alle 14 gecontroleerde recente opdrachten zijn werkelijk verwerkt in de actuele code en (op twee frontend-interactiepunten na, die op codebewijs steunen) door geslaagde tests gedekt. Geen enkele opdracht bleek alleen op papier te bestaan.
