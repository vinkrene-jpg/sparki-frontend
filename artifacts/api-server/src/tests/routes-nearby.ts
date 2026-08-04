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

// ── uitslag ──────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} controle(s) gefaald`);
  process.exit(1);
}
console.log("\nAlle nearby-controles geslaagd");
