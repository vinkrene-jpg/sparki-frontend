---
name: Sparki insight grouping (grafiek-eerst)
description: How insight/observation cards are grouped per metric and rendered chart-first across /train and /you.
---

# Sparki insight grouping — "grafiek-eerst, minder tekst"

Insight cards (derived `AiObservation`s) lead with a REAL chart, then a short read,
then an "Uitgebreid" expand. Same-metric observations collapse into ONE card so the
same explanation does not repeat.

**Why:** users were seeing several near-identical cards for one maatstaf (e.g. three
HRV cards). Leading with text and repeating it is noise; the data is the point.

**How to apply:**
- `lib/insight-grouping.ts` is the SSOT: `classifyObservation` → `MetricKind`
  (hrv/rhr/sleep/recovery/ftp/fitness/volume/form/frequency/other);
  `seriesForKind` maps a kind to its REAL series from
  `{metrics, ftpHistory, load, sessions}`; `groupObservations` collapses per kind
  to `{lead, members, series}` and sorts strongest-first.
- `components/sparki/insight/graph-insight-card.tsx` is the shared card. Reuse it,
  do not re-implement a card per surface.
- Honesty contract (do NOT break): non-chartable insight → `series: null` →
  no chart region. A real metric with <2 points → series with empty/short
  `values` → card shows "Nog geen meetreeks…". NEVER fabricate a line.
- Two-tier only (short + Uitgebreid) via `TieredExplanation`. The `extended`
  render helper MUST return `undefined` when there is no real depth, otherwise the
  toggle shows but opens to nothing (passing `<Comp/>` JSX is never null → always
  shows toggle; call a render *function* that can return undefined instead).
- `/you` grouping is per-lens (strengths/development/patterns/uncertainty each
  grouped independently): the SAME metric can legitimately be both a strength and a
  development point, so do NOT group across lenses.
- `rhr` (rusthart) carries `trendGoodWhenDown: true` — a downward trend is good.
- Metrics from the API are newest-first; `seriesForKind` reverses to chronological.
- Coverage: `lib/insight-grouping.test.ts` (`pnpm --filter @workspace/sparki run
  test:insight-grouping`).
