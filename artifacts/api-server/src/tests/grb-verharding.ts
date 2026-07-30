// GRB-controlelaag Vlaanderen (taak #470) — pure-compute test zonder netwerk.
//
// Getest: de deterministische mapping LBLVERH/LBLMORF → verhardingsoordeel,
// het filteren van GRB Wegsegment-features (alleen "in gebruik"),
// punt-op-lijn-matching (dichtstbijzijnd wegsegment binnen 20 m wint), de
// Vlaanderen-omtrek (Wallonië/Brussel/NL eruit), het vullen van het
// OSM-onbekend-gat in de wegtypen-analyse via het GRB en de eerlijke
// GRB-meldingen mét verplichte bronvermelding Digitaal Vlaanderen.
//
// Run: `pnpm --filter @workspace/api-server run test:grb-verharding`

import {
  mapGrbVerharding,
  parseWegsegmentFeatures,
  verdictForPoint,
  pointToLineM,
  pointInFlanders,
  routeInFlanders,
  grbSource,
  type GrbWegsegment,
  type GrbPointVerdict,
} from "../lib/grb-verharding";
import { routeInNetherlands } from "../lib/bgt-verharding";
import {
  assignSurfaceSamples,
  buildSurfacesAnalysis,
  applyGrbToAssignment,
  grbVerdictToSurface,
} from "../lib/route-surfaces";
import { buildGrbRemarks, type RouteRemark } from "../lib/route-remarks";
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

// ── Mapping ─────────────────────────────────────────────────────────────────

scenario("LBLVERH/LBLMORF → oordeel is deterministisch en eerlijk", () => {
  assert(mapGrbVerharding("weg met vaste verharding") === "verhard", "vast");
  assert(
    mapGrbVerharding("weg met losse verharding") === "half_verhard",
    "los zonder morf",
  );
  assert(
    mapGrbVerharding("weg met losse verharding", "aardeweg") === "onverhard",
    "aardeweg = onverhard",
  );
  assert(
    mapGrbVerharding("weg met zowel vaste en losse verharding") === "half_verhard",
    "gemengd",
  );
  // Nooit raden: n.v.t., onbekend en leeg zijn null.
  assert(mapGrbVerharding("niet van toepassing") === null, "nvt");
  assert(mapGrbVerharding("") === null, "leeg");
  assert(mapGrbVerharding(null) === null, "null");
  assert(mapGrbVerharding("weg met onbekende verharding") === null, "onbekend label");
});

// ── Feature-parsing ─────────────────────────────────────────────────────────

const lijn = (coords: [number, number][]) => ({
  type: "LineString",
  coordinates: coords, // GeoJSON [lon,lat]
});

scenario("parser filtert niet-in-gebruik en onbruikbare features", () => {
  const segs = parseWegsegmentFeatures([
    {
      properties: { LBLVERH: "weg met vaste verharding", LBLSTATUS: "in gebruik" },
      geometry: lijn([[4.5, 51.0], [4.501, 51.0]]),
    },
    {
      // niet in gebruik → eruit
      properties: { LBLVERH: "weg met vaste verharding", LBLSTATUS: "gepland" },
      geometry: lijn([[4.5, 51.0], [4.501, 51.0]]),
    },
    {
      // geen herkenbare verharding → eruit
      properties: { LBLVERH: "niet van toepassing", LBLSTATUS: "in gebruik" },
      geometry: lijn([[4.5, 51.0], [4.501, 51.0]]),
    },
    {
      // geen geometrie → eruit
      properties: { LBLVERH: "weg met losse verharding", LBLSTATUS: "in gebruik" },
    },
  ]);
  assert(segs.length === 1, `verwacht 1 segment, kreeg ${segs.length}`);
  assert(segs[0]!.verdict === "verhard", "oordeel vast");
});

// ── Punt-op-lijn-matching ───────────────────────────────────────────────────

function seg(
  verdict: GrbWegsegment["verdict"],
  lblVerh: string,
  line: RoutePathPoint[],
  lblMorf: string | null = null,
): GrbWegsegment {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [la, lo] of line) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLon = Math.min(minLon, lo); maxLon = Math.max(maxLon, lo);
  }
  return { verdict, lblVerh, lblMorf, lines: [line], bbox: { minLat, maxLat, minLon, maxLon } };
}

scenario("punt-op-lijn: dichtstbijzijnd segment binnen 20 m wint", () => {
  // Oost-west lopende weg op lat 51.0; punt ligt ~5 m ten noorden.
  const vast = seg("verhard", "weg met vaste verharding", [
    [51.0, 4.5],
    [51.0, 4.51],
  ]);
  // Parallelweg ~60 m noordelijker (0.00054°): buiten bereik voor dit punt.
  const los = seg("half_verhard", "weg met losse verharding", [
    [51.00054, 4.5],
    [51.00054, 4.51],
  ]);
  const p: RoutePathPoint = [51.000045, 4.505]; // ~5 m van `vast`
  const v = verdictForPoint(p, [los, vast]);
  assert(v?.verdict === "verhard", "dichtstbijzijnde (vaste) weg wint");
  // Punt midden tussen beide (~30 m van elk): eerlijk null, nooit gokken.
  const ver: RoutePathPoint = [51.00027, 4.505];
  assert(verdictForPoint(ver, [los, vast]) === null, "buiten 20 m = null");
  // Afstandsfunctie zelf: punt op de lijn is ~0 m.
  assert(pointToLineM([51.0, 4.505], vast.lines[0]!) < 1, "op de lijn ≈ 0 m");
});

// ── Vlaanderen-omtrek ───────────────────────────────────────────────────────

scenario("Vlaanderen-check: Vlaanderen erin, Wallonië/Brussel/NL eruit", () => {
  const gent: RoutePathPoint = [51.05, 3.72];
  const leuven: RoutePathPoint = [50.88, 4.7];
  const hasselt: RoutePathPoint = [50.93, 5.34];
  const brugge: RoutePathPoint = [51.21, 3.22];
  assert(pointInFlanders(gent), "Gent");
  assert(pointInFlanders(leuven), "Leuven");
  assert(pointInFlanders(hasselt), "Hasselt");
  assert(pointInFlanders(brugge), "Brugge");
  const namen: RoutePathPoint = [50.47, 4.87]; // Wallonië
  const luik: RoutePathPoint = [50.63, 5.57]; // Wallonië
  const brussel: RoutePathPoint = [50.85, 4.35]; // Brussels gewest (gat)
  const utrecht: RoutePathPoint = [52.09, 5.12]; // NL
  const rijsel: RoutePathPoint = [50.63, 3.06]; // Frankrijk (Lille)
  assert(!pointInFlanders(namen), "Namen (Wallonië) eruit");
  assert(!pointInFlanders(luik), "Luik (Wallonië) eruit");
  assert(!pointInFlanders(brussel), "Brussel (gat) eruit");
  assert(!pointInFlanders(utrecht), "Utrecht (NL) eruit");
  assert(!pointInFlanders(rijsel), "Rijsel (FR) eruit");
  // Route-check: een Vlaamse route is wel Vlaanderen, geen Nederland.
  const vlaamseRoute: RoutePathPoint[] = [gent, [51.0, 3.9], leuven, hasselt];
  assert(routeInFlanders(vlaamseRoute), "Vlaamse route");
  assert(!routeInNetherlands(vlaamseRoute), "Vlaamse route is geen NL (BGT blijft uit)");
  const gemengd: RoutePathPoint[] = [gent, namen, brussel, luik];
  assert(!routeInFlanders(gemengd), "route half Wallonië = niet Vlaanderen");
});

// ── OSM-onbekend-gat vullen ────────────────────────────────────────────────

scenario("GRB vult alleen het OSM-onbekend-gat en verlaagt % onbekend", () => {
  // Route van 4 punten zonder enige OSM-way: alles onbekend.
  const geometry: RoutePathPoint[] = [
    [51.0, 4.5],
    [51.0, 4.502],
    [51.0, 4.504],
    [51.0, 4.506],
  ];
  const a = assignSurfaceSamples(geometry, []);
  assert(a.kinds.every((k) => k === "onbekend"), "start: alles onbekend");
  const unknownOrdinals = a.kinds.map((_, i) => i);
  const verdicts: (GrbPointVerdict | null)[] = [
    { verdict: "verhard", lblVerh: "weg met vaste verharding", lblMorf: null },
    { verdict: "half_verhard", lblVerh: "weg met losse verharding", lblMorf: null },
    { verdict: "onverhard", lblVerh: "weg met losse verharding", lblMorf: "aardeweg" },
    null, // geen dekking: blijft eerlijk onbekend
  ];
  const resolved = applyGrbToAssignment(a, unknownOrdinals, verdicts);
  assert(resolved === 3, `3 punten opgelost, kreeg ${resolved}`);
  assert(a.kinds[0] === "asfalt", "vast → asfalt");
  assert(a.kinds[1] === "compact_gravel", "los → compact gravel");
  assert(a.kinds[2] === "onverhard", "aardeweg → onverhard");
  assert(a.kinds[3] === "onbekend", "zonder oordeel blijft onbekend");
  assert(
    a.evidences[0]!.includes("GRB") && a.evidences[0]!.includes("Vlaanderen"),
    "bewijs noemt GRB + Vlaanderen",
  );
  const analysis = buildSurfacesAnalysis(a);
  const onbekend = analysis.breakdown.find((b) => b.kind === "onbekend");
  assert((onbekend?.pct ?? 0) < 100, "% onbekend is aantoonbaar gedaald");
  // Mapper zelf: labels letterlijk in het bewijs.
  const m = grbVerdictToSurface({
    verdict: "half_verhard",
    lblVerh: "weg met zowel vaste en losse verharding",
    lblMorf: null,
  });
  assert(m.kind === "compact_gravel" && m.evidence.includes("zowel vaste en losse"), "mapper-bewijs");
});

// ── GRB-meldingen + verplichte bronvermelding ───────────────────────────────

scenario("GRB-meldingen: ≥2 meetpunten, geen dubbels, bronvermelding verplicht", () => {
  const samples = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((km, i) => ({
    point: [51.0, 4.5 + i * 0.003] as RoutePathPoint,
    km,
    idx: i * 10,
  }));
  const los: GrbPointVerdict = {
    verdict: "half_verhard",
    lblVerh: "weg met losse verharding",
    lblMorf: null,
  };
  const vast: GrbPointVerdict = {
    verdict: "verhard",
    lblVerh: "weg met vaste verharding",
    lblMorf: null,
  };
  // Eén losse treffer (kruisend segment) → géén melding.
  const single = buildGrbRemarks(samples, [vast, los, vast, vast, vast, vast], []);
  assert(single.length === 0, "één treffer geeft geen melding");
  // Twee aaneengesloten treffers → één melding mét bronvermelding.
  const remarks = buildGrbRemarks(samples, [vast, los, los, vast, vast, vast], []);
  assert(remarks.length === 1, `één melding, kreeg ${remarks.length}`);
  assert(remarks[0]!.label.includes("GRB"), "label noemt GRB");
  assert(
    remarks[0]!.detail!.includes(
      "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen",
    ),
    "VERPLICHTE bronvermelding in de melding",
  );
  // Al door OSM gedekt → geen dubbele regel.
  const existing: RouteRemark[] = [
    {
      id: "way/1",
      kind: "onverhard",
      label: "Onverhard",
      detail: "Onverhard volgens OSM.",
      lat: 51,
      lon: 4.5,
      routeKm: 0.2,
      endKm: 0.4,
      offRouteM: 0,
      uncertain: false,
      evidence: "surface=gravel",
    },
  ];
  const deduped = buildGrbRemarks(samples, [vast, los, los, vast, vast, vast], existing);
  assert(deduped.length === 0, "OSM-gedekt stuk krijgt geen GRB-dubbel");
});

scenario("grbSource draagt de verplichte naamvermelding en licentie", () => {
  const s = grbSource();
  assert(
    s.name.includes("Grootschalig Referentie Bestand Vlaanderen") &&
      s.name.includes("Digitaal Vlaanderen"),
    "naamvermelding",
  );
  assert(s.license.includes("v1.02"), "licentieversie");
  assert(s.note.toLowerCase().includes("alleen vlaanderen"), "alleen Vlaanderen");
});

// ── Rapport ─────────────────────────────────────────────────────────────────

let failed = 0;
for (const r of results) {
  const mark = r.status === "pass" ? "✓" : "✗";
  console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  if (r.status === "fail") failed += 1;
}
console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
if (failed > 0) process.exit(1);
