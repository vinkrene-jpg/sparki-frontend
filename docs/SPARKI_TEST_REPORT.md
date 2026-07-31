# Sparki — Testrapport (reviewbundel)

**Peildatum:** 23 juli 2026 · **Branch:** `main` · Alle runs uitgevoerd tegen de actuele code op deze omgeving.

## 1. Bouw- en typechecks

| Check | Commando | Resultaat |
|---|---|---|
| Typecheck (alle werkruimtes + libs) | `pnpm run typecheck` | **Geslaagd** — sparki, api-server, sparki-mobile, mockup-sandbox, scripts, libs |
| Webbuild (productie) | `pnpm --filter @workspace/sparki run build` | **Geslaagd** (29,1 s; bekende chunk-groottewaarschuwing, geen fout) |
| Backendbuild (esbuild CJS) | `pnpm --filter @workspace/api-server run build` | **Geslaagd** (9,5 s; 172+ outputbestanden incl. testbundels) |
| Mobiele validatie | `tsc --noEmit` + `check:prod-config` | **Geslaagd** — buildprofielen pilot/productie aanwezig, geen secrets in `eas.json` |
| Database | `pnpm --filter @workspace/db run build` (tsc) | **Geslaagd** |
| Lint | — | **Niet geconfigureerd**: geen `lint`-script in enige werkruimte (eerlijk vermeld; typecheck fungeert als statische poort) |

**Migraties:** het project gebruikt drizzle-kit push (dev) i.p.v. migratiebestanden; het schema (62 bestanden, 161 tabellen) compileert en de draaiende API-server bedient alle routes zonder schemafouten. Niet-destructieve wijzigingen zijn de vaste regel (afbouwregel 6).

## 2. Unit-/integratie-/end-to-endtests (uitgevoerd, sequentieel via shell)

| Test | Dekt | Resultaat |
|---|---|---|
| `test:club` (api) | Clubomgeving end-to-end | **23/23** |
| `test:coach-cockpit` (api) | Coachomgeving | **19/19** |
| `test:parent-environment` (api) | Ouderomgeving | **16/16** |
| `test:coach-parent-sharing-levels` (api) | Sharing-niveaus coach/ouder | **13/13** |
| `test:support-helpdesk` (api) | AI-helpdesk | **21/21** |
| `test:uitleg-content` (web) | Contextuele uitleg | **Geslaagd** (node:test, 0 fail) |
| `test:scan-quality` (web) | Fietsscan-kwaliteit | **8/8** |
| `test:session-analysis` (web) | Lab-sessieanalyse | **13/13** |
| `test:performance-radar` (web) | Lab-radar (eerlijke null-assen) | **7/7** |
| `test:mental` (api) | Lab mentale reflecties | **15/15** |
| `test:mechanieker` (api) | Mechanieker/garage | **17/17** |
| `race-mode.test.ts` (mobiel, node --test) | Wedstrijdmodus (rondeteller, finish-cue) | **11/11** |
| `test:race-points` (api) | Technische gids → punten, kaartcontrole | **9/9** * |
| `test:race-export` (api) | GPX/FIT-course-points-export + round-trip | **17/17** |
| `test:route-remarks` (api) | Routeopmerkingen (OSM) | **17/17** |
| `test:route-surfaces` (api) | Wegtypen + geschiktheid racefiets/gravel/MTB | **24/24** |
| `test:session-elevation-profile` (api) | Hoogteprofieldata per sessie | **5/5** |
| `test:ingest-elevation-profile` (api) | Hoogte-ingest GPX | **4/4** |
| `test:ingest-elevation-fit-tcx` (api) | Hoogte-ingest FIT/TCX | **4/4** |

\* Eerste run gaf 0/9 doordat de shell-omgeving `DEV_AUTH_BYPASS=true` miste (expliciete vereiste in de testheader; de testworkflows zetten dit zelf). Met de juiste omgeving: 9/9. Geen productfout.

**Frontendkoppeling kaart ↔ hoogteprofiel** (geen aparte testworkflow): geverifieerd in code — `elevation-profile.tsx` r.165–195 (`positionKm`-prop, geklemde positie) gekoppeld aan `RouteMap` (`positionKm`/`focusPoint`); sleep/schuif synchroniseert de kaartpositie.

## 3. Totaal

- **Uitgevoerd:** 6 bouw-/typechecks + 19 testsuites (≈ 243 scenario's/asserties).
- **Geslaagd:** alles (100%). **Mislukt:** 0 (één her-run nodig wegens ontbrekende dev-omgevingsvariabele, geen productdefect).
- Niet alle ±130 aanwezige testsuites zijn opnieuw gedraaid; de selectie dekt exact de door de opdracht genoemde gebieden plus de bouwketen. De overige suites draaien via hun eigen workflows/scripts en stonden groen bij hun laatste oplevering (zie `replit.md` per module).

## 7. Aanvulling testmatrix 31-07-2026 — rechtenbesluiten 30-07
- `test:trainer-assignment-messages` (nieuw, 9 scenario's): assignment-only
  trainer 403 + nul rijen op alle individuele berichten-/schrijfpaden; positieve
  controles (toewijzing echt, directe link 201). Uitgevoerd 31-07: 9/9 groen.
- `test:trainer-assignment-write-contract` (omgeklapt naar besluit B1):
  scenario 2 verwacht nu 403 + nul rijen. Uitgevoerd 31-07: 5/5 groen.
- Zie `docs/BESLUITENREGISTER_RENE_2026-07-30.md` voor de bijbehorende
  acceptatiecriteria per besluit (B1–B13).
