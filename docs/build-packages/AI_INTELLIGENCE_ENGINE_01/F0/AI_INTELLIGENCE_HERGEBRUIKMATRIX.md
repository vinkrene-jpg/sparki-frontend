# AI_INTELLIGENCE_ENGINE_01 — F0 Hergebruikmatrix (bindend voor F1–F13)

Elk pakketonderdeel is gekoppeld aan het bestaande onderdeel dat wordt hergebruikt/uitgebreid. Kolom "Nieuw te bouwen" bevat uitsluitend wat aantoonbaar afwezig is (zie inventarisatie §-verwijzingen).

| Pakketbehoefte | Bestaand onderdeel (hergebruik) | Vindplaats | Nieuw te bouwen (gat) | Fase |
|---|---|---|---|---|
| Taalaanroep | `aiMessage()` / `aiMediaCall()` gateway | `src/lib/ai/gateway.ts` | niets — alleen nieuwe purposes registreren | F3, F10 |
| Deterministische berekening | 7-engine Foundation | `src/engines/ai-foundation/` | niets dupliceren | F3 |
| Routering | Foundation-orchestrator + today-orchestrator | `engines/ai-foundation/orchestrator.ts`, `engines/today/orchestrate.ts` | uitbreiding: 8 routeringsbeslissingen (bron/engine/kennis/LLM/rol/veiligheid/mens) als expliciete, gelogde stap | F3 |
| Toestand | state-engine | `engines/state/index.ts` | — | F3, F4 |
| **Adviesdossier (20 velden)** | verspreide opslag: `analysis_feedback`, `today_display_history`, `coach_change_proposals`, `ai_call_logs` + Explainability Engine | inventarisatie §4 | **JA — centraal, onveranderlijk adviesdossier ontbreekt volledig**; bestaande explainability wordt aangesloten, niet vervangen | **F1** |
| **Confidence-standaard** | `computeConfidence` (observation), `AiObservationConfidence` low/med/high, foundation-confidences | `engines/observation/observations.ts` | **JA — één centrale berekende standaard** over bronnen/actualiteit/consistentie/dekking; nu per-engine eigen logica | **F2** |
| Doelbewaking | goals-engine, season-goal, strategy-engine (conflicten), plan-generator, coach_change_proposals, leefagenda | `engines/goals`, `lib/season-goal`, `engines/ai-foundation/strategy-engine.ts` | scenario-laag (10 gevallen) bovenop bestaande signalen; besliskracht blijft bij mens | F4 |
| Geheugen | `ai_observations` + `personal_context_memories` + memory-graph + cleanup-job + follow-ups | inventarisatie §5 | outcome-tracking → confidence-aanpassing-lus; onderscheid feit/hypothese/patroon/voorkeur/chat is deels aanwezig (`detected_pattern`, kinds) — aanvullen, niet vervangen | F5 |
| Trainer–sportercommunicatie | sharing levels, hasCoachAccess, coach-cockpit, parent-permissions, notificatielaag | inventarisatie §7 | rolgerichte uitleg op één gedeelde waarheid (presentatielaag) | F6 |
| Multi-bronconflict | Data Hub dedupe + source-quality register + data-origin | inventarisatie §6 | conflictdetectie met beide bronwaarden + bevestigingsvraag; automatische keuze wacht op besluit O-2 | F7 |
| Redactionele kennisgrens | KENNIS_01 governance + `knowledgeSourceBlock` | `lib/knowledge/governance.ts` | zichtbaar UI-onderscheid redactioneel/modelkennis/live | F8 |
| Live literatuurzoeklaag | **AFWEZIG** (inventarisatie §8) | — | volledig nieuw, alleen indien verantwoord; anders eerlijk "bestaat niet" | F9 |
| Gateway-governance | gateway-keten + `ai_call_logs` + health-probe | `src/lib/ai/gateway.ts` | promptversie-registratie, responsevalidatie, fallback/providerstatus expliciet | F10 |
| Veiligheid & jeugd | minor fail-closed (gateway, parent/club-permissions), acute-melding-regels, MUX-89..92 | inventarisatie §7 | testbewijs + resterende gaten | F11 |
| Uitleg "Waarom dit advies?" | uitleg-registry + UitlegDot + Explainability Engine + waaromAdvies | inventarisatie §4 | aansluiten op adviesdossier als gegevensbron | F1, F8 |
| Rechten | CLUB_RECHTEN_01-lagen + entitlements + consentGate | inventarisatie §7 | **niets — geen tweede rechtenlaag** | alle |
| Observability | `ai_call_logs`, admin health-check, admin_ops_log | inventarisatie §9 | metingen deel 14 (kosten/latency/fallback per purpose zichtbaar) | F10 |

**Harde niet-bouwen-lijst bevestigd haalbaar:** geen tweede AI-architectuur, memory, kennisbank of rechtenlaag nodig — voor elk bestaat een herbruikbare drager. Enige volledig nieuwe onderdelen: het centrale adviesdossier (F1), de centrale confidence-berekening (F2) en — voorwaardelijk — de live literatuurlaag (F9).
