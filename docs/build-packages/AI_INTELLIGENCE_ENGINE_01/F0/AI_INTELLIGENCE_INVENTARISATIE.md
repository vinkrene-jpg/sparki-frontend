# AI_INTELLIGENCE_ENGINE_01 — F0 Inventarisatie (werkelijkheid)

**Fase:** F0 · **Status:** opgeleverd · **Datum:** 2026-08-01
**Regel:** geen productcode gewijzigd; dit document beschrijft uitsluitend wat er ís, met vindplaats per claim.

---

## 1. Centrale AI-gateway

- **Pad:** `artifacts/api-server/src/lib/ai/gateway.ts`
- **Signatuur:** `aiMessage(purpose: AiPurpose, clerkId: string | null, params: MessageParams, options?: AiCallOptions): Promise<Anthropic.Message>` · daarnaast `aiMediaCall<T>(purpose, clerkId, fn)` voor media-modellen (Gemini).
- **Gedwongen keten (in de gateway zelf):** killswitch (`ensureAlive`, domein `ai_processing`) → consent per purpose (fail-closed, `getEffectivePrivacy`) → minderjarigen-blokkade (`isMinorOrUnknown`, purposes met `minorBlocked`) → redactie (`redactParams`: secrets/tokens/JWT/e-mail) → dedupe (`dedupeKey` in-flight) → rate-limit (sliding window 30/5min per gebruiker/doel) → metadata-only logging (`ai_call_logs`: purpose, tokens, kosten, latency — nooit inhoud).
- **Prompt-injectiebescherming:** `UPLOAD_DATA_RULE` in gateway.ts bij data-uploads.

### Bestaande AI-purposes (aanroepplaatsen van `aiMessage`)

| Purpose | Aanroepplaats |
|---|---|
| `brief`, `ask`, `workout_explain`, `workout_explain_extended`, `workout_adjust` | `src/routes/ai.ts` |
| `nutrition_photo`, `nutrition_text` | `src/routes/nutrition.ts`, `src/lib/material/analyze.ts` |
| `helpdesk` | `src/routes/support.ts` + `src/lib/support/helpdesk.ts` |
| `observation_extract` | `src/lib/ai-memory.ts` |
| `document_analysis` | `src/lib/document-analysis/analyze.ts` |
| `material_photo` | `src/lib/material/analyze.ts` |
| `route_rationale` | `src/lib/plan-routes.ts`, `src/routes/routes.ts` |
| `ride_story` | `src/lib/share/ride-share.ts` |
| `plan_proposals` | `src/lib/training-plan.ts` |
| `knowledge_scan` | `src/lib/knowledge/scan.ts` |
| `health_probe` | `src/lib/health/checks.ts` |

### Prompts
- Systeemprompt `SPARKI_SYSTEM` + contextopbouw `buildAthleteContext` (profiel, FTP, hartslagtrends, sessies, voeding, wedstrijden, NASLAGWERK-terugblik): `src/lib/athlete-context.ts`. Overige promptteksten liggen bij de aanroepplaatsen hierboven.

### Providercalls buiten de gateway — uitputtende zoekactie
- **Zoekactie:** `rg "@anthropic-ai/sdk|@google/genai|openai|api.anthropic.com|generativelanguage.googleapis.com"` over `artifacts/api-server`, `artifacts/sparki`, `artifacts/sparki-mobile`, `lib`, `scripts`.
- **Resultaat: géén directe providercalls buiten de gateway.** De low-level SDK-clients staan in `lib/integrations-anthropic-ai` en `lib/integrations-gemini-ai` en worden uitsluitend door de gateway aangeroepen. Frontends (sparki, sparki-mobile) bevatten geen provider-imports of -fetches.

---

## 2. De zeven Foundation-engines (`ai_foundation`-flag)

Pad: `artifacts/api-server/src/engines/ai-foundation/` · contracten in `contracts.ts` · alle deterministisch.

| # | Engine | Bestand | Input → Output |
|---|---|---|---|
| 1 | Data Engine | `data-engine.ts` | clerkId → `DataSnapshot` (eerlijke snapshot incl. ontbrekende kanalen) |
| 2 | Knowledge Engine | `knowledge-engine.ts` | tags/filters → `EvidenceRecord[]` (bewijslast + kwaliteitsscore) |
| 3 | Athlete Model Engine | `athlete-model-engine.ts` | clerkId + snapshot → `AthleteModel` |
| 4 | Strategy Engine | `strategy-engine.ts` | model + snapshot → `StrategyView` (periodisering, strategische conflicten) |
| 5 | Pattern Engine | `pattern-engine.ts` | snapshot → `DetectedPattern[]` (trends/afwijkingen, geen advies) |
| 6 | Decision Support Engine | `decision-support-engine.ts` | model+strategie+patronen+snapshot → `DecisionSupport` (≥2 scenario's) |
| 7 | Explainability Engine | `explainability-engine.ts` | FoundationRun → `FoundationExplanation` (keten, aannames, gebruikte data) |

- **Orchestrator:** `engines/ai-foundation/orchestrator.ts` — strikte volgorde, legt trace vast, bevat zelf geen intelligentie. Evidence-upsert gebruikt `nullsNotDistinct`; flag-rijen moeten geseed zijn voor override-FK.

---

## 3. Overige engine-facades (bestaand engine-landschap)

`artifacts/api-server/src/engines/<naam>/index.ts` — routes horen engines te importeren, niet lib-helpers (bestaande architectuurregel, `docs/engine-architecture.md`):
`ai-foundation`, `coaching`, `data-hub` (ingest/sync/validatie; `activitiesIngestAllowed` = AND-consent), `data-origin`, `document-analysis`, `engagement`, `garage`, `goals`, `input-center`, `insights`, `integration`, `knowledge`, `material`, `memory-graph`, `mental`, `observation`, `onboarding`, `profile`, `race`, `recovery-load`, `road-objects`, `route`, `share`, `social`, `source-quality`, `sprint`, `state`, `today`, `training-plan`, `voice`, `context-memory`, `core-prediction`, `intel`.

- **State-engine:** `engines/state/index.ts` — leidt één eerlijke "Sparki State" af; consumers: `routes/state.ts` en `engines/today/orchestrate.ts`. De engine hoort bij geen enkel scherm.
- **Today-orchestrator:** `engines/today/orchestrate.ts` — rangschikt Vandaag (urgent > actie > inzicht > rotatie), logt weergave in `today_display_history`.

---

## 4. Bestaande adviesvormen en hun opslag

| Adviesvorm | Pad | Type | Opslag/herleidbaarheid nu |
|---|---|---|---|
| Vandaag/day-advice (no-plan dagadvies) | `engines/today/orchestrate.ts`, `lib/day-advice` (sparki) | deterministisch | gerenderd; weergave gelogd in `today_display_history` |
| Adaptive Coach (decideCoach) | `engines/ai-foundation/decision-support-engine.ts` + CoachDecisionContext (web) | deterministisch (LLM alleen prose) | feedback/verdicts in `analysis_feedback` (JSONB context: engine, ruleKey, confidence) |
| Daily briefing / day-type | `sparki/src/components/sparki/day-type-briefing.tsx` | deterministisch | gerenderd (basis: `plan_days`) |
| Race Intelligence | `engines/race`, `engines/intel`, web `race/race-intel.tsx` | hybride (found/derived/missing) | `race_results`, `race_evaluations` |
| Fueling engine | `lib/fueling.ts` | deterministisch (LLM phrasing-only) | gerenderd (basis: `nutrition_hydration_logs`) |
| Plangenerator + coach-adoptie | `lib/training/plan-generator.ts` | deterministisch | `planned_workouts`, `coach_change_proposals`, `planned_workout_changes` |
| Ontwikkelmodel/-kompas | web `ontwikkelprioriteit-home-card.tsx` + lib | deterministisch | gerenderd (basis: `athlete_profiles`) |
| State card / readiness | `engines/state` + web `state-card.tsx` | deterministisch | `workout_feedback`, `athlete_daily_metrics` |
| Core-prediction (per-workout forecast) | `engines/core-prediction/predict.ts` | deterministisch | `ftp_history`, `planned_workouts` |
| Plan-execution verdicts | plan-execution flow | deterministisch (LLM words-only) | `analysis_feedback` + verdicts |
| Uitleglaag "Waarom dit advies?" | web `components/viz/uitleg.tsx` + `lib/uitleg-content.ts` (registry) | deterministisch | registry in code (niet DB); bronvermelding linkt naar kennisitems |

**Conclusie:** er bestaat **geen centraal adviesdossier**. Herleidbaarheid is verspreid over `analysis_feedback`, `today_display_history`, `coach_change_proposals`, `ai_call_logs` en render-time samenstelling (`waaromAdvies`-strings, Explainability Engine, uitleg-registry).

---

## 5. Memory- en observatiestructuur

- **`ai_observations`** (`lib/db/src/schema/ai-memory.ts`): velden o.a. `confidence` ('low'/'medium'/'high' — nooit 1.0), `expires_at`, `detected_pattern`, `signals` (JSONB, explainable bronnen), `status` (incl. 'outdated'). Schrijvers: `persistObservation` (`src/lib/ai-memory.ts`, centrale schrijver), `routes/ai.ts` (brief/ask-extractie via purpose `observation_extract`), `engines/memory-graph` (`runConnectionAnalysis`, deterministisch).
- **Personal context memory:** tabel `personal_context_memories` (`lib/db/src/schema/context-memory.ts`), schrijver `captureContext` (`engines/context-memory`), route `POST /api/memory/context`; follow-ups: `GET /api/memory/follow-ups/due`, `POST /api/memory/follow-ups/:id/answer` (`routes/memory.ts`).
- **Deterministische observatie-engine:** `engines/observation/observations.ts` (`deriveObservations`, `computeConfidence` met ≥2-signaal-guard); dedupe op woord+getal-overlap in presentatielaag.
- **Opschoning:** `src/jobs/observation-cleanup.ts` — markeert `status='outdated'` (nooit hard delete), auditbaar, 1×/Amsterdamse dag + admin-POST.
- **Outcome/feedback:** `analysis_feedback` (idempotente upsert die de HELE rij ververst), `build_ratings` (sterren, `PUT /api/build-ratings`), `recordCoachingFeedback` (`engines/observation/feedback.ts` — advice_followed/too_strict → begeleidingsprofiel), `coach_change_proposals` (uitkomst voorstellen).
- **LLM schrijft geheugen nooit rechtstreeks:** alle persist loopt via `persistObservation` met privacy-gate; accounting created+deduped+gated===derived.

---

## 6. Data Trust, herkomst en bronkwaliteit

- **Bronnenregister:** `engines/source-quality/index.ts` — betrouwbaarheid/volledigheid/validiteit per bron; fail-closed promptregel; sensor "actief" vereist echt bewijs; per-analyse used/excluded-logging.
- **Herkomst/explain:** `engines/data-origin/` (`index.ts`, `classification.ts`; `computation_traces`, `sessionOrigin`) + provenance-endpoints `routes/data-origin.ts` (`/explain/session/:id`, `/explain/observation/:id`, `/explain/computation/:type`; constante tabel-allowlist, nooit request-gestuurde SQL).
- **Dedupe activiteiten:** Data Hub dedupe-key = sport+start-bucket + neighbour match (`engines/data-hub`); duplicaatdetectie bestaat dus al op ingest-niveau.

---

## 7. Consent-, rol- en jeugdregels

- **AI-consent:** per-purpose fail-closed in de gateway (§1); consentkinds `ai_coaching`, `ai_memory`, `ai_health`, …
- **Activity-consent AND-regel:** `engines/data-hub/ingest.ts` (`activitiesIngestAllowed`).
- **Minderjarig/onbekend = fail-closed:** gateway (`isMinorOrUnknown`), `lib/parent-permissions.ts` (onbekende leeftijd clampt naar veiligheidsminimum), `lib/club-permissions.ts` (`isMinorForClub`), `lib/world-social/access.ts`, `routes/media-status.ts`. Geen gewichts-/calorieadvies aan minderjarigen: seizoensdoel-engine 17+ met RED-S-weigering.
- **Coach/parent sharing levels:** `lib/sharing.ts`, `lib/parent-permissions.ts`, `routes/privacy.ts` (share-nothing … full; private memory gescheiden).
- **Rollen/rechten:** trainerlaag (`hasCoachAccess` = link ∪ clubtoewijzing; schrijven eist directe link), clubrechten least-privilege, entitlements `lib/entitlements.ts` (AND met flags, fail-closed).

---

## 8. Kennisfuncties (KENNIS_01)

- **Tabellen:** `managed_knowledge_items`, `managed_knowledge_versions`, `knowledge_usage_events`, `knowledge_feedback` (`@workspace/db`).
- **Governance:** `lib/knowledge/governance.ts` — publish = transactie + snapshot; gebruik pint versie; `knowledgeSourceBlock` dwingt prompts tot alleen-gecontroleerde-bronnen ("HARDE REGELS").
- **Retrieval/relevance guard:** `lib/knowledge/retrieval.ts` (recency + relevance; word-boundary regex tegen off-topic).
- **Intel hub:** `engines/intel/` (alleen `status='published'`), web `pages/knowledge.tsx`, gated door `knowledge_base`-flag.
- **Live wetenschappelijke zoeklaag: AFWEZIG.** Er is redactionele kennis + `knowledge_scan` (beheer/samenvatten); er is géén live literatuurzoekfunctie met citaties. Zoekactie: `rg -i "pubmed|arxiv|crossref|semanticscholar|doi.org"` in api-server → alleen de bestaande arXiv-gerelateerde relevance-guard-context in kennisbeheer, geen runtime-zoeklaag voor adviezen.

---

## 9. Live vs niet-live, analytics en logging

- **Live:** gateway + alle purposes in §1, foundation-engines achter `ai_foundation`-flag (flag default beperkt), observation/memory-flows, kennisbank, Data Trust-endpoints, today-orchestrator, state-engine.
- **Niet-live/flag-gated:** `ai_foundation` (foundation-run), `knowledge_base` (intel hub), `rit_verhaal` (ride story), humorniveau-laag; media-uitleg-flags default UIT.
- **Analytics/logging:** `ai_call_logs` (metadata-only), `admin_ops_log`, `today_display_history`, `knowledge_usage_events`, engagement-engine (open-ritme), admin health-check engine (echte probe of GREY).

---

## 10. Testdekking (AI-gerelateerd, bestaande scripts)

- **api-server:** `test:ai-gateway`, `test:ai-consent`, `test:ai-foundation`, `test:consent-gate`, `test:kennisbank`, `test:memory-graph`, `test:context-memory`, `test:observation`, `test:data-trust`, `test:source-quality`, `test:intel`, `test:core-prediction`, `test:today-orchestrator`, `test:coach-parent-sharing-levels`, `test:coach-parent-private-memory`.
- **sparki (web):** `test:day-advice-canonical`, `test:day-advice-seizoensdoel`, `test:insight-grouping`, `test:core-analyse`, `test:session-analysis`, `test:humor`, `test:scan-quality`.
