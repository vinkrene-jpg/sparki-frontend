// Wegdek-bronnenvergelijking + Overpass-truncatiedetectie (taak #438) —
// hermetische unit-test op het eerlijkheidscontract:
//
//   1. overpassLooksTruncated: plafond of Overpass-"remark" = afgekapt; een
//      normaal antwoord niet.
//   2. compareSurfaceSources: Hengelo-patroon (motor kent alles, scherm
//      grotendeels onbekend) = "tegenspraak" met uitleg per bron.
//   3. Dalfsen-patroon (motor ~100% verhard, scherm meet (half)onverhard) =
//      "tegenspraak" met advies om het scherm aan te houden.
//   4. Metingen in lijn = "consistent"; zonder motor-meting = null (geen
//      verzonnen vergelijking).
//
// Run: `pnpm --filter @workspace/api-server run test:route-surface-sources`
// (via shell — de workflow-limiet is bereikt; bewust geen nieuwe workflow.)

import {
  compareSurfaceSources,
  overpassLooksTruncated,
  OVERPASS_OUT_LIMIT,
  type RouteSurfacesAnalysis,
} from "../lib/route-surfaces";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

function analysisWith(
  pcts: Partial<Record<string, number>>,
  bgt = false,
): RouteSurfacesAnalysis {
  return {
    totalKm: 48,
    breakdown: Object.entries(pcts).map(([kind, pct]) => ({
      kind: kind as never,
      km: Math.round(((pct ?? 0) / 100) * 48 * 10) / 10,
      pct: pct ?? 0,
      evidence: null,
    })),
    segments: [],
    forbiddenKm: 0,
    restrictedKm: 0,
    bgt: bgt ? { checkedSamples: 10, resolvedSamples: 5, source: { name: "BGT" } as never } : null,
  };
}

const engine = (pavedPct: number | null, knownPct: number | null) => ({
  provider: "graphhopper",
  pavedPct,
  knownPct,
  measuredAt: "2026-07-30T10:00:00.000Z",
});

scenario("truncatie: element-plafond geraakt = afgekapt", () => {
  assert(overpassLooksTruncated(OVERPASS_OUT_LIMIT, null), "plafond moet als afgekapt gelden");
  assert(!overpassLooksTruncated(OVERPASS_OUT_LIMIT - 1, null), "onder plafond zonder remark = compleet");
});

scenario("truncatie: Overpass-remark (timeout/geheugen) = afgekapt", () => {
  assert(
    overpassLooksTruncated(120, "runtime error: Query timed out in \"query\" at line 2"),
    "timeout-remark moet als afgekapt gelden",
  );
  assert(!overpassLooksTruncated(120, ""), "lege remark = compleet");
  assert(!overpassLooksTruncated(120, "informational note"), "onschuldige remark = compleet");
});

scenario("Hengelo-patroon: motor kent alles, scherm 60% onbekend = tegenspraak", () => {
  const c = compareSurfaceSources(
    engine(100, 86),
    analysisWith({ asfalt: 35, verhard_fietspad: 4.3, onbekend: 60.7 }),
  );
  assert(c, "vergelijking verwacht");
  assert(c!.oordeel === "tegenspraak", `verwacht tegenspraak, kreeg ${c!.oordeel}`);
  assert(c!.scherm.onbekendPct === 60.7, "scherm-onbekend moet doorgegeven worden");
  assert(
    c!.uitleg.some((u) => u.includes("kiest niet stil één bron")),
    "uitleg moet expliciet zeggen dat er niet stil één bron gekozen wordt",
  );
  assert(c!.uitleg.length >= 3, "uitleg per bron + verschil verwacht");
});

scenario("Dalfsen-patroon: motor ~100% verhard, scherm meet onverhard = tegenspraak", () => {
  const c = compareSurfaceSources(
    engine(99.9, 83),
    analysisWith({ asfalt: 80, compact_gravel: 6, onverhard: 4, onbekend: 10 }),
  );
  assert(c!.oordeel === "tegenspraak", `verwacht tegenspraak, kreeg ${c!.oordeel}`);
  assert(
    c!.uitleg.some((u) => u.includes("verouderd")),
    "uitleg moet de mogelijk verouderde motorkaart benoemen",
  );
});

scenario("metingen in lijn = consistent (met uitleg per bron)", () => {
  const c = compareSurfaceSources(
    engine(99, 90),
    analysisWith({ asfalt: 90, verhard_fietspad: 5, onbekend: 5 }, true),
  );
  assert(c!.oordeel === "consistent", `verwacht consistent, kreeg ${c!.oordeel}`);
  assert(c!.uitleg.some((u) => u.includes("BGT")), "BGT hoort in de bron-uitleg wanneer geraadpleegd");
  assert(c!.uitleg.some((u) => u.includes("in lijn")), "consistent-oordeel hoort uitgelegd");
});

scenario("zonder motor-meting geen verzonnen vergelijking (null)", () => {
  assert(
    compareSurfaceSources(null, analysisWith({ asfalt: 100 })) === null,
    "null-engine = null",
  );
  assert(
    compareSurfaceSources(engine(null, null), analysisWith({ asfalt: 100 })) === null,
    "lege meting = null",
  );
});

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
if (failed.length > 0) process.exit(1);
