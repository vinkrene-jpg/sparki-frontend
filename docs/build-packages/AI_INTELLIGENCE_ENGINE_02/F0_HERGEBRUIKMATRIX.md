# AIE2 — F0 Hergebruikmatrix (O-1)

**Status:** opgeleverd 01-08-2026 · geen code (AIE2-15) · geverifieerd tegen de huidige codebase.
**Regel:** geen enkele fase na F0 start zonder dit document (AIE2-03/93).

## 1. De zeven Foundation-engines (AIE2-14a)

Locatie: `artifacts/api-server/src/engines/ai-foundation/`, achter feature flag `ai_foundation`, aangeroepen door `runFoundationAnalyse` in `orchestrator.ts` (sequentieel, resultaten stromen door).

| # | Engine | Bestand | Verantwoordelijkheid |
|---|---|---|---|
| 1 | Data Engine | `data-engine.ts` | Eerlijke snapshot van profiel, sessies, belasting, metingen |
| 2 | Athlete Model | `athlete-model-engine.ts` | Consistent atleetmodel (doelen, ervaring, beperkingen) |
| 3 | Knowledge | `knowledge-engine.ts` | Relevante evidence-records uit KENNIS_01 bij de context |
| 4 | Strategy | `strategy-engine.ts` | Langetermijnlijn, periodisering, strategische conflicten |
| 5 | Pattern | `pattern-engine.ts` | Objectieve patronen (trends/afwijkingen/correlaties), geen advies |
| 6 | Decision Support | `decision-support-engine.ts` | Scenario's met slagingskans en risico |
| 7 | Explainability | `explainability-engine.ts` | Rapporteert gebruikte data, modellen, rekenketen |

Daarnaast (géén onderdeel van de Foundation, wél te hergebruiken): **Today-orchestrator** `engines/today/orchestrate.ts` (lead/support/insight-slots, volledig deterministisch) en **State-engine** `engines/state/` (band, fitheid, readiness met `basis`-indicatoren).

## 2. Exacte signatuur `aiMessage(...)` (AIE2-14b)

`artifacts/api-server/src/lib/ai/gateway.ts`:

```ts
export async function aiMessage(
  purpose: AiPurpose,            // key in AI_PURPOSES
  clerkId: string | null,        // null = systeemtaak
  params: MessageParams,         // Anthropic.MessageCreateParamsNonStreaming
  options: AiCallOptions = {},   // o.a. dedupeKey
): Promise<Anthropic.Message>
```

Poortvolgorde (fail-closed): killswitch (`ensureAlive("ai_processing")`) → consent (`getEffectivePrivacy`, o.a. `ai_memory`/`ai_health`) → minderjarig (`isMinorOrUnknown` blokkeert purposes met `minorBlocked`) → in-flight dedupe → redactie (`redactParams`) → rate limit (5-min-venster) → metadata-only logging (`ai_call_logs`).

Huidige `AI_PURPOSES`: brief, ask, goal_translate, helpdesk, workout_explain(+extended), workout_adjust, observation_extract, plan_proposals, material_photo, nutrition_photo/text, document_analysis, knowledge_scan, ride_story, route_rationale, input_center, health_probe (+ Gemini-media-purposes).

## 3. Bestaande AI-memory- en observatiestructuur (AIE2-14c)

| Onderdeel | Waar | Kernvelden |
|---|---|---|
| `ai_observations` | `lib/db/src/schema/ai-memory.ts`, geschreven via `lib/ai-memory.ts` | sourceType, confidence (low/med/high) + confidenceScore (0.10–0.95, nooit 1.0), detectedPattern, signals (jsonb datapunten), **alternativeExplanations**, expiresAt, dedupeKey |
| `ai_memory_events` | idem | audit van geheugen-acties |
| `ai_preferences` | idem | humor/intensiteit/communicatiestijl |
| `personal_context_memories` | schema `context-memory.ts` | statement/detail, followUpAt/-Question, emotionalTone |
| Memory-graph | `engines/memory-graph/` | gather → correlations → privacy-gate; confidence uit sample/effect/agreement |

## 4. Bestaande adviesvormen en opslag (AIE2-14d)

| Adviesvorm | Bron | Opslag | Heeft al "waarop gebaseerd"? |
|---|---|---|---|
| Dagadvies Vandaag | `engines/today/orchestrate.ts` + `lib/day-advice` | on-the-fly | deels (deterministische onderbouwing, geen dossier) |
| Adaptive Coach-besluit | `decideCoach` (adaptive coach) + state-engine | on-the-fly | deels |
| Coach-signalen | `lib/coach-signals.ts` | besluit persist in `coach_signal_actions` | ja: sources, whyHuman, confidence |
| Sparki-wijzigingsvoorstellen | `coach_change_proposals` | persist | reden-veld |
| Observaties | `ai_observations` | persist | ja: signals + alternativeExplanations |
| Race-advies/intel | `lib/race-advice.ts`, `lib/race-intel.ts` | on-the-fly | ja: sources + found/derived/missing |
| Fueling/voeding | `lib/fueling.ts`, `lib/nutrition-rules.ts` | on-the-fly richtwaarden (SSOT) | deels |
| Plan-aanpassing | `lib/adjust-rules.ts` (`decideAdjustment`) | besluit persist bij uitvoering | motivatie in AdjustDecision |
| Gezondheid/herstel | `lib/health/engine.ts`, `engines/state/compute.ts` | on-the-fly | readiness met basis-indicatoren |
| Doelen-voortgang | `lib/goals.ts` (`judgeProgress`) | on-the-fly | reasons/gaps |
| Nudges/meldingen | `notifications`-tabel | persist | link naar bronobject |

**Conclusie voor F1:** er is géén uniforme dossieropslag; onderbouwing bestaat overal, maar per vorm anders van vorm en diepte. Het adviesdossier wordt dus een **nieuwe, dunne registratielaag bovenop bestaande vormen**, geen vervanging.

## 5. Bestaande explainability (AIE2-14e)

- Explainability-engine (Foundation, §1) — rekenketenverantwoording.
- Uitleg-registry + `UitlegDot`: `artifacts/sparki/src/components/viz/uitleg.tsx` + `src/lib/uitleg-content.ts`.
- Data Origin/herkomst: `engines/data-origin/` + `routes/data-origin.ts` + tabel `computation_traces`.
- Bronnenregister: `engines/source-quality/` (origin/reliability per bron; valid = goed|matig; fail-closed richting LLM).

## 6. Matrix per AIE2-onderdeel

| Onderdeel (fase) | Bestaat al | Waar | Hergebruik | Uitbreiden | Nieuw | Waarom |
|---|---|---|---|---|---|---|
| Adviesdossier 20 velden (F1) | nee (wel losse onderbouwing overal) | §4 | onderbouwingsvelden per vorm | — | dossier-tabel + schrijf-API | geen uniforme registratie; B7 is voorwaarde |
| Legacy-markering (F1) | nee | — | status-patronen (vgl. `[achterhaald]` bij ftp_history) | — | status `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` + UI-label | AIE2-29 |
| "Waarop gebaseerd" altijd tonen (F2) | deels | uitleg-registry, data-origin, source-quality | volledig | UI-koppeling dossier→uitleg | — | AIE2-28; infra bestaat |
| Confidence 8 factoren → 4 niveaus (F3) | deels | memory-graph (3 factoren), ai_observations confidence | rekenkader | uitbreiden naar 8 factoren + centrale vertaaltabel naar 4 taal­niveaus | — | AIE2-32; nooit score naar gebruiker (AIE2-09/82) |
| Geldigheidsduur per brontype (F4) | deels | `source-quality/assess.ts` (14d sensoren, 7d dagmetrics) | volledig | per-brontype-register uitbreiden (FTP-test ≠ HR-meting) + "verouderd, wél bruikbaar met waarschuwing" | — | AIE2-23/24; nu is verouderd → "matig", geen expliciete waarschuwingsvorm |
| Voorkeursbron (F5) | **nee** | dedupe: `engines/data-hub/dedupe.ts` (sport+5-min-bucket, eerste-bron-wint, manualFields heilig) | dedupe-keten volledig | mergebeleid: gekozen bron wint velden | voorkeursbron-instelling bij eerste koppeling + vraag bij conflict zonder keuze + stil verwerken mét keuze | AIE2-17–22; huidige "eerste wint" is impliciet, niet gebruikersgestuurd |
| Dubbele rit onbeperkt bewaren (F5) | deels | dedupe merge't in één rij (mergeLog) | mergeLog | niet-gekozen bron als volledige schaduwrit bewaren | opslagvorm te bepalen in F5-ontwerp | AIE2-21 |
| Gefaseerde volledige historie-import (F6) | deels | Strava-import + gap-fill, Garmin/Wahoo-sync | sync-laag, Data Hub-ingest | fasering/batching over volledige historie + koudestartvelden (trainingsleeftijd, seizoenspatroon) | importplanner | AIE2-25/26 |
| Contextlaag onboarding + gevoel na zware rit (F7) | deels | Onboarding V2 adaptieve Q&A; personal_context_memories; subjectief gevoel bestaat als invoer | beide | vragencatalogus uitbreiden (5–8+); trigger "alleen na zware rit" | — | AIE2-34–36 |
| Belastingsmodel + eFTP (F8) | **ja** | `computeLoadSeries` (één SSOT), FTP-floor | volledig | — | — | AIE2-38 bevestigt aanwezig |
| Vermogenscurve (F8) | deels | `training_sessions.power_bests` (5s–20min, alleen bij ingest) | power_bests | curve over sessies heen aggregeren + UI | curve-aggregatie | AIE2-38: "nog te bouwen"; basisdata bestaat al |
| Intervaldetectie (F8) | **nee** (wel klimdetectie `lib/gpx-parse.ts`; planned `structure.blocks` = planning, geen detectie) | — | sample-pipeline van ingest | — | detectie-algoritme | AIE2-38 |
| Trainer-groepsoverzicht met signalen (F9→F13/AIE2-39) | deels | coach-signals per sporter; cockpit per sporter | signalenlaag | aggregatie over de groep in één beeld | groepsscherm | AIE2-39 |
| Doelbewaking (F9) | deels | `judgeProgress` + goal_events (DOELEN_01) | volledig; DOELEN_01 blijft eigenaar van instellen/beheren | afwijkingssignalen + doorwerking schema + trainerdoel-zichtbaarheid beide kanten | bewakingsjob | AIE2-40–43; onder-14 alleen taal (policy-poort bestaat) |
| Wetenschapscontrole (F10) | deels | KENNIS_01 (publish=tx+snapshot, usage pint versie), knowledge_scan-purpose, relevance guard | volledig | tweelagenmodel (vindlaag/bewijslaag) + meervoudige bevestiging + voorstel-niet-toepassen | dagelijkse controlejob + sitelijst-register (sitelijst = oplevering René+Claude, AIE2-75) | AIE2-69–75 |
| Gezondheidsformulering (F11) | deels | health-flow (raises-only), aandachtswet, dag-advies | volledig | Mirror-toets op formulering "observatie + doorverwijzing" | formuleringsregels centraal | AIE2-44–47 |
| Deelschakelaar adviezen→trainer (F12) | **nee** (er bestaat wél sharing-levels coach/ouder-raw-data en doelinzage via DOELEN_01) | links/sharing-lagen | rechtenlaag, notificaties | — | één aan/uit-schakelaar + direct-verdwijnen incl. trainerreacties + reacties-bij-advies | AIE2-50–58; bewust TWEE deelregels (doelen apart, AIE2-58 — beide schermen benoemen dit) |
| Minderjarigen/18e verjaardag (F13) | deels | ouderomgeving-rechtenlaag, minor fail-closed, leeftijdsbanden | volledig | dubbel akkoord ouder+kind, ouder ziet identiek, week-vooraf-bericht, auto-uitval op 18e | verjaardagsjob | AIE2-59–68 |

## 7. Dubbelingen en risico's (AIE2-15)

1. **Twee orchestrators**: Today-orchestrator (productie, deterministisch) en Foundation-orchestrator (achter flag). Risico op tweede architectuur als de begeleidingslaag een derde route krijgt → afspraak: de begeleidingslaag spreekt de Foundation aan en levert via de bestaande Today-slots uit, nooit een eigen kanaal.
2. **Drie confidence-modellen** (ai_observations-score, memory-graph sample/effect/agreement, coach-signals confidence). F3 moet er ÉÉN rekenkader van maken; bestaande consumers blijven werken via een vertaling.
3. **Explainability op vier plekken** (Foundation-engine, uitleg-registry, data-origin, source-quality). Het dossier (F1) moet hiernaar VERWIJZEN, niet dupliceren.
4. **"Eerste bron wint" vs voorkeursbron**: F5 wijzigt gedrag van een productiepad (Data Hub-merge). Regressierisico op bestaande merge/manualFields-garanties; manualFields blijft heilig.
5. **Naamclash gevoeligheid**: "advies" bestaat al in ~11 vormen (§4). Het dossier moet één `adviceType`-register krijgen, anders ontstaat sluipend een twaalfde losse vorm.
6. **Onbekend/afwezig, expliciet benoemd (AIE2-16):** géén automatische intervaldetectie; géén sessie-overstijgende vermogenscurve; géén advies-deelschakelaar; géén voorkeursbronmechanisme; géén dagelijkse wetenschapscontrole-job. Niet ingevuld met aannames.

## 8. Open punten

- **O-11** (welke bestaande adviesvormen alsnog een dossier krijgen): beantwoorden in F1 op basis van §4 — kansrijk zijn de al-persistente vormen (observaties, coach-signalen-besluiten, wijzigingsvoorstellen); on-the-fly-vormen worden dossier-bij-uitlevering of legacy.
- **Sitelijst wetenschap** (AIE2-96): René + Claude, oplevering F10 — Replit vult niet zelf in.
