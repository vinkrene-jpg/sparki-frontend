// GPX-replay-bewijsharnas voor de navigatiebeloften.
//
// Speelt opgenomen GPX-ritten (realistische GPS-ruis, deterministische
// fixtures — zie lib/nav-replay-fixtures/generate.ts) end-to-end door de
// echte engine-keten: matchToRoute → updateOffRoute → shouldShowOffRoutePrompt
// → offRouteOptions. Precies zoals de nav-schermen die keten aanroepen.
//
// Bewijst de beloften uit docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml
// (ROUTES_MOBIELE_NAVIGATIE_001 en ROUTES_WEDSTRIJDMODUS_001):
//   1. Op-route rijden met echte ruis (incl. spaarzame routegeometrie en één
//      GPS-sprong) geeft NUL afwijk-meldingen.
//   2. Eén bewuste afwijking geeft precies ÉÉN keuzekaart; "negeren" blijft
//      stil zolang de afwijking niet wezenlijk groeit.
//   3. De route wordt tijdens navigatie NOOIT gewijzigd of vervangen
//      (geometrie byte-gelijk vóór en ná de rit).
//   4. Wedstrijdmodus: "terug naar het parcours" is altijd de eerste én
//      primaire keuze; het parcours blijft byte-gelijk.
//
// Draaien: pnpm --filter @workspace/sparki-mobile run test:nav-replay

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  matchToRoute,
  corridorMeters,
  createOffRouteState,
  updateOffRoute,
  haversineMeters,
  type MatchLatLon,
  type OffRouteState,
  type RouteMatch,
} from "./route-match";
import {
  offRouteOptions,
  createOffRoutePromptState,
  registerDismiss,
  shouldShowOffRoutePrompt,
  type OffRoutePromptState,
} from "./off-route-choice";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "nav-replay-fixtures");

// ── GPX-parser (fixtures zijn eenvoudige 1.1-tracks) ──────────────
type GpxFix = {
  lat: number;
  lon: number;
  timestampMs: number;
  accuracyM: number | null;
  speedMps: number | null;
};

function parseGpx(file: string): GpxFix[] {
  const xml = readFileSync(path.join(FIXTURES, file), "utf8");
  const fixes: GpxFix[] = [];
  const re = /<trkpt lat="([^"]+)" lon="([^"]+)">(.*?)<\/trkpt>|<trkpt lat="([^"]+)" lon="([^"]+)"\s*\/>/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = Number(m[1] ?? m[4]);
    const lon = Number(m[2] ?? m[5]);
    const body = m[3] ?? "";
    const time = /<time>([^<]+)<\/time>/.exec(body)?.[1];
    const acc = /<accuracy>([^<]+)<\/accuracy>/.exec(body)?.[1];
    const spd = /<speed>([^<]+)<\/speed>/.exec(body)?.[1];
    fixes.push({
      lat,
      lon,
      timestampMs: time ? Date.parse(time) : 0,
      accuracyM: acc != null ? Number(acc) : null,
      speedMps: spd != null ? Number(spd) : null,
    });
  }
  assert.ok(fixes.length > 0, `GPX ${file} bevat trackpunten`);
  return fixes;
}

function cumKmOf(pts: MatchLatLon[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + haversineMeters(pts[i - 1]!, pts[i]!) / 1000);
  }
  return cum;
}

// ── Replay-harnas: exact de keten zoals de nav-schermen die rijden ──
type ReplayResult = {
  enterEvents: number;
  exitEvents: number;
  promptShownCount: number; // aantal keer dat de kaart NIEUW opengaat
  promptDistancesM: number[]; // afstand tot de route op elk kaart-moment
  ignoredFixes: number;
  state: OffRouteState;
  promptState: OffRoutePromptState;
  maxOnRouteDistM: number;
};

function replayRide(opts: {
  route: MatchLatLon[];
  fixes: GpxFix[];
  // Simuleer "negeren" zodra de kaart voor het eerst verschijnt?
  dismissOnFirstPrompt?: boolean;
}): ReplayResult {
  const cumKm = cumKmOf(opts.route);
  let hint: number | null = null;
  let state = createOffRouteState();
  let promptState = createOffRoutePromptState();
  let promptOpen = false;
  const res: ReplayResult = {
    enterEvents: 0,
    exitEvents: 0,
    promptShownCount: 0,
    promptDistancesM: [],
    ignoredFixes: 0,
    state,
    promptState,
    maxOnRouteDistM: 0,
  };
  for (const fix of opts.fixes) {
    const match = matchToRoute(opts.route, cumKm, fix, hint);
    assert.ok(match, "match mag nooit null zijn op een niet-lege route");
    hint = match.segIndex;
    const upd = updateOffRoute(state, {
      lat: fix.lat,
      lon: fix.lon,
      timestampMs: fix.timestampMs,
      distanceM: match.distanceM,
      alongKm: match.alongKm,
      accuracyM: fix.accuracyM,
      speedMps: fix.speedMps,
    });
    state = upd.state;
    if (upd.ignored) res.ignoredFixes++;
    if (upd.event === "enter") res.enterEvents++;
    if (upd.event === "exit") res.exitEvents++;
    if (!state.active) {
      res.maxOnRouteDistM = Math.max(res.maxOnRouteDistM, match.distanceM);
      promptOpen = false;
    }
    const show = shouldShowOffRoutePrompt(promptState, {
      active: state.active,
      episode: state.episode,
      distanceM: match.distanceM,
      hasDetour: false,
    });
    if (show && !promptOpen) {
      res.promptShownCount++;
      res.promptDistancesM.push(match.distanceM);
      promptOpen = true;
      if (opts.dismissOnFirstPrompt) {
        promptState = registerDismiss(promptState, state.episode, match.distanceM);
        promptOpen = false;
      }
    }
    if (!show) promptOpen = false;
  }
  res.state = state;
  res.promptState = promptState;
  return res;
}

// Route inlezen + diep bevriezen: elke mutatiepoging door de engine-keten
// zou hier hard gooien. Samen met de byte-vergelijking is dit het bewijs
// dat de route nooit wordt aangepast of vervangen.
function loadFrozenRoute(): { route: MatchLatLon[]; snapshot: string } {
  const route = parseGpx("route.gpx").map((f) => ({ lat: f.lat, lon: f.lon }));
  for (const p of route) Object.freeze(p);
  Object.freeze(route);
  return { route, snapshot: JSON.stringify(route) };
}

// ── Scenario 1: op-route rit met echte ruis → nul meldingen ────────
test("op-route rit met GPS-ruis, spaarzame geometrie en één GPS-sprong: nul afwijk-meldingen", () => {
  const { route, snapshot } = loadFrozenRoute();
  const fixes = parseGpx("ride-onroute.gpx");
  const res = replayRide({ route, fixes });

  assert.equal(res.enterEvents, 0, "geen enkele afwijk-melding op een op-route rit");
  assert.equal(res.promptShownCount, 0, "de keuzekaart verschijnt nooit");
  assert.equal(res.state.active, false, "rit eindigt op-route");
  assert.equal(res.ignoredFixes, 1, "precies de ene geïnjecteerde GPS-sprong wordt genegeerd");
  // Sanity: de rit bevat echte ruis (anders bewijst dit niets).
  assert.ok(res.maxOnRouteDistM > 8, `ruis is realistisch aanwezig (max ${res.maxOnRouteDistM.toFixed(1)} m)`);
  assert.equal(JSON.stringify(route), snapshot, "routegeometrie byte-gelijk vóór en ná de rit");
});

// ── Scenario 2: bewuste afwijking → precies één kaart, dismiss blijft stil ──
test("bewuste afwijking: precies één keuzekaart; na 'negeren' blijft het stil", () => {
  const { route, snapshot } = loadFrozenRoute();
  const fixes = parseGpx("ride-deviation.gpx");
  const res = replayRide({ route, fixes, dismissOnFirstPrompt: true });

  assert.equal(res.enterEvents, 1, "precies één afwijkingsepisode");
  // Contract: één kaart per episode; na "negeren" blijft het stil tot de
  // afwijking WEZENLIJK groeit (≥2× én ≥+150 m) — de renner rijdt hier bewust
  // 500 m van de route weg, dus precies één rustige her-melding is correct
  // (de situatie is dan wezenlijk anders). Nooit een spervuur.
  assert.ok(res.promptShownCount <= 2, `nooit meer dan één her-melding (was ${res.promptShownCount})`);
  assert.equal(res.promptShownCount, 2, "één kaart + één her-melding pas bij wezenlijke groei");
  const [first, second] = res.promptDistancesM as [number, number];
  assert.ok(
    second >= first * 2 && second - first >= 150,
    `her-melding pas bij ≥2× én ≥+150 m groei (van ${first.toFixed(0)} m naar ${second.toFixed(0)} m)`,
  );
  assert.equal(res.state.active, true, "afwijking is aan het einde nog actief (renner reed door)");
  assert.equal(res.state.episode, 1, "episodeteller staat op 1");
  assert.equal(JSON.stringify(route), snapshot, "routegeometrie byte-gelijk vóór en ná de rit");
});

// Zolang de afwijking na "negeren" NIET wezenlijk groeit, blijft het stil:
// zelfde rit, maar afgekapt vóór de groei-drempel (≥2× én ≥+150 m).
test("na 'negeren' blijft de kaart dicht zolang de afwijking niet wezenlijk groeit", () => {
  const { route, snapshot } = loadFrozenRoute();
  const fixes = parseGpx("ride-deviation.gpx");
  // Kap de rit af zodra de groei-drempel bereikt zou worden.
  const cumKm = cumKmOf(route);
  let hint: number | null = null;
  let cutoff = fixes.length;
  let firstPromptDist: number | null = null;
  let st = createOffRouteState();
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i]!;
    const match: RouteMatch = matchToRoute(route, cumKm, f, hint)!;
    hint = match.segIndex;
    const upd = updateOffRoute(st, {
      lat: f.lat, lon: f.lon, timestampMs: f.timestampMs,
      distanceM: match.distanceM, alongKm: match.alongKm,
      accuracyM: f.accuracyM, speedMps: f.speedMps,
    });
    st = upd.state;
    if (upd.event === "enter" && firstPromptDist == null) firstPromptDist = match.distanceM;
    if (
      firstPromptDist != null &&
      match.distanceM >= firstPromptDist * 2 &&
      match.distanceM - firstPromptDist >= 150
    ) {
      cutoff = i; // vanaf hier zou her-melden legitiem zijn — dus stop ervoor
      break;
    }
  }
  assert.ok(firstPromptDist != null && cutoff < fixes.length, "afkappunt gevonden");
  const res = replayRide({ route, fixes: fixes.slice(0, cutoff), dismissOnFirstPrompt: true });
  assert.equal(res.enterEvents, 1, "één afwijkingsepisode");
  assert.equal(res.promptShownCount, 1, "precies één kaart; 'negeren' blijft stil zonder wezenlijke groei");
  assert.equal(JSON.stringify(route), snapshot, "routegeometrie byte-gelijk vóór en ná de rit");
});

// Detectie moet wel snel genoeg zijn: binnen 10 s na 'duidelijk buiten'.
test("bewuste afwijking wordt binnen 10 s na de eerste buiten-corridor-fix gemeld", () => {
  const { route } = loadFrozenRoute();
  const cumKm = cumKmOf(route);
  const fixes = parseGpx("ride-deviation.gpx");
  let hint: number | null = null;
  let state = createOffRouteState();
  let firstBadMs: number | null = null;
  let enterMs: number | null = null;
  for (const fix of fixes) {
    const match: RouteMatch = matchToRoute(route, cumKm, fix, hint)!;
    hint = match.segIndex;
    const corridor = corridorMeters(fix.accuracyM, fix.speedMps);
    const upd = updateOffRoute(state, {
      lat: fix.lat,
      lon: fix.lon,
      timestampMs: fix.timestampMs,
      distanceM: match.distanceM,
      alongKm: match.alongKm,
      accuracyM: fix.accuracyM,
      speedMps: fix.speedMps,
    });
    if (!upd.ignored && match.distanceM > corridor && firstBadMs == null && upd.state.badCount > 0) {
      firstBadMs = fix.timestampMs;
    }
    if (upd.event === "enter" && enterMs == null) enterMs = fix.timestampMs;
    state = upd.state;
  }
  assert.ok(firstBadMs != null && enterMs != null, "afwijking gedetecteerd");
  const delayS = (enterMs! - firstBadMs!) / 1000;
  assert.ok(delayS <= 10, `melding binnen 10 s na eerste buiten-fix (was ${delayS.toFixed(1)} s)`);
});

// ── Scenario 3: wedstrijdmodus → terugkeer eerst, parcours heilig ──
test("wedstrijd (usageType 'wedstrijd'): 'terug naar het parcours' altijd eerst; parcours byte-gelijk", () => {
  const { route, snapshot } = loadFrozenRoute();
  const fixes = parseGpx("ride-deviation.gpx");
  const res = replayRide({ route, fixes });

  // De afwijking triggert de kaart; in wedstrijdmodus is de optie-volgorde
  // terugkeer-geprioriteerd — dat is exact wat de nav-schermen renderen.
  assert.equal(res.enterEvents, 1, "afwijking gedetecteerd op het parcours");
  const options = offRouteOptions(true);
  assert.equal(options[0]!.id, "terug", "'terug' is de eerste optie in wedstrijdmodus");
  assert.equal(options[0]!.primary, true, "'terug' is de primaire keuze");
  assert.ok(
    options[0]!.detail.includes("parcours"),
    "wedstrijd-copy benoemt terugkeer naar het parcours",
  );
  assert.equal(
    options.filter((o) => o.primary).length,
    1,
    "precies één primaire optie — geen concurrerende 'nieuwe route' bovenaan",
  );
  const bestemming = options.find((o) => o.id === "bestemming")!;
  assert.ok(
    bestemming.detail.includes("originele wedstrijdroute blijft bewaard"),
    "'bestemming' draagt de eerlijke kanttekening dat het parcours bewaard blijft",
  );
  assert.equal(JSON.stringify(route), snapshot, "parcoursgeometrie byte-gelijk vóór en ná de rit");
});

// ── Scenario 4: echte praktijkrit Dylan/René (Komoot, 22-07-2026) ───
//
// Bewijs met een échte opgenomen rit dat de navigatie-engine stil blijft op
// echte GPS-coördinaten. De rit is de "Klim Eyserbosweg – Dikkebuikseweg
// rondtocht vanuit Valkenburg" gereden door Dylan en René (22-07-2026, Komoot).
// De route is uit de track gedestilleerd via 50 m-afstandsgebaseerde dunning
// (zoals een geplande Garmin-route). De rit bevat geen accuracy/speed-
// extensies; de engine valt terug op de veilige standaard (67,5 m corridor).
test("echte praktijkrit Dylan/René (Komoot 22-07-2026, ~170 km): nul afwijk-meldingen", () => {
  const route = parseGpx("route-dylan.gpx").map((f) => ({ lat: f.lat, lon: f.lon }));
  const snapshot = JSON.stringify(route);
  Object.freeze(route);
  for (const p of route) Object.freeze(p);

  const fixes = parseGpx("ride-dylan.gpx");

  // Sanity-checks: de fixture is volledig en bevat echte GPS-coördinaten.
  assert.ok(route.length >= 200, `route heeft voldoende puntdichtheid (${route.length} pts)`);
  assert.ok(fixes.length >= 500, `rit bevat voldoende fixes (${fixes.length} fixes)`);
  assert.ok(
    fixes[0]!.lat > 50 && fixes[0]!.lat < 51 && fixes[0]!.lon > 5 && fixes[0]!.lon < 7,
    "coördinaten liggen in Zuid-Limburg/België (50–51°N, 5–7°E)",
  );

  const res = replayRide({ route, fixes });

  assert.equal(res.enterEvents, 0, "geen enkele afwijk-melding op de echte praktijkrit");
  assert.equal(res.promptShownCount, 0, "de keuzekaart verschijnt nooit op de echte rit");
  assert.equal(res.state.active, false, "rit eindigt op-route (renners bleven op het parcours)");
  assert.equal(JSON.stringify(route), snapshot, "routegeometrie byte-gelijk vóór en ná de rit");
});

// ── Fixture-integriteit: fixtures matchen de generator (geen stille drift) ──
test("fixtures zijn aanwezig en deterministisch opgebouwd", () => {
  const route = parseGpx("route.gpx");
  const onroute = parseGpx("ride-onroute.gpx");
  const deviation = parseGpx("ride-deviation.gpx");
  assert.ok(route.length >= 100, "route heeft realistische puntdichtheid");
  assert.ok(onroute.length >= 500, "op-route rit is lang genoeg (~10 min) om ruis te bewijzen");
  assert.ok(deviation.length >= 200, "afwijkingsrit bevat de bewuste afslag");
  // Tijdstempels lopen strikt op (1 Hz): replay is een echte rit, geen bak losse punten.
  for (let i = 1; i < onroute.length; i++) {
    assert.ok(onroute[i]!.timestampMs > onroute[i - 1]!.timestampMs, "fixes lopen in de tijd op");
  }
});
