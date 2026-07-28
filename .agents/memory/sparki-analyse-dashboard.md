---
name: Analyse-dashboard engine reuse contract
description: /analyse charts and /you kerngrafieken must share lib/analyse-dashboard.ts
---

The full /analyse dashboard derives ALL series and KPIs from the pure engine `artifacts/sparki/src/lib/analyse-dashboard.ts` (week volume, intensity buckets, weight/W-kg, goal overlays, compare series, data reliability, laatste sync, `analyseSamenvatting`).

**Rule:** any /you (Core) kerngrafieken or summary work MUST consume this engine in summary mode (`analyseSamenvatting` + the series builders) — never re-implement the math.
**Why:** the dashboard brief requires one shared engine so /analyse and /you can never diverge; numbers shown twice must come from one source.
**How to apply:** import from `lib/analyse-dashboard.ts`; API decimal columns arrive as strings — coerce with its `alsGetal`. Goal overlays only render for status=active goals with strict-parsed plausible values; otherwise charts stay bare (no fabricated targets). Race markers extend the load-chart axis max 21 future days.
