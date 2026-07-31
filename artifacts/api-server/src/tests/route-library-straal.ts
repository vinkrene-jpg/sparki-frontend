// Straal-zoeken routebibliotheek — regressietest (RRA_2026-07-31_bibliotheek-
// straal-zoeken). Bewaakt dat zoeken rond een plaats NOOIT routes buiten de
// gevraagde straal doorlaat, dat de ophaal-bbox de cirkel volledig dekt, dat
// afstanden kloppen en dat ongeldige parameters worden geweigerd (geen
// default-straal, geen stille terugval).
//
// Run: `node ./scripts/run-test.mjs route-library-straal` (pure functies, geen DB).

import {
  filterOpStraal,
  haversineKm,
  parseStraalCentrum,
  straalOphaalBbox,
} from "../lib/route-library-straal";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok: ${msg}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

// --- haversine tegen bekende referenties -----------------------------------
// Hengelo (OV) centrum ↔ Enschede centrum ≈ 8,9 km hemelsbreed.
const dHE = haversineKm(52.2661, 6.7931, 52.2215, 6.8937);
assert(Math.abs(dHE - 8.5) < 1.0, `Hengelo–Enschede ≈ 8–9 km (was ${dHE.toFixed(2)})`);
// 1 breedtegraad ≈ 111,19 km.
const dLat1 = haversineKm(52, 6, 53, 6);
assert(Math.abs(dLat1 - 111.19) < 0.5, `1° breedte ≈ 111,2 km (was ${dLat1.toFixed(2)})`);
assert(haversineKm(52.1, 6.2, 52.1, 6.2) === 0, "afstand tot zichzelf is 0");

// --- parametervalidatie: ongeldig ⇒ null (route geeft dan 400) --------------
assert(parseStraalCentrum("52.26", "6.79", "5") != null, "geldige parameters geaccepteerd");
for (const [la, lo, r, wat] of [
  ["abc", "6.79", "5", "lat NaN"],
  ["52.26", "6.79", "0", "straal 0 (te klein)"],
  ["52.26", "6.79", "1000", "straal 1000 (te groot)"],
  ["80", "6.79", "5", "lat buiten bereik"],
  ["52.26", "60", "5", "lon buiten bereik"],
  [undefined, undefined, "5", "ontbrekend centrum"],
] as const) {
  assert(parseStraalCentrum(la, lo, r) === null, `geweigerd: ${wat}`);
}

// --- ophaal-bbox dekt de cirkel volledig (geen gemiste randroutes) ----------
const c = { lat: 52.2661, lon: 6.7931, radiusKm: 5 };
const bbox = straalOphaalBbox(c);
// Punten exact op de cirkelrand in 12 richtingen moeten binnen de bbox liggen.
for (let i = 0; i < 12; i++) {
  const hoek = (i * Math.PI) / 6;
  const lat = c.lat + (Math.cos(hoek) * c.radiusKm) / 111.19;
  const lon =
    c.lon + (Math.sin(hoek) * c.radiusKm) / (111.19 * Math.cos((c.lat * Math.PI) / 180));
  assert(
    lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon,
    `cirkelrandpunt richting ${i * 30}° ligt binnen de ophaal-bbox`,
  );
}

// --- exacte filter: binnen blijft, buiten valt af, dichtstbij eerst ---------
const rows = [
  { id: 1, startLat: 52.2661, startLon: 6.7931 }, // 0 km
  { id: 2, startLat: 52.30, startLon: 6.80 }, // ~3,8 km
  { id: 3, startLat: 52.2215, startLon: 6.8937 }, // Enschede ~8,6 km ⇒ buiten 5 km
  { id: 4, startLat: 52.28, startLon: 6.77 }, // ~2,2 km
];
const binnen = filterOpStraal(rows, c);
assert(binnen.length === 3, `3 van 4 routes binnen 5 km (was ${binnen.length})`);
assert(!binnen.some((r) => r.id === 3), "route op ~8,6 km (Enschede) uitgesloten bij straal 5 km");
assert(
  binnen.map((r) => r.id).join(",") === "1,4,2",
  `gesorteerd dichtstbij-eerst (was ${binnen.map((r) => r.id).join(",")})`,
);
assert(binnen[0].startAfstandKm === 0, "afstand startpunt zelf = 0,0 km");
assert(
  binnen.every((r) => r.startAfstandKm <= c.radiusKm),
  "elke gerapporteerde afstand ≤ straal",
);
// Verruimen naar 10 km laat Enschede wél toe (expliciete keuze van de gebruiker).
const ruimer = filterOpStraal(rows, { ...c, radiusKm: 10 });
assert(ruimer.some((r) => r.id === 3), "bij expliciet 10 km hoort Enschede er wel bij");

if (failures > 0) {
  console.error(`\n${failures} controle(s) gefaald`);
  process.exit(1);
}
console.log("\nAlle straal-controles geslaagd.");
