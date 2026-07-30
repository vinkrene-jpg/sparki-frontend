---
name: Sparki /train four-layer intelligence spine
description: How /train is composed from engine layers and why TodayLayer must not duplicate the shared coach card.
---

# /train four-layer spine

`/train` (TrainPage) is composed of four engine-driven layers + an input cluster, each a real surface that explains itself — never static widgets. **Presentation order: TodayLayer leads the page** (user demand: "begin de pagina met de voorgestelde training"), then Source → Goal → Patterns → Voed Sparki. The L1–L4 names below are engine identity, not page order:
- **TodayLayer** (page-first) — today's workout + `structure.rationale` + session-specific readiness/plan conflict (`detectReadinessConflict`). Session viz + target zone + Klaar/Overslaan. Empty-state copy points to Source layer as "hieronder" (it now sits below).
- **SourceLayer** — who drives the schema (trainer / Sparki / eigen invoer / none) from `useTrainingPlan`, plus build/adapt actions.
- **GoalLayer** — deterministic verdict (`op_koers`/`te_zwaar`/`te_licht`/`onbekend`) from `judgeGoalFit`, grounded in CTL/TSB/phase/weeksAway numbers; `onbekend` + honest `needs[]` when evidence thin. Renders ThreeWeekPlan (`id="three-week-plan"`, focus-scroll target).
- **PatternsLayer** — `ai_observations` + TrainingProgression, honest empty states.
- **Voed Sparki** — log session + Activity/Document/Route panels, de-numbered, grouped with a reason; stays last so "hierboven" in its subtitle stays correct.

Composition helpers live in `lib/train-intelligence.ts` (pure, deterministic, fail-closed).

## Critical: do not duplicate the shared coach card
**Rule:** `ScreenShell` already renders `CoachAnalysisCard` + `FollowUpPrompt` on every section in `COACH_CARD_SECTIONS` (`home/train/lab/races`). So TodayLayer must NOT render its own generic advice card or follow-up card — only the session-specific readiness conflict (which consumes `advice.intensity` but is genuinely additive).
**Why:** the daily coach read + its follow-up question are owned by the shell; re-rendering them in a layer double-asks the same question and repeats the same advice (violates the no-redundancy rule).
**How to apply:** before adding any "Sparki's daily read" or follow-up UI inside a `/train|/lab|/races` page child, check `screen-shell.tsx` `COACH_CARD_SECTIONS`/`showCoachCard` first — the shell already provides it. Reuse-only props `hideLabel`/`hideEmptyCta`/`hideRegenerate` exist on ThreeWeekPlan + `hideLabel` on TrainingProgression so they nest cleanly under layer headings.

## "Vandaag eerst" herinrichting (besluit René 30-07-2026)
- /train (core-plan.tsx) volgorde is bindend: Vandaag-blok → doelkaart → kalender → verbanden → ontwikkeling; mobiel = desktop.
- Vandaag-blok heeft altijd precies één verklaarde staat (trainingsdag/bewuste rustdag/ongepland gat + piekfase-waarschuwing) — nooit leeg-onverklaard. Pure helpers (bepaalVandaagStaat, faseWeekPositie, weekTypering, ontwikkelingTrend) leven in lib/plan-overview.ts en spiegelen de server-fasedrempels (taper ≤10, piek ≤28, opbouw ≤70 dagen tot race).
- "Verbanden analyseren"-knop is bewust verwijderd op /train: analyse start automatisch (één keer per bezoek, alleen bij analyseMogelijk) en lege staten zijn specifiek uit /api/ai/connections/readiness.
