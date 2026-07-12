# Sparki — Auditonzekerheden (⚠-register)

Datum: 12 juli 2026. Alles wat in de auditdocumenten met ⚠ is gemarkeerd, met wat er nodig is om het zeker te maken. Niets hieronder is als feit gepresenteerd in de andere documenten.

## A. Bereikbaarheid / ingangen (UI) — grotendeels OPGELOST 12 juli 2026

| # | Onzekerheid | Uitkomst (geverifieerd via grep) |
|---|---|---|
| A1 | `/lab` (INZICHT) nav-ingang | **BEVESTIGD verborgen.** Enige interne link naar `/lab` komt uit `pages/core-playground.tsx` — zelf een verborgen prototype. Geen onderbalk- of headeringang. `/lab` is de facto onbereikbaar voor een normale renner. |
| A2 | `/geluid` ingang | **OPGELOST.** Gelinkt vanuit `pages/you.tsx` — bereikbaar via Jij/Profiel. Geen weesroute. |
| A3 | Mentale-veerkracht-kaart mount | **OPGELOST.** Gemount in `pages/lab.tsx` — dus alléén zichtbaar op de feitelijk onbereikbare /lab-pagina (zie A1). Effectief verborgen functionaliteit. |
| A4 | Bio-radar gebruik | **OPGELOST.** In gebruik in `training-day-home.tsx` én `pages/lab.tsx` — geen dode code. |
| A5 | Races-ingang: geen vast nav-item; hoe komt een renner er normaal? | OPEN — route + header-context bestaan; links vanuit home/kaarten aangenomen. Klikpaden runtime tellen. |

## B. Backend-weesfuncties

| # | Onzekerheid | Wat we wél weten | Hoe te verifiëren |
|---|---|---|---|
| B1 | `GET /api/races/:id/evaluation` zonder UI-aanroep | **BEVESTIGD wees:** grep op `evaluation` in de hele frontend levert nul treffers. Endpoint bestaat in `routes/races.ts` maar wordt nooit aangeroepen. | — (opgelost) |
| B2 | `GET/DELETE /api/activity-imports*` deels zonder UI (explorer-claim) | Router bestaat; import-panel gebruikt POST/lijst deels | frontend-aanroepen matchen tegen routerpaden |
| B3 | `GET /api/calendar/sources` los gebruikt? | `use-calendar.ts` bestaat | hook-implementatie lezen |
| B4 | `PUT /api/auth/me/role` vs rolwisselaar-pad | Endpoint bestaat (replit.md) | UserContext role-switch-aanroep lezen |
| B5 | `engines/race-room/` — map heet mogelijk anders | `routes/race-rooms.ts` + `test:race-room` bestaan; engines-lijst toont `race` en `race-room`-achtige mappen niet 1-op-1 geverifieerd | `ls engines/` exact matchen (lijst toont `race` wel; race-room-engine niet bevestigd) |

## C. Integraties & platforms

| # | Onzekerheid | Wat we wél weten | Hoe te verifiëren |
|---|---|---|---|
| C1 | Garmin: flag `garmin` bestaat, géén provider-implementatie | **BEVESTIGD:** `lib/connectors/providers/` bevat uitsluitend `strava.ts` + `strava-oauth.ts`. Garmin is een roadmap-flag zonder code. | — (opgelost) |
| C2 | Welke LLM-modellen concreet draaien | AI loopt via Replit-integraties (`@workspace/integrations-anthropic-ai`, `-gemini-ai`, `@google/genai` direct voor Photo Lab). Explorer noemde "Claude 3.5 Sonnet" — NIET geverifieerd; modelnamen zijn bewust nergens in de audit als feit opgenomen | integratie-configuratie/modelconstantes lezen |
| C3 | E-mail (Resend): eerlijk-beperkt zonder geverifieerd domein | Gedrag beschreven in memory + health-check GREY-logica | health-check-status in /admin bekijken |
| C4 | KNWU-beperking blijvend? | Bewust honest-limited (mijn.knwu.nl SPA onbereikbaar) — vastgelegd besluit, geen bug | periodiek herproberen is productkeuze |

## D. Gedrag / runtime (niet uit code alleen af te leiden)

| # | Onzekerheid | Toelichting |
|---|---|---|
| D1 | Strava-sync-latentie & zichtbaarheid: geen "laatste sync"-indicator gevonden op Vandaag | Kernreis stap 4; runtime bevestigen dat er echt geen statusregel is |
| D2 | Reageert het dagbeeld binnen de dag op "rit net binnen"? | Dag-type-engine kiest per dag; intra-dag-omslag niet aangetoond |
| D3 | Chat: neemt een vraag automatisch context van de laatste rit mee? | buildAthleteContext bestaat; zichtbare bevestiging voor de gebruiker ontbreekt |
| D4 | VOORSPELD↔WERKELIJK-vergelijking: wordt die ooit teruggekoppeld naar planaanpassing? | Beide paden bestaan (core-prediction); koppeling naar feedback-adjust niet gevonden |
| D5 | Leskaart: gepersonaliseerd of generiek? | Bron (knowledge/feed) niet exact getraceerd |
| D6 | Regelverwijzing "state-card.tsx:143" (check-in-hoist) | Uit explorer-rapport; exacte regel niet herbevestigd — functioneel gedrag wel |

## E. Copy-consistentie (NL-regel)

| # | Onzekerheid | Uitkomst |
|---|---|---|
| E1 | "Syncing…"/"Error" in `day-detail-drawer.tsx` | **WEERLEGD:** grep vindt geen "Syncing"/"Error"-strings in dat bestand. Explorer-claim klopte niet. |
| E2 | Rol-labels Engels in rolwisselaar | **GROTENDEELS WEERLEGD:** `screen-shell.tsx` gebruikt "Coach" (correct NL-leenwoord) en "Ouder" — Nederlands. |
| E3 | TSS/NP/IF/TSB/CTL als afkortingen zonder niveauschakeling | OPEN — afkortingen zelf zijn geaccepteerde vaktermen (dutch-copy-exceptions); de mate van duiding per scherm is niet uitputtend geïnventariseerd. |

## F. Testdekking-toewijzing

| # | Onzekerheid |
|---|---|
| F1 | Sommige features zijn indirect getest (day-advice, race-intel, state-engine): welke suite dekt precies welk pad is niet per feature uitgesplitst; in de CSV staat dan "onzeker" of "indirect". |
| F2 | `test:account` dekt account-herkoppeling (F-124) — aangenomen op basis van testnaam, inhoud niet herlezen. |

## Volledigheidscontrole (§9 van de opdracht)

- **Routes:** alle 25 frontend-routes uit `App.tsx` zijn in de inventaris verwerkt (geverifieerd door directe lezing).
- **Backend:** alle 43 routerbestanden en alle mounts uit `routes/index.ts` zijn gedekt (direct gelezen); per-endpoint-granulariteit steunt deels op explorer-rapporten (zie B).
- **Engines (31), jobs (4), schema-bestanden (38), pagina's (24), componenten (80):** limitatief gelist en toegewezen aan features; individuele componentbestanden zijn niet allemaal geopend — mapping steunt op naamgeving + explorer-rapporten waar niet direct gelezen.
- **Tests:** alle `test:*`-scripts uit beide package.json-bestanden (direct gelezen) zijn aan features gekoppeld; alle 20 testworkflows stonden groen op 12 juli 2026.
- **Flags:** alle 10 flag-sleutels (direct gelezen uit `lib/feature-flags/src/index.ts`) zijn verwerkt.
