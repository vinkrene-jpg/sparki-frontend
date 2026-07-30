// Klimdetectie — pure unit-regressietest op detectClimbs/summarizeTrack.
//
// Taak #435: naast het bestaande lange-klim-profiel (≥40 m / ≥0,6 km / ≥3 %)
// bestaat een KORT-STEIL profiel (≥25 m / ≥0,3 km / ≥4,5 %) zodat korte
// Nederlandse hellingen zoals de Holterberg (~30-40 m stijging) als klim
// verschijnen. Deze test borgt beide kanten:
//   - een Holterberg-achtige helling (32 m over 600 m, ~5,3 %) telt als klim;
//   - vlak terrein met SRTM-achtige ruis (±2 m per punt) blijft op 0 klimmen;
//   - het bestaande lange profiel blijft ongewijzigd (45 m over 1,4 km telt,
//     te-flauwe of te-korte stukken tellen niet).
//
// Run: `pnpm --filter @workspace/api-server run test:gpx-climb-detection`
// (via shell — de workflow-limiet is bereikt; bewust geen nieuwe workflow.)

import { summarizeTrack, qualifiesAsClimb } from "../lib/gpx-parse";

type Status = "pass" | "fail";
const results: { name: string; status: Status; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, status: ok ? "pass" : "fail", detail });
}

// Rechte track langs de lengtegraad met punten om de 100 m op de opgegeven
// hoogtes (lat 52,28 — Sallandse Heuvelrug).
function mkTrack(eles: number[]): { lat: number; lon: number; ele: number }[] {
  const dLon = 0.1 / (111.32 * Math.cos((52.28 * Math.PI) / 180));
  return eles.map((ele, i) => ({ lat: 52.28, lon: 6.4 + i * dLon, ele }));
}

// 1. Holterberg-achtig: vlak → 32 m stijging over 600 m (~5,3 %) → afdaling.
const holter = mkTrack([
  20, 20, 20, 20, 20, 25, 31, 36, 42, 47, 52, 52, 52, 50, 48, 46, 44, 42, 40,
  38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 20, 20, 20,
]);
const s1 = summarizeTrack(holter);
check(
  "Holterberg-achtige korte helling telt als klim",
  s1.climbs.length === 1 &&
    s1.climbs[0]!.avgGradePct >= 4.5 &&
    s1.climbs[0]!.lengthKm >= 0.3,
  JSON.stringify(s1.climbs),
);

// 2. Vlak met SRTM-achtige ruis (±2 m per punt) over 5 km: 0 klimmen.
const flat = mkTrack(
  Array.from({ length: 50 }, (_, i) => 12 + (((i * 7919) % 5) - 2)),
);
const s2 = summarizeTrack(flat);
check(
  "Vlak terrein met SRTM-ruis blijft 0 klimmen",
  s2.climbs.length === 0,
  JSON.stringify(s2.climbs),
);

// 3. Bestaand lang profiel: 45 m over 1,3 km (~3,5 %) blijft een klim, ook
// met een vlakke aanloop ervoor (de aanloop mag de klim niet verdunnen).
const long = mkTrack([
  100, 100, 100, 100, 100,
  ...Array.from({ length: 13 }, (_, i) => 100 + ((i + 1) * 45) / 13),
  145,
  145,
]);
const s3 = summarizeTrack(long);
check(
  "Lange zachte klim (45 m / 1,3 km / 3,5%) blijft gedetecteerd",
  s3.climbs.length === 1 && s3.climbs[0]!.avgGradePct >= 3,
  JSON.stringify(s3.climbs),
);

// 4. Grensgevallen van de qualifier zelf.
check("26 m over 0,8 km (3,25%) is GEEN klim", !qualifiesAsClimb(26, 0.8));
check("25 m over 0,2 km (spike) is GEEN klim", !qualifiesAsClimb(25, 0.2));
check("25 m over 0,35 km (7,1%) IS een klim", qualifiesAsClimb(25, 0.35));
check("24 m over 0,4 km (6%) is GEEN klim (< 25 m)", !qualifiesAsClimb(24, 0.4));
check("40 m over 1,0 km (4%) blijft een klim", qualifiesAsClimb(40, 1.0));
check("40 m over 1,5 km (2,7%) blijft GEEN klim", !qualifiesAsClimb(40, 1.5));

let failed = 0;
for (const r of results) {
  if (r.status === "fail") failed++;
  console.log(
    `${r.status === "pass" ? "✅" : "❌"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`,
  );
}
if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nAlle ${results.length} checks geslaagd.`);
