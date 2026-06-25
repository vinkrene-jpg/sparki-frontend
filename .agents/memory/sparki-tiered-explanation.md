---
name: Sparki two-tier explanation standard
description: App-wide short-by-default + expand-for-depth pattern; only tier where real extended data exists (no fabricated depth).
---

# Two-tier explanation standard

Sparki explanations/values/analyses/advice must show a SHORT, directly readable
version first, with a single button to expand to an EXTENDED version that adds
more depth + real data (not necessarily more text). Short is ALWAYS the default;
no persisted preference — every open starts collapsed.

Reusable building block: `components/sparki/tiered-explanation.tsx`
- `TieredExplanation({ short, extended? })` — short always visible; renders the
  "Uitgebreid"/"Minder" toggle ONLY when `extended` is provided.
- `PlainTextParagraphs({ text })` — splits blank-line-separated plain text into
  styled paragraphs and strips stray markdown.

**Why:** the workout "Waarom?" panel was a wall of text; the athlete should
choose how much detail they get.

**How to apply / the hard constraint:** only wire a second tier where a REAL
extended source exists. Do NOT force a tier onto already-short content (one-line
`rationale`/`why`, the 2–4 sentence daily `brief`, `plan.summary`) — inventing
"depth" to fill an expand panel violates the project's no-fabrication rule. Those
one-liners already satisfy "start with the short version".

**Latency / two-phase rule (avoid the spinner "hang"):** when the extended tier
is an LLM generation, do NOT generate short+extended in one call — a multi-
paragraph generation is ~20s and the "Sparki denkt na…" spinner reads as a
freeze. Split it: a fast SHORT-only endpoint (`/workout-explain`, ~4–5s, small
max_tokens) paints first; the heavy EXTENDED (`/workout-explain-extended`, ~18s)
loads ONLY when the athlete opens "Uitgebreid". `TieredExplanation` supports this
lazy mode: `hasExtended` (force-show the toggle before content loads), `onExpand`
(fires once on first expand → trigger the fetch), `extendedPending` (shows an
inline spinner). On extended error, collapsing/re-expanding retries (no dead-end).

Reference for the data shape: the AI-memory `ObservationCard`
(`ai-memory-panel.tsx`) already implements the contract natively via
`summary` (short) → `observationText` + `signals` + `alternativeExplanations` +
`recommendedAction` (depth). When a backend endpoint only returns one blob,
change it to return grounded `{ short, extended }` JSON (see
`/api/ai/workout-explain`) rather than splitting text client-side.
