---
name: Sparki observation near-duplicate collapse
description: Why expanded insight cards repeat the same fact, and where the dedupe must live.
---

# Same-fact observation paraphrases in expanded insight cards

Insight cards group same-metric `ai_observations` (lead + members) via
`groupObservations()`. The expanded "Uitgebreid"/"Meer" view used to render
EVERY member's `observationText`, so a metric with many rows showed ~10
near-identical paragraphs (classic case: FTP history retold over and over).

**Root cause is two-layered:**
1. The DB accumulates many same-topic rows because the LLM extraction
   (`computeDedupeKey` in `lib/ai-memory.ts`) keys on `category|detectedPattern||title`.
   When the LLM's title drifts ("FTP stijging" vs "Verbetering FTP"), the hash
   differs and a new row is inserted — duplicates by paraphrase.
2. The UI then rendered all of them verbatim.

**Decision: dedupe at PRESENTATION, not in `groupObservations`.**
`groupObservations` must keep all members (its tests assert member counts, and
grouping/ownership logic relies on the full set). The collapse lives in a shared
`dedupeObservationsByText()` helper applied only to the rendered `others` list
(seeded with the lead, capped to 3) in the three consumers: `/you`,
`PatternsLayer`, `ai-memory-panel`. `groupObservations(` is used ONLY in those
three UI files — fixing the helper there covers every grouped insight surface.

**Why the heuristic combines words AND numbers:** same-fact metric paraphrases
often share little prose but cite the SAME figures (262W/285W). Word
overlap-coefficient (≥0.6) alone missed them; an added number rule (≥2 shared
numbers, overlap ≥0.6) catches them. The ≥2-shared guard stops a single shared
year/value from merging genuinely different same-metric notes.

**Why presentation-only is enough (for WITHIN-card repetition):** it robustly
fixes the members-of-one-card case. Strengthening the backend dedupe key
(normalize salient numeric features instead of title) is a worthwhile FOLLOW-UP
to curb row growth, but is not required to fix the visible duplication.

## Refinement: cross-KIND fact collapse DOES live in `groupObservations`

There are TWO distinct repetition axes; keep them separate:
- **Within a card** (members of one metric group): handled at PRESENTATION by
  `dedupeObservationsByText` — do NOT drop members inside `groupObservations`.
- **Across cards** (the SAME fact persisted under several maatstaven, so one
  ride leads a volume card AND a herstel card AND the ftp story): handled by
  `dedupeObservationsByFact`, a pre-pass INSIDE `groupObservations` that keeps
  the strongest observation per fact-cluster and drops weaker cross-kind
  duplicates before bucketing by kind.

**Why this axis belongs in `groupObservations` (not presentation):** the
per-card presentation dedupe only sees one group's members at a time, so it
structurally cannot detect the same fact leading two *different* cards.
`groupObservations` is the one function that sees all kinds together.

**Guard (honesty over tidiness):** collapse only when notes share ≥2 figures
(overlap ≥0.6) **AND** at least one shared NON-numeric content word. The
non-numeric requirement matters because numeric tokens (e.g. "285") also live in
the word set — without excluding them, the shared figures being matched would
satisfy the word guard by themselves, wrongly merging a watt reading and a
sleep-minutes reading that coincidentally cite the same numbers. Text-only notes
never merge here. The `groupObservations` member-count tests still hold because
they use number-free titles (the pre-pass is a no-op for them).
