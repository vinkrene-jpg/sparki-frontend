// Generator voor de GPX-replay-fixtures van het navigatie-bewijs-harnas.
//
// Draai éénmalig (of na bewuste wijziging) met:
//   pnpm --filter @workspace/sparki-mobile exec tsx lib/nav-replay-fixtures/generate.ts
// en commit de resulterende .gpx-bestanden. De fixtures zijn DETERMINISTISCH
// (vaste seed) zodat het bewijs herhaalbaar is: dezelfde rit, dezelfde ruis,
// dezelfde uitkomst — geen flaky bewijs.
//
// Wat er gegenereerd wordt:
//   route.gpx           — de geplande route (bochtig parcours, wisselende
//                         puntdichtheid incl. spaarzame stukken van ~80 m,
//                         precies het geval dat vroeger valse meldingen gaf).
//   ride-onroute.gpx    — een rit exact langs die route, met realistische
//                         GPS-ruis (σ≈5 m, af en toe uitschieters tot ~25 m),
//                         wisselende accuracy en één onmogelijke GPS-sprong.
//   ride-deviation.gpx  — dezelfde rit tot km ~1.2, dan een bewuste afslag:
//                         haaks weg van de route tot ~500 m, daar doorfietsen.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));

// Deterministische PRNG (mulberry32) + Box-Muller voor gaussische ruis.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Lokale meter-projectie rond (52.0, 5.0) — zelfde aanpak als de engine.
const LAT0 = 52.0;
const LON0 = 5.0;
const M_PER_LAT = 111194;
const M_PER_LON = M_PER_LAT * Math.cos((LAT0 * Math.PI) / 180);
type XY = { x: number; y: number };
function toLatLon(p: XY): { lat: number; lon: number } {
  return { lat: LAT0 + p.y / M_PER_LAT, lon: LON0 + p.x / M_PER_LON };
}

// ── Route: bochtig parcours van ~4 km ──────────────────────────────
// Rechte stukken + haakse en flauwe bochten; puntafstand wisselt bewust
// tussen dicht (10 m) en spaarzaam (80 m).
function buildRouteXY(): XY[] {
  const legs: Array<{ dx: number; dy: number; lenM: number; spacingM: number }> = [
    { dx: 1, dy: 0, lenM: 800, spacingM: 25 }, // oost, normale dichtheid
    { dx: 0, dy: 1, lenM: 400, spacingM: 80 }, // noord, SPAARZAAM (oude valse-melding-case)
    { dx: 1, dy: 1, lenM: 600, spacingM: 40 }, // diagonaal noordoost
    { dx: 1, dy: 0, lenM: 700, spacingM: 10 }, // oost, dicht
    { dx: 0, dy: -1, lenM: 500, spacingM: 80 }, // zuid, SPAARZAAM
    { dx: 1, dy: 0, lenM: 1000, spacingM: 30 }, // oost, lang recht
  ];
  const pts: XY[] = [{ x: 0, y: 0 }];
  let cur: XY = { x: 0, y: 0 };
  for (const leg of legs) {
    const norm = Math.hypot(leg.dx, leg.dy);
    const ux = leg.dx / norm;
    const uy = leg.dy / norm;
    for (let d = leg.spacingM; d <= leg.lenM; d += leg.spacingM) {
      pts.push({ x: cur.x + ux * d, y: cur.y + uy * d });
    }
    cur = { x: cur.x + ux * leg.lenM, y: cur.y + uy * leg.lenM };
    const last = pts[pts.length - 1]!;
    if (last.x !== cur.x || last.y !== cur.y) pts.push({ ...cur });
  }
  return pts;
}

// Loop de routelijn af met constante snelheid; geeft positie op afstand s (m).
function alongPolyline(pts: XY[], sM: number): XY {
  let rem = sM;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (rem <= len) {
      const t = len === 0 ? 0 : rem / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    rem -= len;
  }
  return { ...pts[pts.length - 1]! };
}
function polylineLength(pts: XY[]): number {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    s += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
  }
  return s;
}

type Fix = { x: number; y: number; tMs: number; accuracyM: number; speedMps: number };

// Realistische GPS-ruis: gecorreleerde drift (random walk, klein) + witte
// ruis σ≈4 m; elke ~45 s een uitschieter tot ~25 m; accuracy schommelt 4–20 m.
function noisyRide(opts: {
  seed: number;
  route: XY[];
  speedMps: number;
  hz: number;
  // Optioneel: op afstand deviateAtM haaks afslaan en deviateLenM doorfietsen.
  deviateAtM?: number;
  deviateLenM?: number;
  // Eén onmogelijke GPS-sprong injecteren op deze fix-index (of niet).
  jumpAtIndex?: number;
}): Fix[] {
  const rand = mulberry32(opts.seed);
  const total = polylineLength(opts.route);
  const dt = 1000 / opts.hz;
  const fixes: Fix[] = [];
  let driftX = 0;
  let driftY = 0;
  let i = 0;
  const rideLen = opts.deviateAtM != null ? opts.deviateAtM : total;
  for (let s = 0; s <= rideLen; s += opts.speedMps / opts.hz, i++) {
    const base = alongPolyline(opts.route, s);
    driftX = driftX * 0.98 + gaussian(rand) * 0.6;
    driftY = driftY * 0.98 + gaussian(rand) * 0.6;
    let nx = gaussian(rand) * 4 + driftX;
    let ny = gaussian(rand) * 4 + driftY;
    let acc = 4 + rand() * 8;
    if (i > 0 && i % Math.round(45 * opts.hz) === 0) {
      // Uitschieter: slechte fix met eerlijke (hoge) accuracy.
      nx += gaussian(rand) * 12;
      ny += gaussian(rand) * 12;
      acc = 15 + rand() * 10;
    }
    let x = base.x + nx;
    let y = base.y + ny;
    if (opts.jumpAtIndex != null && i === opts.jumpAtIndex) {
      // Onmogelijke sprong: 600 m opzij, één enkele fix.
      x = base.x + 600;
      y = base.y + 600;
      acc = 30;
    }
    fixes.push({ x, y, tMs: i * dt, accuracyM: acc, speedMps: opts.speedMps });
  }
  if (opts.deviateAtM != null && opts.deviateLenM) {
    // Bewuste afslag: haaks (noord) weg van de route, zelfde ruis.
    const start = alongPolyline(opts.route, opts.deviateAtM);
    for (let d = opts.speedMps / opts.hz; d <= opts.deviateLenM; d += opts.speedMps / opts.hz, i++) {
      driftX = driftX * 0.98 + gaussian(rand) * 0.6;
      driftY = driftY * 0.98 + gaussian(rand) * 0.6;
      fixes.push({
        x: start.x + gaussian(rand) * 4 + driftX,
        y: start.y + d + gaussian(rand) * 4 + driftY,
        tMs: i * (1000 / opts.hz),
        accuracyM: 4 + rand() * 8,
        speedMps: opts.speedMps,
      });
    }
  }
  return fixes;
}

// ── GPX-serialisatie ───────────────────────────────────────────────
const T0 = Date.parse("2026-07-25T09:00:00Z");
function gpxOf(name: string, pts: Array<{ lat: number; lon: number; tMs?: number; acc?: number; spd?: number }>): string {
  const trkpts = pts
    .map((p) => {
      const ext =
        p.acc != null || p.spd != null
          ? `<extensions>${p.acc != null ? `<accuracy>${p.acc.toFixed(1)}</accuracy>` : ""}${p.spd != null ? `<speed>${p.spd.toFixed(2)}</speed>` : ""}</extensions>`
          : "";
      const time = p.tMs != null ? `<time>${new Date(T0 + p.tMs).toISOString()}</time>` : "";
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${time}${ext}</trkpt>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="sparki-nav-replay-fixtures" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${name}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n</gpx>\n`;
}

const routeXY = buildRouteXY();
const routePts = routeXY.map((p) => toLatLon(p));
writeFileSync(path.join(OUT_DIR, "route.gpx"), gpxOf("Bewijsroute", routePts));

const onroute = noisyRide({ seed: 20260725, route: routeXY, speedMps: 7, hz: 1, jumpAtIndex: 180 });
writeFileSync(
  path.join(OUT_DIR, "ride-onroute.gpx"),
  gpxOf(
    "Op-route rit met ruis",
    onroute.map((f) => ({ ...toLatLon(f), tMs: f.tMs, acc: f.accuracyM, spd: f.speedMps })),
  ),
);

const deviation = noisyRide({ seed: 20260726, route: routeXY, speedMps: 7, hz: 1, deviateAtM: 1200, deviateLenM: 500 });
writeFileSync(
  path.join(OUT_DIR, "ride-deviation.gpx"),
  gpxOf(
    "Bewuste afwijking op km 1,2",
    deviation.map((f) => ({ ...toLatLon(f), tMs: f.tMs, acc: f.accuracyM, spd: f.speedMps })),
  ),
);

console.log(
  `Fixtures geschreven: route (${routePts.length} punten), op-route rit (${onroute.length} fixes), afwijkingsrit (${deviation.length} fixes).`,
);
