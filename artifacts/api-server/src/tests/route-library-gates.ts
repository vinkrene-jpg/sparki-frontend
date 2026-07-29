// Route-library kwaliteitspoorten — regressietest.
//
// De routebibliotheek keurt lussen af met doodlopende-weg-stroken of
// mini-lusjes via drie harde poorten (route-library.ts):
//   overlap  ≤ MAX_LIBRARY_OVERLAP   (totaal dubbelgereden aandeel)
//   spur     ≤ MAX_LIBRARY_SPUR_M    (langste aaneengesloten heen-en-terug)
//   sub-lus  ≥ MIN_LIBRARY_SUBLOOP_M (kleinste sub-lus)
// Deze test bewaakt zowel de metingen (loop-quality.ts) als de poortwaarden
// zelf met synthetische paden, zodat een toekomstige verzwakking meteen faalt.
//
// Run: `node ./scripts/run-test.mjs route-library-gates` (pure functions, geen DB).

import {
  pathOverlapFraction,
  longestRepeatedStretchM,
  smallestSubLoopM,
} from "../lib/routing/loop-quality";
import {
  MAX_LIBRARY_OVERLAP,
  MAX_LIBRARY_SPUR_M,
  MIN_LIBRARY_SUBLOOP_M,
} from "../lib/route-library";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ok: ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Synthetische geometrie rond Utrecht (lat 52). We werken in meters en zetten
// om naar [lat, lon]; punten liggen ~100 m uit elkaar zodat elk segment de
// snap-cellen (~60 m) van loop-quality daadwerkelijk kruist.
const LAT0 = 52.0;
const LON0 = 5.0;
const M_PER_DEG_LAT = 111_320;
const LON_SCALE = 1 / Math.cos((LAT0 * Math.PI) / 180);

function pt(xM: number, yM: number): [number, number] {
  return [
    LAT0 + yM / M_PER_DEG_LAT,
    LON0 + (xM / M_PER_DEG_LAT) * LON_SCALE,
  ];
}

// Rechte lijn van a naar b in stappen van ~stepM meter (b inclusief, a niet).
function line(
  a: [number, number],
  b: [number, number],
  stepM = 100,
): [number, number][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.round(dist / stepM));
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) {
    out.push(pt(a[0] + (dx * i) / n, a[1] + (dy * i) / n));
  }
  return out;
}

// Schone vierkante lus 2 km × 2 km (~8 km), geen enkele herhaalde wegrand.
function cleanLoop(): [number, number][] {
  const corners: [number, number][] = [
    [0, 0],
    [2000, 0],
    [2000, 2000],
    [0, 2000],
    [0, 0],
  ];
  const path: [number, number][] = [pt(0, 0)];
  for (let i = 1; i < corners.length; i++) {
    path.push(...line(corners[i - 1]!, corners[i]!));
  }
  return path;
}

// Zelfde lus, maar halverwege de onderkant een doodlopende-weg-spur van
// ~500 m: heen en over exact dezelfde punten terug (heen-en-terug ≈ 1000 m).
function spurLoop(): [number, number][] {
  const path: [number, number][] = [pt(0, 0)];
  path.push(...line([0, 0], [1000, 0]));
  const out = line([1000, 0], [1000, -500]);
  path.push(...out);
  path.push(...[...out].reverse().slice(1), pt(1000, 0));
  path.push(...line([1000, 0], [2000, 0]));
  path.push(...line([2000, 0], [2000, 2000]));
  path.push(...line([2000, 2000], [0, 2000]));
  path.push(...line([0, 2000], [0, 0]));
  return path;
}

// Zelfde lus, maar halverwege een mini-lusje van ~800 m (cirkeltje, radius
// ~127 m): de route komt na ~800 m terug op dezelfde plek. Geen segment wordt
// dubbel bereden, dus alléén de sub-lus-poort mag dit vangen.
function miniLoopPath(): [number, number][] {
  const path: [number, number][] = [pt(0, 0)];
  path.push(...line([0, 0], [1000, 0]));
  const r = 800 / (2 * Math.PI); // ≈ 127 m
  const steps = 10;
  for (let k = 1; k <= steps; k++) {
    const theta = (2 * Math.PI * k) / steps;
    path.push(pt(1000 + r * Math.sin(theta), -r + r * Math.cos(theta)));
  }
  path.push(...line([1000, 0], [2000, 0]));
  path.push(...line([2000, 0], [2000, 2000]));
  path.push(...line([2000, 2000], [0, 2000]));
  path.push(...line([0, 2000], [0, 0]));
  return path;
}

function brokenPath(): [number, number][] {
  const path = cleanLoop();
  path[Math.floor(path.length / 2)] = [Number.NaN, LON0];
  return path;
}

// Exact dezelfde poortconditie als generateStarterSet in route-library.ts.
function libraryRejects(path: [number, number][]): boolean {
  const overlap = pathOverlapFraction(path);
  const spurM = longestRepeatedStretchM(path);
  const subLoopM = smallestSubLoopM(path);
  return (
    overlap > MAX_LIBRARY_OVERLAP ||
    spurM > MAX_LIBRARY_SPUR_M ||
    subLoopM < MIN_LIBRARY_SUBLOOP_M
  );
}

// ---------------------------------------------------------------------------
console.log("route-library-gates: metingen op synthetische paden");

{
  const clean = cleanLoop();
  const overlap = pathOverlapFraction(clean);
  const spur = longestRepeatedStretchM(clean);
  const sub = smallestSubLoopM(clean);
  assert(overlap === 0, `schone lus: overlap 0 (kreeg ${overlap.toFixed(3)})`);
  assert(spur === 0, `schone lus: spur 0 m (kreeg ${spur})`);
  assert(
    sub >= 7000 && sub <= 9000,
    `schone lus: kleinste sub-lus ≈ hele lus ~8 km (kreeg ${Math.round(sub)})`,
  );
  assert(!libraryRejects(clean), "schone lus passeert alle bibliotheekpoorten");
}

{
  const spurred = spurLoop();
  const overlap = pathOverlapFraction(spurred);
  const spur = longestRepeatedStretchM(spurred);
  assert(
    spur >= 400,
    `spur-lus: heen-en-terug-strook ≥ 400 m gemeten (kreeg ${spur})`,
  );
  assert(
    spur > MAX_LIBRARY_SPUR_M,
    `spur-lus: spur ${spur} m overschrijdt poort ${MAX_LIBRARY_SPUR_M} m`,
  );
  assert(
    overlap > MAX_LIBRARY_OVERLAP,
    `spur-lus: overlap ${overlap.toFixed(3)} overschrijdt poort ${MAX_LIBRARY_OVERLAP}`,
  );
  assert(libraryRejects(spurred), "spur-lus wordt door de poorten afgewezen");
}

{
  const mini = miniLoopPath();
  const sub = smallestSubLoopM(mini);
  assert(
    sub >= 400 && sub <= 1500,
    `mini-lusje: sub-lus ~800 m gemeten (kreeg ${Math.round(sub)})`,
  );
  assert(
    sub < MIN_LIBRARY_SUBLOOP_M,
    `mini-lusje: sub-lus ${Math.round(sub)} m onder poort ${MIN_LIBRARY_SUBLOOP_M} m`,
  );
  assert(libraryRejects(mini), "mini-lusje wordt door de poorten afgewezen");
}

{
  const broken = brokenPath();
  const overlap = pathOverlapFraction(broken);
  const spur = longestRepeatedStretchM(broken);
  const sub = smallestSubLoopM(broken);
  assert(overlap === 1, `kapotte geometrie: overlap fail-closed 1 (kreeg ${overlap})`);
  assert(
    spur === Number.POSITIVE_INFINITY,
    `kapotte geometrie: spur fail-closed Infinity (kreeg ${spur})`,
  );
  assert(sub === 0, `kapotte geometrie: sub-lus fail-closed 0 (kreeg ${sub})`);
  assert(libraryRejects(broken), "kapotte geometrie wordt fail-closed afgewezen");
}

// Poortwaarden zelf: een verzwakking (bijv. spur-poort naar 600 m) laat de
// synthetische lelijke paden door en faalt hierboven; deze grenzen bewaken
// dat de constants niet stilletjes ruimer worden gezet.
assert(
  MAX_LIBRARY_OVERLAP <= 0.05,
  `MAX_LIBRARY_OVERLAP ≤ 0.05 (is ${MAX_LIBRARY_OVERLAP})`,
);
assert(
  MAX_LIBRARY_SPUR_M <= 150,
  `MAX_LIBRARY_SPUR_M ≤ 150 (is ${MAX_LIBRARY_SPUR_M})`,
);
assert(
  MIN_LIBRARY_SUBLOOP_M >= 2500,
  `MIN_LIBRARY_SUBLOOP_M ≥ 2500 (is ${MIN_LIBRARY_SUBLOOP_M})`,
);

if (failures > 0) {
  console.error(`route-library-gates: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("route-library-gates: alle checks geslaagd");
process.exit(0);
