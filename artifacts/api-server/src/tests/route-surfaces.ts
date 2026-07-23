// Wegtypen & ondergrond — pure-compute test op de deterministische kern.
//
// Getest zonder netwerk: de tag-classifier (10 categorieën, uitsluitend
// aantoonbare OSM-tags, "onbekend" bij twijfel — nooit verzonnen), de
// aggregatie route↔wegen (km-sommen tellen op tot het totaal, segmenten,
// toegangsbeperkingen) en de geschiktheidsregels per fietstype mét redenen.
//
// Run: `pnpm --filter @workspace/api-server run test:route-surfaces`

import {
  classifySurfaceTags,
  aggregateSurfaces,
  computeBikeSuitability,
  maxSlopePct,
  surfacesSource,
  type RouteSurfacesAnalysis,
} from "../lib/route-surfaces";
import type { OverpassElement } from "../lib/route-remarks";
import type { RoutePathPoint } from "@workspace/db";

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

// ── Classifier ──────────────────────────────────────────────────────────────

scenario("surface=asphalt op een weg is asfalt", () => {
  const c = classifySurfaceTags({ highway: "residential", surface: "asphalt" });
  assert(c && c.kind === "asfalt", `kind: ${c?.kind}`);
  assert(c!.evidence === "surface=asphalt", `evidence: ${c!.evidence}`);
});

scenario("cycleway + asfalt is verhard fietspad", () => {
  const c = classifySurfaceTags({ highway: "cycleway", surface: "asphalt" });
  assert(c && c.kind === "verhard_fietspad", `kind: ${c?.kind}`);
});

scenario("cycleway ZONDER surface is eerlijk onbekend (niet verzonnen asfalt)", () => {
  const c = classifySurfaceTags({ highway: "cycleway" });
  assert(c && c.kind === "onbekend", `kind: ${c?.kind}`);
  assert(c!.evidence.includes("zonder surface"), `evidence: ${c!.evidence}`);
});

scenario("paving_stones is klinkers, sett is kasseien", () => {
  const k = classifySurfaceTags({ highway: "residential", surface: "paving_stones" });
  assert(k && k.kind === "klinkers", `kind: ${k?.kind}`);
  const s = classifySurfaceTags({ highway: "residential", surface: "sett" });
  assert(s && s.kind === "kasseien", `kind: ${s?.kind}`);
});

scenario("compacted/fine_gravel is compact gravel; gravel is los gravel", () => {
  const c = classifySurfaceTags({ highway: "track", surface: "compacted" });
  assert(c && c.kind === "compact_gravel", `kind: ${c?.kind}`);
  const f = classifySurfaceTags({ highway: "track", surface: "fine_gravel" });
  assert(f && f.kind === "compact_gravel", `kind: ${f?.kind}`);
  const l = classifySurfaceTags({ highway: "track", surface: "gravel" });
  assert(l && l.kind === "los_gravel", `kind: ${l?.kind}`);
});

scenario("onverharde weg vs bospad (zelfde surface, ander padtype)", () => {
  const w = classifySurfaceTags({ highway: "track", surface: "dirt" });
  assert(w && w.kind === "onverhard", `kind: ${w?.kind}`);
  const p = classifySurfaceTags({ highway: "path", surface: "dirt" });
  assert(p && p.kind === "bospad", `kind: ${p?.kind}`);
});

scenario("path met mtb:scale is singletrack", () => {
  const c = classifySurfaceTags({ highway: "path", "mtb:scale": "1" });
  assert(c && c.kind === "singletrack", `kind: ${c?.kind}`);
  assert(c!.evidence.includes("mtb:scale=1"), `evidence: ${c!.evidence}`);
});

scenario("tracktype zonder surface: grade1=asfalt … grade5=onverhard", () => {
  assert(classifySurfaceTags({ highway: "track", tracktype: "grade1" })!.kind === "asfalt", "grade1");
  assert(classifySurfaceTags({ highway: "track", tracktype: "grade2" })!.kind === "compact_gravel", "grade2");
  assert(classifySurfaceTags({ highway: "track", tracktype: "grade3" })!.kind === "los_gravel", "grade3");
  assert(classifySurfaceTags({ highway: "track", tracktype: "grade5" })!.kind === "onverhard", "grade5");
});

scenario("path/footway ZONDER surface is eerlijk onbekend (geen verzonnen bospad)", () => {
  const p = classifySurfaceTags({ highway: "path" });
  assert(p && p.kind === "onbekend", `path: ${p?.kind}`);
  const f = classifySurfaceTags({ highway: "footway" });
  assert(f && f.kind === "onbekend", `footway: ${f?.kind}`);
  assert(f!.evidence.includes("zonder surface"), `evidence: ${f!.evidence}`);
});

scenario("weg zonder surface-tag is onbekend; niet-weg is null", () => {
  const c = classifySurfaceTags({ highway: "residential" });
  assert(c && c.kind === "onbekend", `kind: ${c?.kind}`);
  assert(classifySurfaceTags({ waterway: "river" }) === null, "geen highway = null");
});

scenario("onherkenbare surface-waarde is eerlijk onbekend", () => {
  const c = classifySurfaceTags({ highway: "residential", surface: "metal" });
  assert(c && c.kind === "onbekend", `kind: ${c?.kind}`);
  assert(c!.evidence.includes("niet herkend"), `evidence: ${c!.evidence}`);
});

// ── Aggregatie ──────────────────────────────────────────────────────────────

// Rechte oost-west route van ~2,2 km op 52°N (0.001° lon ≈ 68 m).
function straightRoute(n: number): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i < n; i++) pts.push([52.0, 5.0 + i * 0.001]);
  return pts;
}

function wayAlong(
  fromLon: number,
  toLon: number,
  tags: Record<string, string>,
  id = 1,
): OverpassElement {
  return {
    type: "way",
    id,
    tags,
    geometry: [
      { lat: 52.0, lon: fromLon },
      { lat: 52.0, lon: toLon },
    ],
  };
}

scenario("aggregatie: km-sommen tellen op tot het totaal", () => {
  const geometry = straightRoute(33); // ~2,2 km
  const a = aggregateSurfaces(geometry, [
    wayAlong(5.0, 5.016, { highway: "residential", surface: "asphalt" }, 1),
    wayAlong(5.016, 5.032, { highway: "track", surface: "gravel" }, 2),
  ]);
  const sum = a.breakdown.reduce((s, b) => s + b.km, 0);
  assert(Math.abs(sum - a.totalKm) < 0.25, `som ${sum} ≠ totaal ${a.totalKm}`);
  const kinds = a.breakdown.map((b) => b.kind);
  assert(kinds.includes("asfalt") && kinds.includes("los_gravel"), `kinds: ${kinds.join()}`);
});

scenario("route zonder wegen in de buurt is 100% onbekend", () => {
  const geometry = straightRoute(20);
  const a = aggregateSurfaces(geometry, [
    // Weg 1+ km verderop: mag NIET matchen.
    { type: "way", id: 9, tags: { highway: "residential", surface: "asphalt" }, geometry: [{ lat: 52.02, lon: 5.0 }, { lat: 52.02, lon: 5.02 }] },
  ]);
  assert(a.breakdown.length === 1, `breakdown: ${a.breakdown.length}`);
  assert(a.breakdown[0]!.kind === "onbekend", `kind: ${a.breakdown[0]!.kind}`);
  assert(a.breakdown[0]!.pct > 99, `pct: ${a.breakdown[0]!.pct}`);
});

scenario("null-geometrie in Overpass-elementen wordt eerlijk overgeslagen", () => {
  const geometry = straightRoute(10);
  const a = aggregateSurfaces(geometry, [
    { type: "way", id: 3, tags: { highway: "residential", surface: "asphalt" }, geometry: [null, null] as never },
  ]);
  assert(a.breakdown[0]!.kind === "onbekend", "kapotte way mag niet matchen");
});

scenario("segmenten zijn aaneengesloten en dragen route-indexen", () => {
  const geometry = straightRoute(33);
  const a = aggregateSurfaces(geometry, [
    wayAlong(5.0, 5.016, { highway: "residential", surface: "asphalt" }, 1),
    wayAlong(5.016, 5.032, { highway: "track", surface: "gravel" }, 2),
  ]);
  assert(a.segments.length >= 2, `segments: ${a.segments.length}`);
  for (let i = 1; i < a.segments.length; i++) {
    assert(a.segments[i]!.fromIdx > a.segments[i - 1]!.fromIdx, "indexen niet oplopend");
  }
  const first = a.segments[0]!;
  assert(first.fromKm === 0, `fromKm: ${first.fromKm}`);
  assert(first.toIdx > first.fromIdx, "segment zonder lengte");
});

scenario("bicycle=no telt als toegangsbeperking (restrictedKm > 0)", () => {
  const geometry = straightRoute(20);
  const a = aggregateSurfaces(geometry, [
    wayAlong(5.0, 5.02, { highway: "path", surface: "dirt", bicycle: "no" }),
  ]);
  assert(a.restrictedKm > 0.5, `restrictedKm: ${a.restrictedKm}`);
});

// ── Geschiktheid ────────────────────────────────────────────────────────────

function analysisOf(parts: [string, number][]): RouteSurfacesAnalysis {
  return {
    totalKm: 100,
    breakdown: parts.map(([kind, pct]) => ({
      kind: kind as never,
      km: pct,
      pct,
      evidence: null,
    })),
    segments: [],
    restrictedKm: 0,
  };
}

scenario("vlakke asfaltroute: racefiets goed geschikt, mtb gedeeltelijk", () => {
  const s = computeBikeSuitability(analysisOf([["asfalt", 95], ["klinkers", 5]]), { maxSlopePct: 3 });
  const race = s.find((x) => x.bike === "racefiets")!;
  assert(race.verdict === "goed", `race: ${race.verdict}`);
  assert(race.reasons.length > 0, "redenen verplicht");
  const mtb = s.find((x) => x.bike === "mountainbike")!;
  assert(mtb.verdict === "gedeeltelijk", `mtb: ${mtb.verdict}`);
});

scenario("20% onverhard: racefiets niet aanbevolen, gravel goed", () => {
  const s = computeBikeSuitability(analysisOf([["asfalt", 80], ["onverhard", 20]]), { maxSlopePct: null });
  assert(s.find((x) => x.bike === "racefiets")!.verdict === "afgeraden", "race moet afgeraden zijn");
  assert(s.find((x) => x.bike === "gravelbike")!.verdict === "goed", "gravel moet goed zijn");
  assert(s.find((x) => x.bike === "mountainbike")!.verdict === "goed", "mtb moet goed zijn");
});

scenario("8% los gravel: racefiets technisch/risicovol, mét percentage in de reden", () => {
  const s = computeBikeSuitability(analysisOf([["asfalt", 92], ["los_gravel", 8]]), { maxSlopePct: null });
  const race = s.find((x) => x.bike === "racefiets")!;
  assert(race.verdict === "technisch", `race: ${race.verdict}`);
  assert(race.reasons.some((r) => r.includes("8%")), `redenen: ${race.reasons.join(" | ")}`);
});

scenario("15% singletrack: gravelbike technisch", () => {
  const s = computeBikeSuitability(analysisOf([["asfalt", 85], ["singletrack", 15]]), { maxSlopePct: null });
  assert(s.find((x) => x.bike === "gravelbike")!.verdict === "technisch", "gravel moet technisch zijn");
});

scenario("50% onbekend: alle fietsen eerlijk 'onvoldoende gegevens'", () => {
  const s = computeBikeSuitability(analysisOf([["asfalt", 50], ["onbekend", 50]]), { maxSlopePct: null });
  for (const x of s) {
    assert(x.verdict === "onvoldoende_gegevens", `${x.bike}: ${x.verdict}`);
    assert(x.reasons.some((r) => r.includes("50%")), "reden noemt het percentage niet");
  }
});

scenario("toegangsbeperking degradeert 'goed' naar 'gedeeltelijk' met reden", () => {
  const a = analysisOf([["asfalt", 100]]);
  a.restrictedKm = 2.5;
  const s = computeBikeSuitability(a, { maxSlopePct: null });
  const race = s.find((x) => x.bike === "racefiets")!;
  assert(race.verdict === "gedeeltelijk", `race: ${race.verdict}`);
  assert(race.reasons.some((r) => r.includes("toegangsbeperking")), "reden mist beperking");
});

scenario("maxSlopePct: eerlijk null zonder gegevens, correct met profiel", () => {
  assert(maxSlopePct([], 10) === null, "leeg profiel moet null zijn");
  assert(maxSlopePct([10, 20], null) === null, "zonder afstand moet null zijn");
  // 2 km, 3 punten ⇒ 1000 m per stap; 80 m stijging = 8%.
  const s = maxSlopePct([0, 80, 40], 2);
  assert(s === 8, `slope: ${s}`);
});

scenario("bronvermelding is ODbL en waarschuwt voor verouderde gegevens", () => {
  const src = surfacesSource();
  assert(src.license.includes("ODbL"), "licentie mist ODbL");
  assert(src.note.includes("verouderd"), "note mist kanttekening");
});

// ── Rapportage ──────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
if (failed.length > 0) process.exit(1);
