# Sparki Governor Fase 1 — Verschilregister t.o.v. Master Plan v3.02

**Audit-commit:** `7e2f1983` · Bron: SPARKI_AI_MASTER_PLAN_v3_02.yaml (19.726 regels, domain_registry ~40 domeinen)
Regel: bij twijfel niet gokken → `SOURCE_EVIDENCE_MISSING` of `CONFLICT_REQUIRES_REVIEW`.

## Register (per domein/eis)

| Onderdeel (Master Plan) | Classificatie | Bewijs/toelichting |
|---|---|---|
| TODAY (dagstart, aandachtswet) | MASTER_PLAN_MATCH | /vandaag, day-home met leidend momentblok |
| AUTONOMOUS_TRAINING_COACH | MASTER_PLAN_MATCH | Coach-loze planmotor, deterministische cijfers, GO-gate |
| TRAINING_PLANS_AND_CALENDAR | MASTER_PLAN_MATCH | /train + /kalender, plan-lifecycle |
| CYCLING_STRENGTH_TRAINING | MASTER_PLAN_MISSING | Spec ready in plan; niets in code gevonden |
| COACH_TRAINER (basis) | PARTIAL_IMPLEMENTATION | CoachHome/cockpit bestaat; trainer/hoofdtrainer-onderscheid ontbreekt |
| TRAINER_PASSPORT / TRAINER_CAMPUS / TRAINER_SEARCH_ONBOARDING | MASTER_PLAN_MISSING | Geen code-spoor |
| CLUB_TEAM | PARTIAL_IMPLEMENTATION | /club + beheer + least-privilege rechten; TEAM_LEADER-rol en Team-functies deels (volgauto) |
| PARENT_MINOR | PARTIAL_IMPLEMENTATION | Ouderomgeving + consents fail-closed; volledige jeugd-release-eisen (SCOPE_REINSTATEMENT, release-blocking) niet integraal geverifieerd |
| MEDICAL_BOUNDARY | MASTER_PLAN_MATCH | Geen medische claims; health-flow eerlijk |
| RECOVERY_HEALTH | MASTER_PLAN_MATCH | Herstel/gezondheidsflow, raises-only, resume-gate |
| MENTAL_SKILLS | MASTER_PLAN_MATCH | Mentale-trainingkaarten met diepgangsniveaus |
| NUTRITION | MASTER_PLAN_MATCH | Voedingssheet, fueling-engine, seizoensdoel 17+ |
| LAB_AND_LOAD | MASTER_PLAN_MATCH | Performance Lab, computeLoadSeries SSOT |
| SPORT_PASSPORT | MASTER_PLAN_MATCH | /paspoort, herkomstlaag |
| KNOWLEDGE_EXPLANATION | MASTER_PLAN_MATCH | Kennisbank (governed) + uitleglaag; wel TE_TECHNISCH-gaten (content-rapport) |
| ANALYTICS_VISUALIZATION | PARTIAL_IMPLEMENTATION | Grafieken compleet; as-eenheden en desktop-lichtthema wijken af van contract |
| ROUTES_NAVIGATION | MASTER_PLAN_MATCH | Planner, bibliotheek, navigatie, mobiel HUD |
| RACE_INTELLIGENCE | MASTER_PLAN_MATCH | Race-intel, dossier, wizard, room |
| MOBILE_RECORDING_SENSORS | MASTER_PLAN_MATCH | Expo-app: opname, BLE, val-alarm, volgauto |
| Commercieel model FREE/GO/COMPLETE, prijzen, 14d trial | PARTIAL_IMPLEMENTATION | Tiers + entitlement-laag bestaan; Stripe-flags uit, trial niet live, GO/COMPLETE-verdeling wijkt af |
| GO=navigatie-plus vs COMPLETE=coaching | CONFLICT_REQUIRES_REVIEW | Code plaatst coaching-features (autonomous_training, ai_observations, performance_lab, race_intel) onder GO_FEATURE_KEYS |
| Club/Team-abonnementen (Governor-opdracht fase 4) | CONFLICT_REQUIRES_REVIEW | Niet in Master Plan-commercial_subscription_model en niet in code; opdracht en plan spreken elkaar tegen |
| Dark theme verplicht | CONFLICT_REQUIRES_REVIEW | /analyse desktop is licht |
| Max 5 mobiele bestemmingen | MASTER_PLAN_MATCH | Exact 5 |
| Gebruikersconfigureerbare navigatie + restore-to-V0 | MASTER_PLAN_MISSING | Geen code-spoor |
| Geen ongebruikte capability-kaarten | MASTER_PLAN_MATCH | Steekproef schoon |
| i18n-fundament (key-catalog) NU vereist | MASTER_PLAN_MISSING | Copy hard-coded NL (UI + LLM-prompts) |
| 24 EU-talen, landensites | MASTER_PLAN_MISSING | Besluit EU-breed genomen; bouw niet gestart |
| Rollen: 8 platformrollen + rene_role_switcher | PARTIAL_IMPLEMENTATION | 3 rollen + admin-boolean; switchRole bestaat |
| Game-laag nieuwbouw | SUPERSEDED | REMOVED_FROM_ACTIVE_ROADMAP; runtimes behouden |
| Multisport | DEFERRED | Expliciet besluit |
| ADULT_DATING | SUPERSEDED | Verwijderd per René-besluit; nooit gebouwd |
| Stripe live betalen | DEFERRED | Wacht op akkoord (taak #379) |
| Geluid/wekker, Photo Lab, Rit-verhaal, Bordjes-sprint, Sparki World als plan-eis | SOURCE_EVIDENCE_MISSING | Bestaan in code op basis van eerdere opdrachten; geen expliciete v3.02-regel gevonden |
| Open besluiten OD_001 (prijs), OD_002 (trial), OD_005 (datacleaning), OD_006/007/009 (EU-landen) | CONFLICT_REQUIRES_REVIEW | Door René te beslissen; code mag hier niet op vooruitlopen |

## Telling

- MASTER_PLAN_MATCH: 14 · MASTER_PLAN_MISSING: 6 · PARTIAL_IMPLEMENTATION: 6 · CONFLICT_REQUIRES_REVIEW: 5 · SUPERSEDED: 2 · DEFERRED: 2 · SOURCE_EVIDENCE_MISSING: 1 (cluster) · HIDDEN_IMPLEMENTATION: 1 (/photo-lab).
- **Master Plan-gaten (MISSING+PARTIAL): 12.**
