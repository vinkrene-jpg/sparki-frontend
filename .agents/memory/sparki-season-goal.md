---
name: Sparki nutrition season goal
description: 17+ weight-steering season goal — safety rules, doorvraag ladder, prompt-injection pattern
---

# Nutrition season goal (17+)

- **Age gate is a safety rule, not a UI preference.** Under-17 gets NO weight steering at all (RED-S): GET returns honest `too_young` payload, PUT returns 403, frontend hides the section entirely. Missing birth year is its own honest state (`birth_year_missing`) prompting the profile, never a silent default-to-adult.
- **Steering is deterministic, never LLM-computed.** Delta/weeks/required-kg-per-week computed server-side; hard cap 0,5 kg/week; infeasible pace gets an explicit warning and the copy states nutrition never steers faster. The LLM only receives the computed block as prompt context with the rule "training always fully fueled, never crash diets".
- **Current weight stays SSOT on athlete_profiles.weightKg** — the goal table stores only target/dates/note; answering "huidig gewicht" writes to the profile.
- **Doorvraag ladder pattern:** backend returns exactly ONE `nextQuestion` (field+question+why) in fixed order; frontend renders a single-input card, never a form. Answered values become editable chips.
- **Why:** youth eating-disorder risk + honesty doctrine; also regex-only date validation is not enough — `2026-99-99` passes `\d{4}-\d{2}-\d{2}` and 500s at the DB; always round-trip parse calendar dates.
