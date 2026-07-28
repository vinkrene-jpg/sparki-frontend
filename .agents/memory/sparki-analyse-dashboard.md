---
name: Analyse-dashboard engine reuse contract
description: /analyse charts and /you kerngrafieken must share lib/analyse-dashboard.ts
---

The full /analyse dashboard derives ALL series and KPIs from the pure engine `artifacts/sparki/src/lib/analyse-dashboard.ts` (week volume, intensity buckets, weight/W-kg, goal overlays, compare series, data reliability, laatste sync, `analyseSamenvatting`).

**Rule:** any /you (Core) kerngrafieken or summary work MUST consume this engine in summary mode (`analyseSamenvatting` + the series builders) — never re-implement the math.
**Why:** the dashboard brief requires one shared engine so /analyse and /you can never diverge; numbers shown twice must come from one source.
**How to apply:** import from `lib/analyse-dashboard.ts`; API decimal columns arrive as strings — coerce with its `alsGetal`. Goal overlays only render for status=active goals with strict-parsed plausible values; otherwise charts stay bare (no fabricated targets). Race markers extend the load-chart axis max 21 future days.

## Doelscenario & uitleg-stand (jul 2026)
- Scenario-projectie ("wat als +20% volume") is `belastingProjectie` in lib/analyse-dashboard.ts — zelfde CTL/ATL-model, basis = echte TSS laatste 28d, geeft `null` zonder echte scores (nooit verzonnen basis). Band ±15%, vaste kleur CHART.verwacht (paars), gerenderd als recharts range-Area (`projBand: [lo,hi]` als dataKey-waarde) + gestreepte middenlijn.
- **Waarom:** verwachting expliciet als band tonen ("geen vaste wetenschap"); race-marker-asverlenging staat uit zodra projectie actief is (projectie wint).
- Uitleg-stand: paginabrede toggle via React-context; kaarten tonen wat+waarom uit het centrale UITLEG-registry — nooit ad-hoc uitlegtekst.
- Open-loop teaser-copy (api-server engines/insights/open-loops.ts) mag nooit méér claimen dan zijn evidence-gate ("opvallende afwijking" bij alleen ≥5 sessies is verboden).
