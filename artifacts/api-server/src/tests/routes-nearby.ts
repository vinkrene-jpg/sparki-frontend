// Kaart-eerst routevoorstellen (taak #560) — regressietest voor de pure
// filterlaag van GET /api/routes/nearby (lib/routes-nearby). Bewaakt:
// parametervalidatie (ongeldig ⇒ null ⇒ 400), sportregels (null-sport telt
// alleen bij fietsen), straal, alle filters (afstand/hm/ondergrond/type/
// moeilijkheid), eerlijkheid (onbekende ondergrond/moeilijkheid valt af zodra
// erop gefilterd wordt; verificatieveld altijd "controle_bij_gebruik") en de
// deterministische sortering.
//
// Run: `node ./scripts/run-test.mjs routes-nearby` (pure functies, geen DB).

import type { RoutePathPoint } from "@workspace/db";
import {
  moeilijkheidOf,
  ondergrondKlasse,
  parseNearbyFilters,
  sortNearby,
  sportPast,
  toNearbyRoute,
  type NearbyFilters,
  type NearbyInput,
} from "../lib/routes-nearby";
import {
  eateryBboxRond,
  eateryCacheKey,
  getAreaEateries,
  onderwegVoorRoute,
} from "../lib/route-pois";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok: ${msg}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

// ── Synthetische geometrie rond Hengelo (52.266, 6.793) ─────────────────────
function lusRond(lat: number, lon: number, straalKm = 2): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= 24; i++) {
    const hoek = (i / 24) * 2 * Math.PI;
    pts.push([
      lat + (Math.cos(hoek) * straalKm) / 111.19,
      lon + (Math.sin(hoek) * straalKm) / (111.19 * Math.cos((lat * Math.PI) / 180)),
    ]);
  }
  return pts;
}
function abLijn(lat: number, lon: number, lengteKm = 10): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    pts.push([lat + ((i / 20) * lengteKm) / 111.19, lon]);
  }
  return pts;
}

function rij(overrides: Partial<NearbyInput>): NearbyInput {
  return {
    soort: "route",
    id: 1,
    bron: "bewaard",
    keerGereden: 0,
    naam: "Testroute",
    sport: "cycling",
    distanceKm: 40,
    elevationGainM: 120,
    durationSec: null,
    surface: "asfalt",
    geometry: lusRond(52.266, 6.793),
    ...overrides,
  };
}

const basis: NearbyFilters = parseNearbyFilters({
  lat: "52.266",
  lon: "6.793",
})!;

// ── parseNearbyFilters ───────────────────────────────────────────────────────
console.log("parseNearbyFilters:");
assert(basis != null && basis.radiusKm === 25, "defaults: straal 25, geldig centrum");
assert(basis.sport === "cycling", "default sport = cycling");
for (const [q, wat] of [
  [{}, "ontbrekend centrum"],
  [{ lat: "abc", lon: "6.7" }, "lat NaN"],
  [{ lat: "52", lon: "6.7", radiusKm: "0" }, "straal 0"],
  [{ lat: "52", lon: "6.7", radiusKm: "101" }, "straal boven maximum"],
  [{ lat: "80", lon: "6.7" }, "lat buiten bereik"],
  [{ lat: "52", lon: "6.7", ondergrond: "zand" }, "onbekende ondergrond"],
  [{ lat: "52", lon: "6.7", type: "ster" }, "onbekend type"],
  [{ lat: "52", lon: "6.7", moeilijkheid: "extreem" }, "onbekende moeilijkheid"],
  [{ lat: "52", lon: "6.7", minKm: "-5" }, "negatieve minKm"],
] as const) {
  assert(parseNearbyFilters(q as Record<string, unknown>) == null, `geweigerd: ${wat}`);
}
const vol = parseNearbyFilters({
  lat: "52.266",
  lon: "6.793",
  radiusKm: "10",
  sport: "Walking",
  minKm: "5",
  maxKm: "20",
  ondergrond: "verhard",
  type: "lus",
  moeilijkheid: "makkelijk,gemiddeld",
});
assert(
  vol != null &&
    vol.sport === "walking" &&
    vol.radiusKm === 10 &&
    vol.minKm === 5 &&
    vol.moeilijkheid?.length === 2,
  "volledige geldige parameterset geparseerd (sport lowercased)",
);

// ── sportregels ──────────────────────────────────────────────────────────────
console.log("sportregels:");
assert(sportPast(null, "cycling"), "sport onbekend (oude route) telt bij fietsen");
assert(!sportPast(null, "walking"), "sport onbekend telt NIET bij wandelen");
assert(!sportPast("walking", "cycling"), "wandelroute telt niet bij fietsen");
assert(
  toNearbyRoute(rij({ sport: "walking" }), basis) == null,
  "wandelroute valt af bij sport=cycling",
);

// ── straal ───────────────────────────────────────────────────────────────────
console.log("straal:");
const dichtbij = toNearbyRoute(rij({}), basis);
assert(dichtbij != null, "route op ~2 km binnen straal 25 km");
assert(
  dichtbij != null && dichtbij.startAfstandKm < 3,
  `startafstand realistisch klein (was ${dichtbij?.startAfstandKm.toFixed(1)})`,
);
assert(
  toNearbyRoute(rij({ geometry: lusRond(53.3, 6.793) }), basis) == null,
  "route op ~115 km valt buiten straal 25 km",
);
assert(
  toNearbyRoute(rij({ geometry: null }), basis) == null,
  "route zonder geometrie valt eerlijk af (niets te tonen op een kaart)",
);
// Route die ~110 km VER start maar dwars door het zoekgebied loopt: geen
// startpunt-afwijzing — de hele lijn telt.
const doorkruisend = toNearbyRoute(
  rij({ geometry: abLijn(53.25, 6.793, 220) }),
  basis,
);
assert(doorkruisend == null, "lijn 53.25→noord raakt Hengelo niet: terecht af");
const doorHetCentrum = toNearbyRoute(
  rij({ geometry: abLijn(51.3, 6.793, 220) }),
  basis,
);
assert(
  doorHetCentrum != null && doorHetCentrum.startAfstandKm < 5,
  "route die ~107 km ver start maar door het centrum loopt telt mee (geen startpunt-afwijzing)",
);

// ── afstand/hm-filters ───────────────────────────────────────────────────────
console.log("afstand/hoogte-filters:");
const f5_20 = { ...basis, minKm: 5, maxKm: 20 };
assert(toNearbyRoute(rij({ distanceKm: 10 }), f5_20) != null, "10 km past in 5–20");
assert(toNearbyRoute(rij({ distanceKm: 40 }), f5_20) == null, "40 km valt af bij max 20");
assert(
  toNearbyRoute(rij({ distanceKm: null }), f5_20) == null,
  "onbekende afstand valt eerlijk af zodra op afstand gefilterd wordt",
);
const fHm = { ...basis, minHm: 100, maxHm: 500 };
assert(toNearbyRoute(rij({ elevationGainM: 300 }), fHm) != null, "300 hm past in 100–500");
assert(toNearbyRoute(rij({ elevationGainM: 20 }), fHm) == null, "20 hm valt af bij min 100");
assert(
  toNearbyRoute(rij({ elevationGainM: null }), fHm) == null,
  "onbekende hoogtemeters vallen eerlijk af bij hm-filter",
);

// ── ondergrond ───────────────────────────────────────────────────────────────
console.log("ondergrond:");
assert(ondergrondKlasse("asfalt") === "verhard", "asfalt = verhard");
assert(ondergrondKlasse("gravel") === "onverhard", "gravel = onverhard");
assert(ondergrondKlasse("unknown") === "onbekend", "unknown = eerlijk onbekend");
const fVerhard = { ...basis, ondergrond: "verhard" as const };
assert(toNearbyRoute(rij({ surface: "asfalt" }), fVerhard) != null, "asfalt past bij verhard");
assert(toNearbyRoute(rij({ surface: "gravel" }), fVerhard) == null, "gravel valt af bij verhard");
assert(
  toNearbyRoute(rij({ surface: "unknown" }), fVerhard) == null,
  "onbekend wegdek valt af zodra een ondergrond gekozen is (nooit stil meetellen)",
);
assert(
  toNearbyRoute(rij({ surface: "unknown" }), basis) != null,
  "onbekend wegdek telt wél mee bij geen voorkeur",
);

// ── type lus/heen-en-terug ───────────────────────────────────────────────────
console.log("type route:");
const fLus = { ...basis, type: "lus" as const };
const fAB = { ...basis, type: "heenterug" as const };
assert(toNearbyRoute(rij({}), fLus) != null, "cirkelgeometrie telt als lus");
assert(
  toNearbyRoute(rij({ geometry: abLijn(52.266, 6.793) }), fLus) == null,
  "A-B-lijn valt af bij type=lus",
);
assert(
  toNearbyRoute(rij({ geometry: abLijn(52.266, 6.793) }), fAB) != null,
  "A-B-lijn past bij type=heenterug",
);

// ── moeilijkheid ─────────────────────────────────────────────────────────────
console.log("moeilijkheid:");
assert(moeilijkheidOf("cycling", 20, 30) === "makkelijk", "fiets 20 km vlak = makkelijk");
assert(moeilijkheidOf("cycling", 60, 200) === "gemiddeld", "fiets 60 km = gemiddeld");
assert(moeilijkheidOf("cycling", 100, 300) === "zwaar", "fiets 100 km = zwaar");
assert(moeilijkheidOf("cycling", 30, 400) === "zwaar", "fiets 30 km met >8 hm/km = zwaar");
assert(moeilijkheidOf("walking", 5, 20) === "makkelijk", "wandeling 5 km vlak = makkelijk");
assert(moeilijkheidOf("walking", 20, 100) === "zwaar", "wandeling 20 km = zwaar");
assert(moeilijkheidOf("cycling", null, 100) == null, "zonder afstand eerlijk geen oordeel");
const fZwaar = { ...basis, moeilijkheid: ["zwaar" as const] };
assert(
  toNearbyRoute(rij({ distanceKm: 100, elevationGainM: 300 }), fZwaar) != null,
  "zware route past bij filter zwaar",
);
assert(
  toNearbyRoute(rij({ distanceKm: 20, elevationGainM: 30 }), fZwaar) == null,
  "makkelijke route valt af bij filter zwaar",
);
assert(
  toNearbyRoute(rij({ distanceKm: null }), fZwaar) == null,
  "onbekende moeilijkheid valt eerlijk af bij moeilijkheidsfilter",
);

// ── eerlijkheid + sortering ──────────────────────────────────────────────────
console.log("eerlijkheid + sortering:");
const uit = toNearbyRoute(rij({}), basis)!;
assert(uit.verificatie === "controle_bij_gebruik", "verificatieveld altijd controle_bij_gebruik");
assert(uit.key === "route-1", "sleutel = soort-id");
assert(uit.bronLabel.length > 0, "bronlabel gevuld");
const verWeg = toNearbyRoute(rij({ id: 2, geometry: lusRond(52.35, 6.9) }), basis)!;
const gedeeld = toNearbyRoute(rij({ id: 3, bron: "gedeeld" }), basis)!;
const gesorteerd = sortNearby([verWeg, gedeeld, uit]);
assert(
  gesorteerd[gesorteerd.length - 1]!.id === 2,
  "verste route achteraan",
);
assert(
  gesorteerd[0]!.bron === "bewaard" && gesorteerd[1]!.bron === "gedeeld",
  "bij gelijke afstand eigen bron vóór gedeeld",
);

// ── onderweg-velden (koffie/eten uit de POI-laag, pure match) ────────────────
console.log("onderweg (koffie/eten):");
{
  const geom = lusRond(52.266, 6.793);
  const bbox = eateryBboxRond({ lat: 52.266, lon: 6.793 }, 25);
  // Café pal op een routepunt, restaurant ver weg (>250 m).
  const opRoute = geom[0]!;
  const eateries = [
    { lat: opRoute[0], lon: opRoute[1], soort: "koffie" as const },
    { lat: 52.266, lon: 6.793, soort: "eten" as const }, // middelpunt lus, 2 km van de lijn
  ];
  const v = onderwegVoorRoute(geom, bbox, eateries);
  assert(v.koffie === true, "café op de lijn ⇒ koffie=true");
  assert(v.eten === false, "restaurant ver van de lijn, route volledig binnen dekking ⇒ eten=false");

  const leeg = onderwegVoorRoute(geom, bbox, []);
  assert(leeg.koffie === false && leeg.eten === false, "geen punten + volledige dekking ⇒ eerlijk false");

  // Route deels buiten het dekkingsgebied zonder match ⇒ null (eerlijk onbekend).
  const buitenBbox = eateryBboxRond({ lat: 52.266, lon: 6.793 }, 1);
  const deels = onderwegVoorRoute(lusRond(52.266, 6.793, 2), buitenBbox, []);
  assert(deels.koffie === null && deels.eten === null, "deels buiten dekking zonder match ⇒ null");

  // Match binnen het dekkingsgebied wint van gedeeltelijke dekking: een AB-lijn
  // van 3 km loopt deels buiten de 1 km-bbox, maar het café op het (gedekte)
  // startpunt maakt koffie aantoonbaar true.
  const deelsMetMatch = onderwegVoorRoute(abLijn(52.266, 6.793, 3), buitenBbox, [
    { lat: 52.266, lon: 6.793, soort: "koffie" as const },
  ]);
  assert(deelsMetMatch.koffie === true, "aantoonbaar punt wint van gedeeltelijke dekking");
  assert(deelsMetMatch.eten === null, "geen eten-match + deels buiten dekking ⇒ null");

  // Segment-bewust: café naast het MIDDEN van een lang segment (beide
  // hoekpunten >250 m weg) moet tóch matchen — de belofte is "≤250 m van de
  // lijn", niet "≤250 m van een hoekpunt".
  const langSegment: [number, number][] = [
    [52.266, 6.793],
    [52.266 + 2 / 111.19, 6.793], // 2 km recht naar het noorden
  ];
  const middenLat = 52.266 + 1 / 111.19; // segmentmidden, 1 km van elk hoekpunt
  const naastMidden = {
    lat: middenLat,
    lon: 6.793 + 0.1 / (111.19 * Math.cos((middenLat * Math.PI) / 180)), // ~100 m opzij
    soort: "koffie" as const,
  };
  const segMatch = onderwegVoorRoute(langSegment, bbox, [naastMidden]);
  assert(segMatch.koffie === true, "café naast segmentmidden (hoekpunten >250 m) ⇒ koffie=true");
  const verVanLijn = onderwegVoorRoute(langSegment, bbox, [
    { ...naastMidden, lon: 6.793 + 0.4 / (111.19 * Math.cos((middenLat * Math.PI) / 180)) }, // ~400 m opzij
  ]);
  assert(verVanLijn.koffie === false, "café ~400 m naast de lijn ⇒ geen match");

  // Cachesleutel: een verschoven bbox mag nooit dezelfde sleutel (en dus
  // andermans dekking) hergebruiken — sleutel = exact de bevraagde bbox.
  const kA = eateryCacheKey(eateryBboxRond({ lat: 52.266, lon: 6.793 }, 25));
  const kB = eateryCacheKey(eateryBboxRond({ lat: 52.269, lon: 6.796 }, 25));
  assert(kA !== kB, "verschoven bbox ⇒ andere cachesleutel (geen valse dekking)");
  const kA2 = eateryCacheKey(eateryBboxRond({ lat: 52.266, lon: 6.793 }, 25));
  assert(kA === kA2, "identieke bbox ⇒ zelfde cachesleutel (cache blijft werken)");

  // Canonieke bbox: exact 4 decimalen én NAAR BUITEN afgerond, zodat query,
  // cachesleutel en dekkingstoets dezelfde grenzen delen. Een dekkingstoets
  // ruimer dan het werkelijk bevraagde gebied zou in de randstrook een vals
  // "false" geven — daarom moet de canonieke bbox de ruwe cirkel OMVATTEN.
  const c = { lat: 52.26637, lon: 6.79319 }; // bewust niet-ronde coördinaten
  const kb = eateryBboxRond(c, 25);
  const dLat = 25 / 111.19;
  const dLon = 25 / (111.19 * Math.cos((c.lat * Math.PI) / 180));
  const is4Dec = (v: number) => Math.abs(v * 1e4 - Math.round(v * 1e4)) < 1e-9;
  assert(
    is4Dec(kb.minLat) && is4Dec(kb.maxLat) && is4Dec(kb.minLon) && is4Dec(kb.maxLon),
    "bbox-grenzen zijn exact 4 decimalen (identiek aan de Overpass-query)",
  );
  assert(
    kb.minLat <= c.lat - dLat &&
      kb.maxLat >= c.lat + dLat &&
      kb.minLon <= c.lon - dLon &&
      kb.maxLon >= c.lon + dLon,
    "canonieke bbox omvat de ruwe zoekcirkel (naar buiten afgerond)",
  );
  // Routepunt exact op de bbox-grens telt als gedekt: geen POI ⇒ false (niet
  // null), want die grens is werkelijk bevraagd.
  const opGrens = onderwegVoorRoute(
    [
      [kb.minLat, c.lon],
      [kb.minLat + 0.001, c.lon],
      [kb.minLat + 0.002, c.lon],
      [kb.minLat + 0.003, c.lon],
    ],
    kb,
    [],
  );
  assert(
    opGrens.koffie === false && opGrens.eten === false,
    "punt exact op de (werkelijk bevraagde) bbox-grens ⇒ gedekt ⇒ false",
  );
}

// ── getAreaEateries: Overpass-remark ⇒ eerlijk null (gemockte fetch) ─────────
console.log("getAreaEateries (gemockte fetch):");
{
  const echteFetch = globalThis.fetch;
  const antwoord = (body: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  try {
    // 200-JSON mét remark (Overpass runtime-timeout) op BEIDE hosts ⇒ null,
    // nooit een vals-volledige lege lijst.
    globalThis.fetch = (() =>
      antwoord({
        elements: [],
        remark: "runtime error: Query timed out in ...",
      })) as typeof fetch;
    const metRemark = await getAreaEateries(
      eateryBboxRond({ lat: 51.1, lon: 4.1 }, 10),
    );
    assert(metRemark === null, "200 + remark (timeout) op alle hosts ⇒ eerlijk null");

    // Schone 200 zonder remark ⇒ echte (hier lege) dekking, geen null.
    globalThis.fetch = (() => antwoord({ elements: [] })) as typeof fetch;
    const schoon = await getAreaEateries(
      eateryBboxRond({ lat: 50.9, lon: 3.9 }, 10),
    );
    assert(
      Array.isArray(schoon) && schoon.length === 0,
      "schone 200 zonder remark ⇒ lege lijst (volledige dekking), geen null",
    );

    // Remark op de hoofdhost, schoon antwoord op de mirror ⇒ mirror wint.
    let aanroep = 0;
    globalThis.fetch = (() => {
      aanroep += 1;
      return aanroep === 1
        ? antwoord({ elements: [], remark: "runtime error: timed out" })
        : antwoord({
            elements: [
              { type: "node", id: 1, lat: 50.7, lon: 3.7, tags: { amenity: "cafe", name: "Test" } },
            ],
          });
    }) as typeof fetch;
    const viaMirror = await getAreaEateries(
      eateryBboxRond({ lat: 50.7, lon: 3.7 }, 10),
    );
    assert(
      Array.isArray(viaMirror) && viaMirror.length === 1 && viaMirror[0]!.soort === "koffie",
      "remark op hoofdhost ⇒ mirror geprobeerd en gebruikt",
    );
  } finally {
    globalThis.fetch = echteFetch;
  }
}

// ── uitslag ──────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} controle(s) gefaald`);
  process.exit(1);
}
console.log("\nAlle nearby-controles geslaagd");
