---
name: Sparki /train four-layer intelligence spine
description: How /train is composed from engine layers and why TodayLayer must not duplicate the shared coach card.
---

# /train four-layer spine

`/train` (TrainPage) is composed of four engine-driven layers + an input cluster, each a real surface that explains itself — never static widgets:
- **L1 SourceLayer** — who drives the schema (trainer / Sparki / eigen invoer / none) from `useTrainingPlan`, plus build/adapt actions.
- **L2 GoalLayer** — deterministic verdict (`op_koers`/`te_zwaar`/`te_licht`/`onbekend`) from `judgeGoalFit`, grounded in CTL/TSB/phase/weeksAway numbers; `onbekend` + honest `needs[]` when evidence thin. Renders ThreeWeekPlan.
- **L3 TodayLayer** — today's workout + `structure.rationale` + session-specific readiness/plan conflict (`detectReadinessConflict`). Session viz + target zone + Klaar/Overslaan.
- **L4 PatternsLayer** — `ai_observations` + TrainingProgression, honest empty states.
- **Voed Sparki** — log session + Activity/Document/Route panels, de-numbered, grouped with a reason.

Composition helpers live in `lib/train-intelligence.ts` (pure, deterministic, fail-closed).

## Critical: do not duplicate the shared coach card
**Rule:** `ScreenShell` already renders `CoachAnalysisCard` + `FollowUpPrompt` on every section in `COACH_CARD_SECTIONS` (`home/train/lab/races`). So TodayLayer must NOT render its own generic advice card or follow-up card — only the session-specific readiness conflict (which consumes `advice.intensity` but is genuinely additive).
**Why:** the daily coach read + its follow-up question are owned by the shell; re-rendering them in a layer double-asks the same question and repeats the same advice (violates the no-redundancy rule).
**How to apply:** before adding any "Sparki's daily read" or follow-up UI inside a `/train|/lab|/races` page child, check `screen-shell.tsx` `COACH_CARD_SECTIONS`/`showCoachCard` first — the shell already provides it. Reuse-only props `hideLabel`/`hideEmptyCta`/`hideRegenerate` exist on ThreeWeekPlan + `hideLabel` on TrainingProgression so they nest cleanly under layer headings.
