// Tests voor route-match.ts — segmentmatching + afwijkingsdetectie.
// Dekt de 10 verplichte scenario's uit de hersteldopdracht "onjuiste melding
// 'Je wijkt af van de route'". Draaien: pnpm --filter @workspace/sparki-mobile
// run test:route-match (of via shell bij workflowlimiet).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  matchToRoute,
  corridorMeters,
  createOffRouteState,
  displayPosition,
  updateOffRoute,
  haversineMeters,
  type MatchLatLon,
  type OffRouteState,
  type RouteMatch,
} from "./route-match";

// ── Hulpjes ────────────────────────────────────────────────────────
// ~1 graad lat ≈ 111.194 m; op lat 52 is 1 graad lon ≈ 68.455 m.
const LAT0 = 52.0;
const LON0 = 5.0;
const M_PER_LAT = 111194;
const mPerLon = () => M_PER_LAT * Math.cos((LAT0 * Math.PI) / 180);

// Maak een punt op (xM oost, yM noord) t.o.v. de oorsprong.
function pt(xM: number, yM: number): MatchLatLon {
  return { lat: LAT0 + yM / M_PER_LAT, lon: LON0 + xM / mPerLon() };
}

function cumKmOf(pathPts: MatchLatLon[]): number[] {
  const cum = [0];
  for (let i = 1; i < pathPts.length; i++) {
    cum.push(cum[i - 1]! + haversineMeters(pathPts[i - 1]!, pathPts[i]!) / 1000);
  }
  return cum;
}

// Rechte route van 2 km met routepunten om de `spacingM` meter (west→oost).
function straightRoute(spacingM: number, lengthM = 2000): MatchLatLon[] {
  const pts: MatchLatLon[] = [];
  for (let x = 0; x <= lengthM; x += spacingM) pts.push(pt(x, 0));
  return pts;
}

type Fix = {
  xM: number;
  yM: number;
  tMs: number;
  accuracyM?: number | null;
  speedMps?: number | null;
};

// Speel een reeks GPS-metingen af door match + state machine; verzamel events.
function replay(
  routePts: MatchLatLon[],
  fixes: Fix[],
): { events: string[]; state: OffRouteState; maxDistM: number } {
  const cum = cumKmOf(routePts);
  let state = createOffRouteState();
  let hint: number | null = null;
  const events: string[] = [];
  let maxDistM = 0;
  for (const f of fixes) {
    const loc = pt(f.xM, f.yM);
    const m = matchToRoute(routePts, cum, loc, hint);
    assert.ok(m, "match verwacht");
    hint = m!.segIndex;
    maxDistM = Math.max(maxDistM, m!.distanceM);
    const upd = updateOffRoute(state, {
      lat: loc.lat,
      lon: loc.lon,
      timestampMs: f.tMs,
      distanceM: m!.distanceM,
      alongKm: m!.alongKm,
      accuracyM: f.accuracyM ?? 8,
      speedMps: f.speedMps ?? 7,
    });
    state = upd.state;
    if (upd.event) events.push(upd.event);
  }
  return { events, state, maxDistM };
}

// ── Segmentmatching zelf ───────────────────────────────────────────

test("segmentmatching: midden op een lang segment is afstand ~0 (punten 500 m uit elkaar)", () => {
  const route = straightRoute(500);
  const cum = cumKmOf(route);
  // Renner exact op de lijn, 250 m van elk routepunt.
  const m = matchToRoute(route, cum, pt(250, 0), null);
  assert.ok(m);
  assert.ok(m!.distanceM < 1, `afstand moet ~0 zijn, was ${m!.distanceM}`);
  assert.ok(Math.abs(m!.alongKm - 0.25) < 0.01);
});

test("segmentmatching: alongKm loopt netjes op met de rijrichting", () => {
  const route = straightRoute(100);
  const cum = cumKmOf(route);
  let prev = -1;
  let hint: number | null = null;
  for (let x = 0; x <= 2000; x += 60) {
    const m: RouteMatch = matchToRoute(route, cum, pt(x, 3), hint)!;
    hint = m.segIndex;
    assert.ok(m.alongKm >= prev, "voortgang mag niet terugspringen");
    prev = m.alongKm;
  }
});

test("corridor: dynamisch met nauwkeurigheid en snelheid, nooit extreem klein", () => {
  assert.ok(corridorMeters(null, null) >= 50);
  assert.ok(corridorMeters(5, 5) >= 50);
  assert.ok(corridorMeters(50, 20) <= 150);
  assert.ok(corridorMeters(30, 10) > corridorMeters(5, 10));
});

// ── Scenario 1: exact op de route ─────────────────────────────────

test("1. exact op de route: nooit een melding, ook met punten ver uit elkaar", () => {
  const route = straightRoute(400);
  const fixes: Fix[] = [];
  for (let i = 0; i <= 120; i++) fixes.push({ xM: i * 8, yM: 0, tMs: i * 1000 });
  const { events, maxDistM } = replay(route, fixes);
  assert.equal(events.length, 0);
  assert.ok(maxDistM < 2, "gematchte afstand blijft ~0 op het segment");
});

// ── Scenario 2: GPS wijkt tijdelijk enkele meters af ──────────────

test("2. tijdelijke GPS-drift van enkele meters: geen melding", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  for (let i = 0; i <= 60; i++) {
    const drift = i > 20 && i < 30 ? 18 : 4; // even 18 m naast de lijn
    fixes.push({ xM: i * 8, yM: drift, tMs: i * 1000, accuracyM: 12 });
  }
  const { events } = replay(route, fixes);
  assert.equal(events.length, 0);
});

// ── Scenario 3: één foutieve GPS-sprong ───────────────────────────

test("3. één foutieve GPS-sprong wordt genegeerd: geen melding", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  for (let i = 0; i <= 30; i++) {
    if (i === 15) {
      fixes.push({ xM: 15 * 8, yM: 900, tMs: i * 1000 }); // sprong 900 m opzij
    } else {
      fixes.push({ xM: i * 8, yM: 0, tMs: i * 1000 });
    }
  }
  const { events } = replay(route, fixes);
  assert.equal(events.length, 0);
});

test("3b. één afwijkende meting activeert NOOIT direct een melding", () => {
  const route = straightRoute(200);
  let state = createOffRouteState();
  const cum = cumKmOf(route);
  const loc = pt(100, 500);
  const m = matchToRoute(route, cum, loc, null)!;
  const upd = updateOffRoute(state, {
    lat: loc.lat,
    lon: loc.lon,
    timestampMs: 1000,
    distanceM: m.distanceM,
    alongKm: m.alongKm,
    accuracyM: 8,
    speedMps: 7,
  });
  assert.equal(upd.event, null);
  assert.equal(upd.state.active, false);
});

// ── Scenario 4: scherpe bocht / haarspeldbocht ─────────────────────

test("4. haarspeldbocht: renner volgt de bocht, geen melding", () => {
  // Route: 500 m oost, haarspeld (10 m boog), 500 m terug west op 30 m afstand.
  const route: MatchLatLon[] = [];
  for (let x = 0; x <= 500; x += 100) route.push(pt(x, 0));
  route.push(pt(515, 15));
  for (let x = 500; x >= 0; x -= 100) route.push(pt(x, 30));
  const fixes: Fix[] = [];
  let t = 0;
  for (let x = 0; x <= 500; x += 7) fixes.push({ xM: x, yM: 1, tMs: (t += 1000) });
  fixes.push({ xM: 512, yM: 8, tMs: (t += 1000) });
  fixes.push({ xM: 513, yM: 20, tMs: (t += 1000) });
  for (let x = 500; x >= 0; x -= 7) fixes.push({ xM: x, yM: 29, tMs: (t += 1000) });
  const { events } = replay(route, fixes);
  assert.equal(events.length, 0);
});

// ── Scenario 5: routepunten ver uit elkaar ─────────────────────────

test("5. routepunten 800 m uit elkaar: op de lijn rijden geeft geen melding", () => {
  const route = straightRoute(800, 4000);
  const fixes: Fix[] = [];
  for (let i = 0; i <= 200; i++) fixes.push({ xM: i * 10, yM: 2, tMs: i * 1000 });
  const { events } = replay(route, fixes);
  assert.equal(events.length, 0);
});

// ── Scenario 6: fietspad naast de autoweg ──────────────────────────

test("6. fietspad 20 m naast de routelijn: geen melding", () => {
  const route = straightRoute(250);
  const fixes: Fix[] = [];
  for (let i = 0; i <= 90; i++) fixes.push({ xM: i * 7, yM: 20, tMs: i * 1000, accuracyM: 10 });
  const { events } = replay(route, fixes);
  assert.equal(events.length, 0);
});

// ── Scenario 7: parallel aan de route (echt ernaast) ───────────────

test("7. structureel 250 m parallel rijden: wél precies één melding", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  for (let i = 0; i <= 40; i++) fixes.push({ xM: i * 7, yM: 250, tMs: i * 1000 });
  const { events, state } = replay(route, fixes);
  assert.deepEqual(events, ["enter"]);
  assert.equal(state.episode, 1);
});

// ── Scenario 8: echte afwijking ────────────────────────────────────

test("8. echte afwijking (haaks weg van de route): tijdig één melding", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  let t = 0;
  for (let x = 0; x <= 300; x += 7) fixes.push({ xM: x, yM: 0, tMs: (t += 1000) });
  // Haaks de route af, 7 m/s van de lijn weg.
  for (let y = 7; y <= 350; y += 7) fixes.push({ xM: 300, yM: y, tMs: (t += 1000) });
  const { events } = replay(route, fixes);
  assert.deepEqual(events, ["enter"]);
});

// ── Scenario 9: zelfstandig terugkeren ─────────────────────────────

test("9. terugkeer op de route: automatisch herstel (exit), zonder nieuwe vraag", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  let t = 0;
  for (let x = 0; x <= 150; x += 7) fixes.push({ xM: x, yM: 0, tMs: (t += 1000) });
  for (let y = 7; y <= 300; y += 7) fixes.push({ xM: 150, yM: y, tMs: (t += 1000) });
  for (let y = 300; y >= 0; y -= 7) fixes.push({ xM: 150, yM: y, tMs: (t += 1000) });
  for (let x = 150; x <= 300; x += 7) fixes.push({ xM: x, yM: 0, tMs: (t += 1000) });
  const { events, state } = replay(route, fixes);
  assert.deepEqual(events, ["enter", "exit"]);
  assert.equal(state.active, false);
});

// ── Scenario 10: herhaalde meldingen onderdrukt ────────────────────

test("10. dezelfde afwijkingssituatie geeft nooit een tweede melding", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  let t = 0;
  // Lang stilstaan/rondrijden op 400 m van de route.
  for (let x = 0; x <= 100; x += 7) fixes.push({ xM: x, yM: 0, tMs: (t += 1000) });
  for (let i = 0; i <= 120; i++)
    fixes.push({ xM: 100 + (i % 5), yM: 400 + (i % 7), tMs: (t += 1000) });
  const { events, state } = replay(route, fixes);
  assert.deepEqual(events, ["enter"]);
  assert.equal(state.episode, 1);
});

test("10b. nieuwe, losse afwijking later is wél een nieuwe episode", () => {
  const route = straightRoute(200);
  const fixes: Fix[] = [];
  let t = 0;
  const off = (n: number) => {
    for (let i = 0; i < n; i++) fixes.push({ xM: 100, yM: 300, tMs: (t += 1000) });
  };
  const on = (n: number) => {
    for (let i = 0; i < n; i++) fixes.push({ xM: 100 + i, yM: 0, tMs: (t += 1000) });
  };
  on(10); off(10); on(15); off(10);
  const { events, state } = replay(route, fixes);
  assert.deepEqual(events, ["enter", "exit", "enter"]);
  assert.equal(state.episode, 2);
});

// ── Eén positiebron: kaartpositie = gematchte positie ──────────────

test("displayPosition: op de route toont de kaart de gematchte positie (zelfde bron als voortgang)", () => {
  const route = straightRoute(100);
  const cum = cumKmOf(route);
  const raw = pt(500, 8); // 8 m naast de lijn
  const m = matchToRoute(route, cum, raw, null)!;
  const shown = displayPosition(raw, m, false, corridorMeters(5, 8));
  assert.deepEqual(shown, m.matched);
});

test("displayPosition: bij afwijking (of buiten corridor) eerlijk de ruwe GPS-positie", () => {
  const route = straightRoute(100);
  const cum = cumKmOf(route);
  const raw = pt(500, 200); // ver naast de route
  const m = matchToRoute(route, cum, raw, null)!;
  // buiten corridor → ruw, ook zonder actieve afwijking
  assert.deepEqual(displayPosition(raw, m, false, corridorMeters(5, 8)), raw);
  // actieve afwijking → altijd ruw
  assert.deepEqual(displayPosition(raw, m, true, 500), raw);
  // geen match → ruw
  assert.deepEqual(displayPosition(raw, null, false, 500), raw);
});

// ── Spiegelcontrole web ↔ mobiel ───────────────────────────────────

test("engine is byte-identiek gespiegeld naar artifacts/sparki/src/lib/route-match.ts", () => {
  const here = path.join(__dirname, "route-match.ts");
  const webCopy = path.join(
    __dirname,
    "..",
    "..",
    "sparki",
    "src",
    "lib",
    "route-match.ts",
  );
  assert.equal(
    readFileSync(here, "utf8"),
    readFileSync(webCopy, "utf8"),
    "route-match.ts moet in web en mobiel identiek blijven",
  );
});
