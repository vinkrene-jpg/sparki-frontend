---
name: Sparki news feed freshness & ranking
description: Why the daily news went stale and the self-healing + recency-dominant curation pattern that fixed it.
---

# Sparki news feed freshness & ranking

## The rot: user-configured Scheduled Deployment silently stops
The knowledge-scan job (RSS news + science) was only ever run by a Replit
**Scheduled Deployment** the user configures in Publishing. A non-technical user
never set it up, so news froze for weeks (newest row stuck ~18 days old) while
everything looked "healthy" — the pipeline itself works fine when run manually.

**Rule:** any data pipeline whose only trigger is a user-configured Scheduled
Deployment will silently rot. Add a **self-healing lazy refresh on the READ
path** so freshness never depends on someone remembering to wire a cron.

**How to apply:** the Feed news endpoint calls `maybeRefreshNews()`
(`lib/knowledge/refresh.ts`) fire-and-forget. It kicks a news-only scan when the
newest news is stale (>6h), guarded by a module-level `inFlight` lock + a 1h
min-gap, never blocks the response, never throws, idempotent via `dedupeKey`.
The triggering request serves current items; the refresh lands for the next
visit. Lock is process-local (fine at single-instance; multi-instance just does
redundant, harmless idempotent scans).

## Ranking: recency must dominate a *daily* stream
Old ranking let an old keyword-matching item outrank fresh news, one outlet
flooded the top, and the same race appeared 3× from 3 sources. Fixed in
`getPersonalizedNews` (`lib/knowledge/retrieval.ts`):
- **Recency-dominant** score (`recencyPoints` 12..0 by age buckets); keyword
  weight capped (≤3 hits ×2) and discipline reduced so freshness leads.
- **Cross-source near-duplicate collapse**: `overlapCoefficient` ≥0.6 on
  significant title words (len≥4, minus NL/EN stopwords), keep best-scored.
- **Source-diversity interleave**: greedy pick best remaining item from a source
  other than the previous pick.
- **Drop >60d-stale only when enough fresh remain** — never returns empty.
Honesty preserved: only reorders/de-dupes REAL rows, never fabricates.

## RSS blockers
Some publishers 406/403 the bot UA (BikeRadar). `fetchNewsFeed` retries ONCE
with a browser UA on 401/403/406/429/451. Only re-requests the same public URL.

## maxNew cap starves late-listed feeds (fetch-order slice)
The scan's `maxNew` budget was applied by slicing new candidates in fetch
order, so feeds listed first (Cyclingnews/Velo/Escape) consumed the entire cap
every run and later feeds (WielerFlits/NOS) NEVER ingested — they looked
"broken" while their RSS was fine.

**Rule:** any global per-run cap over multi-source candidates must be shared
fairly (round-robin per source) before slicing, or late sources starve forever.

## Dutch titles (title_nl)
`knowledge_items.title_nl` holds an LLM Dutch translation of the real title
(proper nouns kept, unchanged if already Dutch). Set at scan-insert; older rows
heal via `translateMissingNewsTitles` (bounded 30/run) which the read-path
`maybeRefreshNews` ALWAYS runs (even when the scan itself is fresh). UI renders
`titleNl ?? title`; the reader shows "Oorspronkelijke kop: …" attribution.
Ranking gives Dutch outlets a small +2 bonus; recency still dominates.
