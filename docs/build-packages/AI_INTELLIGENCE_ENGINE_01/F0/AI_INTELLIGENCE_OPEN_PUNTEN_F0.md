# AI_INTELLIGENCE_ENGINE_01 — F0 Open punten & legacy-adviesinventarisatie

## 1. Open besluiten (eigenaar: René, tenzij anders vermeld)

| # | Besluit | Fase | Status |
|---|---|---|---|
| OB-1 | Automatische bronkeuze/conflictbeslechting (pakket-besluit **O-2**) | F7 | OPEN — tot dan alleen detectie + menselijke bevestigingsvraag |
| OB-2 | Wordt F9 (live literatuurzoeklaag) überhaupt gebouwd, en met welke bronleverancier? Geen bestaande laag; extern zoeken = nieuw kosten- en betrouwbaarheidsbesluit | F9 | OPEN |
| OB-3 | "Trainer blijft leidend waar besloten" — de exacte lijst situaties waarin trainer boven Sparki-advies staat, is nergens als register vastgelegd | F4/F6/F11 | OPEN |
| OB-4 | Dossierplicht voor flag-gated foundation-adviezen: geldt "nieuw advies" per kalenderdatum of per oppervlak (oude paden day-advice/decideCoach vs foundation-run)? | F1 | OPEN — voorstel: per kalenderdatum, elk oppervlak |
| OB-5 | Bewaartermijn/inzagerecht adviesdossiers (privacy-export en 14-dagen-verwijdervenster raken dossiers) | F1 | OPEN — juridisch |
| OB-6 | Consent-kind + minor-beleid per nieuwe purpose (doelbewaking-melding, conflictvraag, dossier-inzage) | F3/F4/F7 | OPEN — voorstel volgt per fase |

## 2. Legacy-adviesinventarisatie

Bestaande adviesdragers van vóór het dossier, met voorstel:

| Adviesdrager | Opslag | Voorstel |
|---|---|---|
| Observaties (`ai_observations`) | signals JSONB, confidence, pattern | **Volledig dossier haalbaar bij nieuwe rijen** (schrijverspad is centraal: `persistObservation`); bestaande rijen `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` |
| Coach-verdicts/feedback (`analysis_feedback`) | context-JSONB (engine, ruleKey, confidence) | Nieuwe rijen: dossier haalbaar; bestaand: LEGACY (context deels aanwezig maar niet 20 velden) |
| Plan-voorstellen (`coach_change_proposals`, `planned_workout_changes`) | gestructureerd | Nieuwe: dossier haalbaar; bestaand: LEGACY |
| Race-evaluaties (`race_results`, `race_evaluations`) | gestructureerd | Nieuwe: dossier haalbaar; bestaand: LEGACY |
| Vandaag/day-advice, briefing, fueling, ontwikkelkompas, state card | **niet opgeslagen** (render-time) | Deze adviezen bestaan alleen op het moment van tonen; **vanaf F1 dossier-write bij tonen van een leidend advies**; historie van vóór F1 bestaat niet en wordt níet gereconstrueerd |
| Route-rationale, ride-story, document-analyse, materiaaladvies | deels opgeslagen bij het object | Nieuwe: dossier haalbaar via gateway-purpose; bestaand: LEGACY |
| `ai_call_logs` | metadata-only | Blijft wat het is (governance-log); wordt géén adviesdossier |

**Kernvoorstel:** de dossier-write komt op twee choke-points — (1) `persistObservation`/engine-facades voor deterministische adviezen, (2) de gateway voor LLM-adviezen — zodat geen enkel adviespad eromheen kan.

## 3. Verhouding tot lopende zaken

- TESTDEPLOY_SYNC_01-acceptatieomgeving is bevroren op zijn eigen SHA; AIE-fasen schuiven main door maar raken die omgeving niet zonder afstemming.
- Prod-schemadrift (`ui_preferences` ontbreekt in prod) is bestaand punt (taak #36) en gaat vóór elke AIE-migratie naar prod.
- MEDIA_UITLEG_01 F7 en MULTI_ROLE_CONTEXT_UX_01 staan los; geen codeoverlap verwacht behalve CMP-44 (niet-acute coachmelding) die later AIE-inhoud toont.
