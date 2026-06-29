---
name: Sparki insight grouping (grafiek-eerst)
description: Durable rules for how derived-observation insight cards are grouped per metric and rendered chart-first.
---

# Sparki insight grouping — "grafiek-eerst, minder tekst"

Derived-observation insight cards (the AiObservation lists on Trainen
"over tijd" and /you Core lenses) lead with a REAL chart, then a short read,
then an "Uitgebreid" disclosure. Same-metric observations collapse into ONE card.

**Why:** users saw several near-identical cards for one maatstaf (e.g. three HRV
cards). Repeating the text is noise; the trend data is the point. There is one
shared card + one grouping engine so every observation surface reads the same.

**How to apply / non-obvious rules:**
- Honesty contract is the hard constraint: a non-chartable insight maps to a
  null series → NO chart region; a real metric with too few points renders an
  explicit "nog geen meetreeks" state. NEVER synthesize a line to fill a chart.
- Two-tier only (short + Uitgebreid). The extended-content helper MUST be a
  function that can return `undefined` when there's no real depth — passing JSX
  directly is never null, so the disclosure toggle would open to nothing.
- /you grouping is GLOBAL, then routed to ONE lens: group ALL durable
  observations once (`groupObservations` over the reconstructed live set), render
  the overall lead group only in §03, then send every remaining group to exactly
  one lens via `observationLane(group.lead)` (the SSOT in `core-profile.ts`, also
  used by `categorizeObservations`). This is what stops the same maatstaf from
  reappearing in two sections (the "Geen check-in × 3" bug). Earlier per-section
  grouping let the lead repeat in a lens AND the same metric show across lenses.
- A metric's lens is decided by its LEAD observation's tone, so a metric lands in
  one lane only — it is not simultaneously a strength and a development point.
- Check-in / readiness reads classify to `recovery` (KIND_RULES regex includes
  `check-?in|incheck`) so day-specific titles collapse into one card instead of
  splitting across `other`/`recovery`/`hrv`.
- Resting-HR trend is "good when down"; daily metrics arrive newest-first and
  must be reversed to chronological before charting.
- SCOPE BOUNDARY: this pattern is for AiObservation *card lists*. The daily
  coach surface ("Sparki vandaag" / "Wat valt op") is a different engine — a
  single synthesized advice block, not a metric-card list — so the grafiek-eerst
  card does not apply there. Unifying those two engines (ownership/source-of-truth
  per insight kind to suppress cross-tab duplicates) is a separate, larger task.
