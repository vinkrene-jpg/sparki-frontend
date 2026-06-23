---
name: Sparki knowledge base relevance guard
description: Why the literature-ingestion relevance filter must be word-boundary based, and how arXiv-style broad queries leak off-topic papers.
---

# Knowledge base — honest relevance guard

The knowledge base scans free scientific APIs (Europe PMC, Crossref, OpenAlex, arXiv)
whose queries match loosely. Off-topic real papers (wastewater "effluent", soil,
astrophysics) come back and must be dropped before AI summarise/tag — never altered or
faked. The guard lives in `src/lib/knowledge/sources.ts` (`isResearchRelevant`,
applied in `fetchAllSources`).

## Rule: match on word boundaries, not substrings
**Why:** naive `hay.includes("sport")` matches "tran**sport**"; `includes("cycl")`
matches "**cycl**ic"/"re**cycl**ing"; bare "aerobic"/"running" appear in chemistry and
physics ("aerobic digestion", "running coupling"). These produced real off-topic leaks
that got tagged with sport disciplines (e.g. effluent→sportwetenschap, astro→sportnieuws).
**How to apply:** use anchored regexes (`/\bsport/i`, `/\bcycling\b/i`,
`/aerobic (capacity|exercise|fitness|power|performance)/i`, etc.), keep the list
sport-/exercise-/athlete-specific, and prefer dropping a borderline real paper over
admitting an off-topic one. arXiv `all:` queries are especially noisy (mostly physics/CS);
rely on this guard to filter them rather than trusting the query.

## Verification shortcut
Full uncapped scans are slow (Anthropic rate-limit backoffs). Verify with capped runs:
`KNOWLEDGE_MAX_NEW` + `KNOWLEDGE_CONCURRENCY` env on `node dist/jobs/knowledge-scan.mjs`.
The scan logs a synchronous `knowledge-scan summary: {...}` line. Re-runs must skip
existing items (idempotent via `dedupeKey`). Prod uses a Scheduled Deployment (no time limit).
