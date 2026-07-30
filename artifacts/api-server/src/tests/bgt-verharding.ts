// BGT-controlelaag (taak #428) — pure-compute test zonder netwerk.
//
// Getest: de deterministische mapping fysiek_voorkomen → verhardingsoordeel,
// het filteren van actuele PDOK-features (historische versies eruit),
// punt-in-polygoon, de voorkeur voor rijbaan/fietspad-vlakken, het vullen van
// het OSM-onbekend-gat in de wegtypen-analyse (het "% onbekend" daalt
// aantoonbaar) en de eerlijke BGT-meldingen op de route.
//
// Run: `pnpm --filter @workspace/api-server run test:bgt-verharding`

import {
  mapFysiekVoorkomen,
  parseWegdeelFeatures,
  pointInPolygon,
  verdictForPoint,
  routeInNetherlands,
  bgtSource,
  type BgtWegdeel,
  type BgtPointVerdict,
} from "../lib/bgt-verharding";
import {
  assignSurfaceSamples,
  buildSurfacesAnalysis,
  applyBgtToAssignment,
  bgtVerdictToSurface,
} from "../lib/route-surfaces";
import { buildBgtRemarks, type RouteRemark } from "../lib/route-remarks";
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

scenario("fysiek_voorkomen → oordeel is deterministisch en eerlijk", () => {
  assert(mapFysiekVoorkomen("gesloten verharding") === "verhard", "gesloten");
  assert(mapFysiekVoorkomen("open verharding") === "verhard", "open");
  assert(mapFysiekVoorkomen("half verhard") === "half_verhard", "half");
  assert(mapFysiekVoorkomen("onverhard") === "onverhard", "onverhard");
  // Plus-detailleringen beginnen met de hoofdcategorie.
  assert(
    mapFysiekVoorkomen("open verharding: betonstraatstenen") === "verhard",
    "plus-detail open",
  );
  // Twijfel is eerlijk null — nooit raden.
  assert(mapFysiekVoorkomen("transitie") === null, "transitie");
  assert(mapFysiekVoorkomen("") === null, "leeg");
  assert(mapFysiekVoorkomen(null) === null, "null");
});

// ── Feature-filter (alleen actuele BGT-objecten) ────────────────────────────

const square = (
  lat: number,
  lon: number,
  d: number,
): [number, number][] => [
  [lon - d, lat - d],
  [lon + d, lat - d],
  [lon + d, lat + d],
  [lon - d, lat + d],
  [lon - d, lat - d],
];

function feature(
  props: Record<string, unknown>,
  lat = 52.26,
  lon = 6.79,
): { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } } {
  return {
    properties: { status: "bestaand", ...props },
    geometry: { type: "Polygon", coordinates: [square(lat, lon, 0.0005)] },
  };
}

scenario("historische en beëindigde wegdelen tellen niet mee", () => {
  const parsed = parseWegdeelFeatures([
    feature({ fysiek_voorkomen: "onverhard" }),
    feature({ fysiek_voorkomen: "onverhard", eind_registratie: "2018-01-01" }),
    feature({ fysiek_voorkomen: "onverhard", termination_date: "2020-01-01" }),
    feature({ fysiek_voorkomen: "onverhard", status: "plan" }),
    feature({ fysiek_voorkomen: "transitie" }), // geen oordeel → niet bruikbaar
    { properties: { fysiek_voorkomen: "onverhard" } }, // geen geometrie
  ]);
  assert(parsed.length === 1, `verwacht 1 actueel wegdeel, kreeg ${parsed.length}`);
  assert(parsed[0]!.verdict === "onverhard", "oordeel");
});

// ── Punt-in-polygoon ────────────────────────────────────────────────────────

scenario("punt-in-polygoon werkt, inclusief gaten", () => {
  const outer = square(52.0, 6.0, 0.001);
  const hole = square(52.0, 6.0, 0.0002);
  assert(pointInPolygon(52.0, 6.0, [outer]) === true, "binnen");
  assert(pointInPolygon(52.01, 6.0, [outer]) === false, "buiten");
  assert(pointInPolygon(52.0, 6.0, [outer, hole]) === false, "in het gat");
});

scenario("rijbaan/fietspad-vlak wint van een voetpad-vlak", () => {
  const wegdelen = parseWegdeelFeatures([
    feature({ fysiek_voorkomen: "open verharding", functie: "voetpad" }),
    feature({ fysiek_voorkomen: "gesloten verharding", functie: "fietspad" }),
  ]) as BgtWegdeel[];
  const v = verdictForPoint([52.26, 6.79] as RoutePathPoint, wegdelen);
  assert(v != null, "geen oordeel");
  assert(v!.fysiekVoorkomen === "gesloten verharding", `won: ${v!.fysiekVoorkomen}`);
});

// ── NL-grens (BGT is alleen Nederland) ──────────────────────────────────────

scenario("alleen-Nederland: route in Vlaanderen krijgt geen BGT", () => {
  const nl: RoutePathPoint[] = [[52.26, 6.79], [52.27, 6.80]];
  const be: RoutePathPoint[] = [[50.85, 4.35], [50.86, 4.36]];
  assert(routeInNetherlands(nl) === true, "NL-route");
  assert(routeInNetherlands(be) === false, "Brussel is geen BGT-gebied");
  assert(bgtSource().note.includes("Alleen Nederland"), "bronnote mist NL-label");
});

// ── Het onbekend-gat daalt aantoonbaar ──────────────────────────────────────

// Rechte route van ~1 km zonder ook maar één OSM-way: alles is "onbekend".
const route: RoutePathPoint[] = [];
for (let i = 0; i <= 20; i++) route.push([52.26 + i * 0.0005, 6.79]);

scenario("BGT-oordeel vult alleen het OSM-onbekend-gat en verlaagt % onbekend", () => {
  const a = assignSurfaceSamples(route, []);
  const before = buildSurfacesAnalysis({
    ...a,
    kinds: [...a.kinds],
    evidences: [...a.evidences],
  });
  const unknownBefore =
    before.breakdown.find((b) => b.kind === "onbekend")?.pct ?? 0;
  assert(unknownBefore === 100, `zonder bronnen 100% onbekend, was ${unknownBefore}`);

  const unknownOrdinals = a.kinds
    .map((k, i) => (k === "onbekend" ? i : -1))
    .filter((i) => i >= 0);
  // De BGT kent de eerste helft (gesloten verharding), de rest blijft eerlijk gat.
  const verdicts: (BgtPointVerdict | null)[] = unknownOrdinals.map((_, i) =>
    i < unknownOrdinals.length / 2
      ? { verdict: "verhard", fysiekVoorkomen: "gesloten verharding" }
      : null,
  );
  const resolved = applyBgtToAssignment(a, unknownOrdinals, verdicts);
  assert(resolved > 0, "geen enkel punt opgelost");
  const after = buildSurfacesAnalysis(a);
  const unknownAfter =
    after.breakdown.find((b) => b.kind === "onbekend")?.pct ?? 0;
  assert(
    unknownAfter < unknownBefore,
    `% onbekend daalde niet: ${unknownBefore} → ${unknownAfter}`,
  );
  const asfalt = after.breakdown.find((b) => b.kind === "asfalt");
  assert(asfalt != null, "BGT-verhard ontbreekt in de verdeling");
  assert(
    (asfalt!.evidence ?? "").includes("BGT"),
    `evidence noemt de BGT niet: ${asfalt!.evidence}`,
  );
});

scenario("BGT overschrijft nooit een bestaand OSM-oordeel", () => {
  const a = assignSurfaceSamples(route, []);
  a.kinds[0] = "asfalt";
  a.evidences[0] = "surface=asphalt";
  const n = applyBgtToAssignment(a, [0], [
    { verdict: "onverhard", fysiekVoorkomen: "onverhard" },
  ]);
  assert(n === 0, "OSM-oordeel werd overschreven");
  assert(a.kinds[0] === "asfalt" && a.evidences[0] === "surface=asphalt", "waarde veranderd");
});

scenario("bgtVerdictToSurface: open verharding = klinkers, half = compact gravel", () => {
  assert(
    bgtVerdictToSurface({ verdict: "verhard", fysiekVoorkomen: "open verharding" }).kind === "klinkers",
    "open verharding",
  );
  assert(
    bgtVerdictToSurface({ verdict: "verhard", fysiekVoorkomen: "gesloten verharding" }).kind === "asfalt",
    "gesloten verharding",
  );
  assert(
    bgtVerdictToSurface({ verdict: "half_verhard", fysiekVoorkomen: "half verhard" }).kind === "compact_gravel",
    "half verhard",
  );
  assert(
    bgtVerdictToSurface({ verdict: "onverhard", fysiekVoorkomen: "onverhard" }).kind === "onverhard",
    "onverhard",
  );
});

// ── Eerlijke meldingen ──────────────────────────────────────────────────────

function sampleRow(km: number, i: number) {
  return { point: [52.26 + i * 0.001, 6.79] as RoutePathPoint, km, idx: i };
}

scenario("BGT-melding: aaneengesloten onverhard stuk wordt één eerlijke melding", () => {
  const samples = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((km, i) => sampleRow(km, i));
  const verdicts: (BgtPointVerdict | null)[] = [
    { verdict: "verhard", fysiekVoorkomen: "gesloten verharding" },
    { verdict: "onverhard", fysiekVoorkomen: "onverhard" },
    { verdict: "onverhard", fysiekVoorkomen: "onverhard" },
    { verdict: "onverhard", fysiekVoorkomen: "onverhard" },
    { verdict: "verhard", fysiekVoorkomen: "gesloten verharding" },
    null,
  ];
  const remarks = buildBgtRemarks(samples, verdicts, []);
  assert(remarks.length === 1, `verwacht 1 melding, kreeg ${remarks.length}`);
  const r = remarks[0]!;
  assert(r.kind === "onverhard", "kind");
  assert(r.label.includes("BGT"), `label: ${r.label}`);
  assert(r.evidence.includes("fysiek_voorkomen=onverhard"), `evidence: ${r.evidence}`);
  assert(r.detail.includes("alleen Nederland"), "detail mist NL-label");
  assert(r.routeKm === 0.2 && r.endKm === 0.6, `bereik: ${r.routeKm}–${r.endKm}`);
});

scenario("één losse BGT-treffer geeft geen melding (kruisend vlak)", () => {
  const samples = [0, 0.2, 0.4].map((km, i) => sampleRow(km, i));
  const verdicts: (BgtPointVerdict | null)[] = [
    { verdict: "verhard", fysiekVoorkomen: "gesloten verharding" },
    { verdict: "onverhard", fysiekVoorkomen: "onverhard" },
    { verdict: "verhard", fysiekVoorkomen: "gesloten verharding" },
  ];
  assert(buildBgtRemarks(samples, verdicts, []).length === 0, "melding op één punt");
});

scenario("BGT-melding wordt overgeslagen waar OSM al onverhard meldt", () => {
  const samples = [0, 0.2, 0.4, 0.6].map((km, i) => sampleRow(km, i));
  const verdicts: (BgtPointVerdict | null)[] = samples.map(() => ({
    verdict: "onverhard" as const,
    fysiekVoorkomen: "onverhard",
  }));
  const existing: RouteRemark[] = [
    {
      id: "way/1",
      kind: "onverhard",
      label: "Onverhard wegdek",
      detail: "surface=gravel",
      lat: 52.26,
      lon: 6.79,
      routeKm: 0,
      endKm: 0.6,
      offRouteM: 0,
      uncertain: false,
      evidence: "surface=gravel",
    },
  ];
  assert(buildBgtRemarks(samples, verdicts, existing).length === 0, "dubbele melding");
});

// ── Rapportage ──────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
if (failed.length > 0) process.exit(1);
