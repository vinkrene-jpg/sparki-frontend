// Wegdek-verificatie-backfill (taak #496) — pure tests (geen DB, geen Overpass).
//
// Pint vast waar de eerlijkheid van de backfill op leunt:
//  - engineSurfaceFromAnalysis verzint nooit een meting (null-analyse → null),
//  - knownPct = 100 − onbekend, pavedPct = verhard aandeel van het GEMETEN deel,
//  - de meting draagt provider "osm_overpass" (nameting, geen motorkaart),
//  - de racefiets-verificatie leest de backfill-meting exact zoals een
//    motor-meting: knownPct<100 ⇒ "niet volledig geverifieerd",
//  - de bronvergelijking benoemt de nameting eerlijk als OSM-nameting.
//
// Run: `pnpm --filter @workspace/api-server run test:surface-backfill`
// Exits non-zero on any failure.

import {
  engineSurfaceFromAnalysis,
  BACKFILL_SURFACE_PROVIDER,
} from "../lib/surface-backfill";
import {
  racefietsEngineVerification,
  compareSurfaceSources,
  type RouteSurfacesAnalysis,
  type SurfaceBreakdownEntry,
  type SurfaceKind,
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

function analysisOf(
  entries: [SurfaceKind, number][],
  totalKm = 40,
): RouteSurfacesAnalysis {
  const breakdown: SurfaceBreakdownEntry[] = entries.map(([kind, pct]) => ({
    kind,
    km: Math.round(((pct / 100) * totalKm) * 10) / 10,
    pct,
    evidence: null,
  }));
  return { totalKm, breakdown, segments: [], forbiddenKm: 0, restrictedKm: 0 };
}

scenario("null/lege analyse levert nooit een meting (eerlijk gat)", () => {
  assert(engineSurfaceFromAnalysis(null) === null, "null-analyse → null");
  assert(engineSurfaceFromAnalysis(undefined) === null, "undefined → null");
  assert(
    engineSurfaceFromAnalysis(analysisOf([], 0)) === null,
    "analyse zonder afstand → null",
  );
});

scenario("volledig bekende, verharde route → knownPct 100, pavedPct 100", () => {
  const m = engineSurfaceFromAnalysis(
    analysisOf([
      ["asfalt", 90],
      ["verhard_fietspad", 10],
    ]),
    new Date("2026-07-30T10:00:00Z"),
  );
  assert(m != null, "meting verwacht");
  assert(m!.provider === BACKFILL_SURFACE_PROVIDER, `provider osm_overpass, got ${m!.provider}`);
  assert(m!.knownPct === 100, `knownPct 100, got ${m!.knownPct}`);
  assert(m!.pavedPct === 100, `pavedPct 100, got ${m!.pavedPct}`);
  assert(m!.measuredAt === "2026-07-30T10:00:00.000Z", "measuredAt uit klok");
});

scenario("onbekend deel drukt knownPct; pavedPct alleen over gemeten deel", () => {
  const m = engineSurfaceFromAnalysis(
    analysisOf([
      ["asfalt", 60],
      ["compact_gravel", 20],
      ["onbekend", 20],
    ]),
  );
  assert(m != null, "meting verwacht");
  assert(m!.knownPct === 80, `knownPct 80, got ${m!.knownPct}`);
  // 60 verhard van 80 gemeten = 75%.
  assert(m!.pavedPct === 75, `pavedPct 75, got ${m!.pavedPct}`);
});

scenario("kasseien/klinkers tellen als verhard, gravel/onverhard niet", () => {
  const m = engineSurfaceFromAnalysis(
    analysisOf([
      ["klinkers", 25],
      ["kasseien", 25],
      ["los_gravel", 25],
      ["onverhard", 25],
    ]),
  );
  assert(m != null && m.knownPct === 100, "alles gemeten");
  assert(m!.pavedPct === 50, `pavedPct 50, got ${m!.pavedPct}`);
});

scenario("volledig onbekend → knownPct 0, pavedPct eerlijk null", () => {
  const m = engineSurfaceFromAnalysis(analysisOf([["onbekend", 100]]));
  assert(m != null, "meting verwacht (knownPct 0 is een echte meting)");
  assert(m!.knownPct === 0, `knownPct 0, got ${m!.knownPct}`);
  assert(m!.pavedPct === null, "pavedPct null zonder gemeten deel");
});

scenario("racefiets-verificatie leest de backfill-meting exact als een motor-meting", () => {
  const partial = engineSurfaceFromAnalysis(
    analysisOf([
      ["asfalt", 92],
      ["onbekend", 8],
    ]),
  )!;
  const v1 = racefietsEngineVerification(partial.knownPct);
  assert(v1.status === "niet_volledig_geverifieerd", `partial → niet_volledig, got ${v1.status}`);
  assert(v1.onbekendPct === 8, `onbekendPct 8, got ${v1.onbekendPct}`);

  const full = engineSurfaceFromAnalysis(analysisOf([["asfalt", 100]]))!;
  const v2 = racefietsEngineVerification(full.knownPct);
  assert(v2.status === "geverifieerd", `full → geverifieerd, got ${v2.status}`);

  const none = racefietsEngineVerification(null);
  assert(none.status === "niet_gemeten", "null blijft eerlijk niet_gemeten");
});

scenario("bronvergelijking benoemt de nameting eerlijk als OSM-nameting", () => {
  const analysis = analysisOf([
    ["asfalt", 90],
    ["onbekend", 10],
  ]);
  const m = engineSurfaceFromAnalysis(analysis)!;
  const cmp = compareSurfaceSources(m, analysis);
  assert(cmp != null, "vergelijking verwacht");
  assert(
    cmp!.uitleg[0]!.startsWith("Nameting (OpenStreetMap)"),
    `nameting-uitleg verwacht, got: ${cmp!.uitleg[0]}`,
  );
  assert(
    !cmp!.uitleg[0]!.includes("vooraf gebouwde wegenkaart"),
    "nameting mag geen motorkaart-claim dragen",
  );
  // GraphHopper-metingen houden de bestaande motorkaart-uitleg.
  const gh = compareSurfaceSources(
    { provider: "graphhopper", pavedPct: 100, knownPct: 100, measuredAt: "x" },
    analysis,
  );
  assert(
    gh!.uitleg[0]!.startsWith("Routemotor (GraphHopper)"),
    "GraphHopper-uitleg intact",
  );
});

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
if (failed.length > 0) process.exit(1);
