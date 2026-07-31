# SPARKI TODAY — CAPABILITY INVENTORY
**Status:** onderzoeksfase afgerond (31-07-2026) · vastgelegd vóór enige bouw, conform de opdracht "Vandaag als intelligente, levende en rolafhankelijke startpagina".
**Conclusie vooraf:** de essentiële databronnen en rolprofielen BESTAAN. Er hoeft geen parallel coach- of analysesysteem gebouwd te worden; het ontbrekende is selectie-, prioriterings- en presentatielogica (de "Today Orchestrator"), een weergavehistorie en rolvarianten van de pagina.

---

## 1. Huidige Vandaag-implementatie

| Onderdeel | Bestand | Gedrag |
| --- | --- | --- |
| Entree | `artifacts/sparki/src/components/sparki/day-home.tsx` (route `/vandaag`) | kiest tussen CommercialShell-weergave (100% rollout) en legacy StateDayHome |
| Commerciële weergave | `commercial-shell.tsx` | HeroVandaag (sfeerkop), CoachBoodschap, WeekSection (week-TSS), TrainingSection (training van vandaag + BlockBalk), HerstelSection (band + onderbouwing), SeasonBand |
| Legacy-weergave | `day-home.tsx` r177–414 | Momentblok via aandachtswet (`lib/aandachtswet.ts`: health > racedag/na-rit/rit-binnen > balans), nudges (CheckInChip, FollowUpChip, ReleaseNoteCard), weer, onderhoudssignalen, leskaart |
| Boodschap-dedupe | `lib/commercial-shell.ts` r205–240 | `COACH_MESSAGE_REWRITE` voorkomt letterlijke herhaling status↔trend |
| Humorrotatie | `lib/humor.ts` | localStorage-antiherhaling (24 recent) + dagseed |

**Herkomst getoonde waarden**
- Coachboodschap/toestandsband: `/api/state` → `api-server/src/engines/state/compute.ts`.
- "Je gaat vooruit": state-engine r146–188 — composiet van 7-daagse HRV-, rusthartslag- en FTP-trend; label "stijgend" bij netto richting > 0,2 over beschikbare signalen. **Wel data-onderbouwd**, maar de onderbouwing is op de pagina te dun zichtbaar (alleen achter HerstelSection-details).
- Training/week: `/api/athlete/dashboard` (plan- + belastingengines).
- Weer: `/api/weather` (Open-Meteo, alleen woonlocatie, non-commercial-tier-kanttekening blijft).

**Vastgestelde tekortkomingen (bevestigen de opdracht)**
- Eén vrijwel identieke pagina voor iedereen; rol/leeftijd/niveau veranderen alleen microcopy, niet prioriteit/volgorde/diepte.
- Op rustige dagen (geen training gepland) geen concreet handelingsperspectief zoals het voorbeeld in de opdracht (§7) vraagt — terwijl `lib/day-advice` die sessie deterministisch kán leveren.
- Dubbeling: toestandsconclusie verschijnt in CoachBoodschap én HerstelSection; seizoenkaart herhaalt wedstrijdinfo die ook in CoachBoodschap kan zitten.
- Geen weergavehistorie: Sparki weet niet wat gisteren of eerder vandaag getoond is (alleen humor-anti-herhaling client-side, en onboarding/tester-welkom-flags).

## 2. Rollen en profielen (bestaand)

- **Globale rollen:** `user_profiles.roles[]` + `active_role` (athlete/coach/parent), rolwisselaar aanwezig; clubrollen apart (clubbeheerder, hoofdtrainer, trainer-toewijzingen); mechanieker-functies bestaan als materiaalkring-omgeving; ploegleider bestaat nog **niet** als aparte rol (wel wedstrijddag-functies binnen coach).
- **Profielvelden:** volledige DOB (exacte leeftijd via `computeAge` — geheugenregel), ervaringsniveau, atleettype, `developmentGoal` (Ontwikkelmodel), recreatief/wedstrijd, jeugd/minor-vlaggen (fail-closed patronen bestaan: ouderomgeving, sociale privacy, fueling jeugd-no-numbers).
- **Rolspecifieke omgevingen bestaan al:** coach-cockpit/werkruimte, hoofdtrainer-orgoverzicht, ouderomgeving, cluborganisatie, Mechanieker/materiaalkring. Vandaag hoeft die niet te dupliceren — alleen per rol de juiste voordeur + prioriteiten tonen.
- **Eén leespunt:** `GET /api/auth/me` (rollen) + `api-server/src/lib/athlete-context.ts` `getAthleteContext` (profiel + metrics + actieve coaching in één object) — geschikt als orchestrator-input.

## 3. Herbruikbare engines (allemaal bestaand, deterministisch tenzij vermeld)

| Engine | Levert voor Vandaag | Route |
| --- | --- | --- |
| State-engine | eerlijke toestand + trend ("je gaat vooruit"-bron) | `/api/state` |
| Readiness (lib/readiness, SSOT) | belastbaarheid 1–10 | via dashboard/state |
| Day-advice | concrete uitlegbare sessie op planloze dagen | shared lib |
| Adaptive coach (decideCoach) | dagbesluit over alle day-types | CoachDecisionContext |
| Observation-engine | dagelijkse coachanalyse, ≥2-signaalregel, confidence <100 | `/api/ai/observations`, `/api/ai/brief` |
| Foundation-orchestrator (7 engines, `ai_foundation`-flag) | data→kennis→model→strategie→patroon→besluit→uitleg | `/api/foundation/analyse` |
| Plan/uitvoering | training vandaag, gemist/extra, verdicts, adaptieve voorstellen | dashboard + workouts |
| Race Intelligence + wedstrijdflow | komende wedstrijd, voorbereiding, dossier | `/api/athlete/races/:id/intel` |
| Belasting (computeLoadSeries, SSOT) | CTL/ATL/TSB, week-TSS | `/api/athlete/load` |
| Gezondheid/herstelflow | ziek/geblesseerd-status (raises-only) | status-routes |
| Fueling-engine | richtwaarden rond training/wedstrijd (jeugdregels) | nutrition-routes |
| Mechanieker/garage | onderhoudsstatus, slijtage, wedstrijdcheck | `/api/garage/status` |
| Routes | passende route, bibliotheek, geschiktheid | route-routes |
| Sync/data-origin/bronnenregister | synchronisatiestatus, ontbrekende data, betrouwbaarheid | foundation-status e.a. |
| Weer | Open-Meteo woonlocatie | `/api/weather` |
| Engagement/aandacht-rotatie | open-ritme, nudge-pauzeregels (3 dagen genegeerd) | notifications |
| Seizoensdoel/Doelen-engine | seizoenkader, afvaldoel-zin (canoniek) | goals-routes |
| Context-memory + memory graph | persoonlijke verbanden, voorkeuren | `/api/ai/memory` |
| AI-gateway `aiMessage` | centrale LLM-poort: killswitch→consent→minor→redactie→dedupe; output in `ai_observations` mét confidence/timestamp/bron | intern |

**Cachingpatronen bestaan** (DB-cache + TTL bij route-engines; `ai_observations` met dedupe-keys) — herbruikbaar voor de eis "geen nieuwe AI-call per paginalaad".

## 4. Wat ontbreekt (te bouwen — alléén dit)

1. **Today Orchestrator** (api-server, deterministisch): leest rol + `getAthleteContext` + engine-uitkomsten, rangschikt kandidaten (urgent > openstaande actie > nieuw > relevant > wisselend), levert max. 1 hoofdboodschap + 1 onderbouwing + 1 inzicht + 1 wisselend blok. AI alleen voor formulering via bestaande `aiMessage`-poort, met deterministische fallbacktekst.
2. **Weergavehistorie** (nieuwe tabel, server-side): boodschap-key, getoond-op, geklikt, afgerond, herhaling-zinvol — voedt anti-herhaling en "openstaande actie blijft staan".
3. **Rol-/profielvarianten van Vandaag** (presentatielaag): kaartvolgorde, diepte, termen en acties per profiel (jeugd 15, wedstrijd 17, volwassen wedstrijd, recreatief, beginner, trainer, ouder, clubbeheerder, mechanieker-context). Trainer-Vandaag hergebruikt cockpit-data (aandachtssporters, te beoordelen voorstellen).
4. **Debug-/onderbouwingsweergave** (admin/tester-only): gekozen profiel, prioriteit, afgevallen kandidaten, bronnen, confidence, AI ja/nee — sluit aan op bestaand data-origin/uitleglaag-patroon.
5. **Testmatrix** (17 scenario's uit de opdracht §10) + documenten §11.

**Ontbrekend maar niet blokkerend:** ploegleider als aparte rol (nu coach-functie — voorstel: fase later); weer-/routecontext mag alleen "wanneer beschikbaar" (compliance-kanttekening Open-Meteo blijft gelden).

## 5. Hergebruikbeslissingen

- Geen nieuw analysepad: orchestrator consumeert uitsluitend bestaande engines (tabel §3); elke conclusie erft de bron-/confidence-metadata van zijn engine (bronnenregister).
- Aandachtswet blijft de urgentietop van de ranking (health altijd eerst); presentatievariatie-principes (stabiele nummers, urgent nooit gedegradeerd) blijven gelden.
- `aiMessage` is de enige LLM-route; cache per dag+inputhash; pagina functioneert volledig zonder AI.
- Bestaande rechten (coach/ouder/club/minor fail-closed) worden geraadpleegd, nooit opnieuw geïmplementeerd.

## 6. Voorgestelde werkpakketten (fasering)

- **WP-T1** Orchestrator-kern + weergavehistorie + atleet-varianten (jeugd/recreatief/wedstrijd/beginner) + eerlijke lege toestanden.
- **WP-T2** Rolvarianten trainer/ouder/clubbeheerder + rolwisselaar-integratie.
- **WP-T3** Debugweergave + testmatrix-bewijs (17 scenario's, screenshots ≥6 profielen, meerdere inlogmomenten) + documenten §11 + Poort 5b.

Niet "afgerond" markeren vóór de rollen/profielen aantoonbaar getest zijn (acceptatiecriterium van de opdracht + Product Proof Doctrine: belofte pas bewezen bij ≥9,0).
