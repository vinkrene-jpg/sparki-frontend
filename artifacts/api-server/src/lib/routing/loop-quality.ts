// Loop quality — reduce the "small lusjes / same road twice" problem in
// generated round-trips.
//
// ORS `round_trip` returns ONE loop per (seed, points). On a sparse road network
// a single random loop often doubles back on itself or stitches together little
// repeated lusjes. We cannot change what a single ORS call returns, but we CAN
// ask ORS for several real candidates and keep the one that backtracks least.
// Every candidate is still 100% real ORS geometry — nothing here fabricates a
// path; it only *selects* among honest results (and honestly falls back to the
// only usable one when candidates are scarce).

import type { LoopRequest, RouteResult, RoutingProvider } from "./types";
import type { RouteObstacles } from "../route-remarks";

const CELL_DEG = 0.0006;

// Fail-closed geometrie-check: een pad met niet-finite coördinaten mag NOOIT
// stil door de kwaliteitspoorten glippen (NaN vergiftigt elke meting).
function hasInvalidPoint(path: [number, number][]): boolean {
  for (const p of path) {
    if (
      !Array.isArray(p) ||
      !Number.isFinite(p[0]) ||
      !Number.isFinite(p[1])
    ) {
      return true;
    }
  }
  return false;
}

function cellKey(lat: number, lon: number): string {
  return `${Math.round(lat / CELL_DEG)}:${Math.round(lon / CELL_DEG)}`;
}

// Metres between two [lat, lon] points (haversine). Used to weight overlap by
// real distance rather than raw point count (ORS densifies geometry unevenly).
function segMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Fraction (0..1) of a route's length ridden over road segments the route uses
// more than once. 0 = every stretch is unique (a clean loop); higher = more
// out-and-back / repeated lusjes. Direction-agnostic: A→B and later B→A both
// map to the same undirected edge, so a there-and-back counts as overlap.
export function pathOverlapFraction(path: [number, number][]): number {
  if (path.length < 3) return 0;
  if (hasInvalidPoint(path)) return 1; // fail-closed: kapotte geometrie keurt af
  const edgeCount = new Map<string, number>();
  let total = 0;
  let repeated = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = segMeters(a, b);
    if (len <= 0) continue;
    total += len;
    const ka = cellKey(a[0], a[1]);
    const kb = cellKey(b[0], b[1]);
    if (ka === kb) continue; // movement within one cell — too small to judge
    const edge = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const seen = edgeCount.get(edge) ?? 0;
    if (seen >= 1) repeated += len;
    edgeCount.set(edge, seen + 1);
  }
  return total > 0 ? repeated / total : 0;
}

// Fractie (0..1) van de lengte van pad A die over dezelfde wegcellen loopt als
// pad B. Gebruikt om écht verschillende routevoorstellen te kiezen — geen
// drie keer bijna dezelfde lus. Zelfde cel-snapping als pathOverlapFraction;
// alleen echte geometrie, fail-closed bij kapotte coördinaten.
export function pathSharedFraction(
  a: [number, number][],
  b: [number, number][],
): number {
  if (a.length < 2 || b.length < 2) return 0;
  if (hasInvalidPoint(a) || hasInvalidPoint(b)) return 1;
  const cells = new Set<string>();
  for (const p of b) cells.add(cellKey(p[0], p[1]));
  let total = 0;
  let shared = 0;
  for (let i = 1; i < a.length; i++) {
    const p = a[i - 1]!;
    const q = a[i]!;
    const len = segMeters(p, q);
    if (len <= 0) continue;
    total += len;
    if (cells.has(cellKey(q[0], q[1]))) shared += len;
  }
  return total > 0 ? shared / total : 0;
}

// Longest CONTIGUOUS stretch (metres) that the route rides over road segments
// it also uses elsewhere — the "dead-end spur" signature. A loop can have a low
// total overlap fraction and still contain one 500 m out-and-back stub that
// looks like riding into a doodlopende weg; this measures exactly that stub.
export function longestRepeatedStretchM(path: [number, number][]): number {
  if (path.length < 3) return 0;
  if (hasInvalidPoint(path)) return Infinity; // fail-closed
  // Pass 1: count undirected edges (same snapping as pathOverlapFraction).
  const edgeCount = new Map<string, number>();
  const edgeOf = (a: [number, number], b: [number, number]): string | null => {
    const ka = cellKey(a[0], a[1]);
    const kb = cellKey(b[0], b[1]);
    if (ka === kb) return null;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  for (let i = 1; i < path.length; i++) {
    const e = edgeOf(path[i - 1]!, path[i]!);
    if (!e) continue;
    edgeCount.set(e, (edgeCount.get(e) ?? 0) + 1);
  }
  // Pass 2: longest run of consecutive segments whose edge is used 2+ times.
  let longest = 0;
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const e = edgeOf(a, b);
    const repeated = e != null && (edgeCount.get(e) ?? 0) >= 2;
    if (repeated) {
      run += segMeters(a, b);
      if (run > longest) longest = run;
    } else if (e != null) {
      // Alleen een ECHTE unieke wegrand breekt de reeks; micro-verplaatsingen
      // binnen één cel (e == null) laten de reeks doorlopen.
      run = 0;
    }
  }
  return Math.round(longest);
}

// Smallest sub-loop (metres) in the route: the route komt terug op een plek
// (cel) waar hij eerder was, terwijl het tussenliggende stuk maar een paar
// honderd meter tot een paar kilometer lang is — het "klein lusje"-patroon.
// Een normale grote lus passeert hetzelfde kruispunt hooguit met een ENORM
// tussenstuk (prima); alleen kleine tussenstukken zijn lelijk. Retourneert
// Infinity wanneer er geen kleine sub-lus is.
export function smallestSubLoopM(path: [number, number][]): number {
  if (path.length < 4) return Infinity;
  if (hasInvalidPoint(path)) return 0; // fail-closed: keurt af via de ondergrens
  // Afstand langs de route tot elk punt (m).
  const along: number[] = new Array(path.length).fill(0);
  for (let i = 1; i < path.length; i++) {
    along[i] = along[i - 1]! + segMeters(path[i - 1]!, path[i]!);
  }
  const lastAt = new Map<string, number>(); // cel → laatste bezochte index
  let smallest = Infinity;
  for (let i = 0; i < path.length; i++) {
    const k = cellKey(path[i]![0], path[i]![1]);
    const prev = lastAt.get(k);
    if (prev != null) {
      const sub = along[i]! - along[prev]!;
      // Ondergrens ~120 m: heen-en-terug binnen een kruispunt/cel is geen
      // lusje. Bovengrens: alles onder een paar km is een "klein lusje".
      if (sub >= 120 && sub < smallest) smallest = sub;
    }
    lastAt.set(k, i);
  }
  return smallest;
}

// Generate a varied loop: ask the provider for a handful of real candidates with
// distinct seeds and keep the one that backtracks least while staying closest to
// the requested distance. Falls back honestly to the only usable candidate when
// others fail; throws only when NONE succeed (same contract as generateLoop).
// Total climb (m) for a candidate. ORS's GeoJSON `summary.ascent` is frequently
// null even with elevation requested, so we fall back to summing the real climb
// from the per-point elevations ORS DOES return. Never fabricates: null only
// when there is genuinely no elevation data to read.
function trackAscentM(result: RouteResult): number | null {
  if (typeof result.ascentM === "number") return result.ascentM;
  let gain = 0;
  let seen = 0;
  let prev: number | null = null;
  for (const p of result.points) {
    if (typeof p.ele !== "number") continue;
    seen += 1;
    if (prev != null && p.ele > prev) gain += p.ele - prev;
    prev = p.ele;
  }
  return seen > 1 ? Math.round(gain) : null;
}

// Ascent per km (m/km) for a candidate; null when there is no usable distance
// or elevation so the preference simply doesn't weigh in for that candidate.
function ascentPerKm(result: RouteResult): number | null {
  const ascent = trackAscentM(result);
  if (ascent == null || result.distanceKm == null || result.distanceKm <= 0) {
    return null;
  }
  return ascent / result.distanceKm;
}

// Elevation-match penalty (0 = perfect for the stated preference, higher = worse).
// Normalised against ~25 m/km, roughly the span from pancake-flat to clearly
// hilly terrain. "any" never penalises. This only RANKS real ORS candidates —
// it never changes a route's actual elevation.
function elevationPenalty(
  result: RouteResult,
  preference: "flat" | "hilly" | "any",
): number {
  if (preference === "any") return 0;
  const apk = ascentPerKm(result);
  if (apk == null) return 0;
  const normalized = Math.min(apk / 25, 1);
  return preference === "flat" ? normalized : 1 - normalized;
}

// Scenery wish: select the candidate with the most nature and/or the fewest
// traffic lights. The caller supplies `environmentOf` (real OpenStreetMap
// facts per candidate); this module never fetches anything itself and never
// changes geometry — it only *ranks* real ORS candidates by real map data.
export type SceneryWish = { nature: boolean; avoidTrafficLights: boolean };

export type CandidateEnvironment = {
  trafficLights: number | null;
  forestSharePct: number | null;
  // Aandeel bebouwd gebied (woonwijk/winkel/bedrijven) langs de route (0–100).
  // Vaste eis: routes koersen zo min mogelijk door dorpskernen en woonwijken,
  // dus dit weegt ALTIJD mee zodra het gemeten is.
  builtUpSharePct?: number | null;
  // Optioneel: totaal aantal onderbrekende wegobjecten (verkeerslichten +
  // spoorwegovergangen + rotondes + drempels) uit de Sparki Traffic Database.
  // Wanneer aanwezig weegt dit zwaarder dan alleen het lichten-aantal — een
  // intervalblok wordt door élk van deze objecten onderbroken.
  stopObstacles?: number | null;
};

// Real manoeuvres in a candidate's ORS turn-by-turn steps: everything the rider
// must actually steer for (turns, sharp turns, roundabouts, U-turns). Straight
// continuations, keep-left/right and depart/arrive are not interruptions.
const REAL_TURN_DIRS = new Set([
  "Links",
  "Rechts",
  "Scherp links",
  "Scherp rechts",
  "Rotonde",
  "Rotonde af",
  "Keren",
]);

// Turns per km for a candidate, counted from the provider's REAL turn-by-turn
// steps. Null when there is no usable distance so the preference simply does
// not weigh in (never a guessed density).
export function turnsPerKm(result: RouteResult): number | null {
  if (result.distanceKm == null || result.distanceKm <= 0) return null;
  const turns = result.steps.filter((s) => REAL_TURN_DIRS.has(s.dir)).length;
  return turns / result.distanceKm;
}

// Turn-density penalty (0 = turn-poor, 1 = very turny), normalised against
// ~2.5 turns/km — roughly the difference between open polder roads and a
// residential-zigzag loop. Only RANKS real ORS candidates; never edits a route.
function turnDensityPenalty(result: RouteResult): number {
  const density = turnsPerKm(result);
  if (density == null) return 0;
  return Math.min(density / 2.5, 1);
}

// Fietsgeschiktheids-poort (PO-01, taak #419) op basis van de wegdek-/
// toegangsmeting die de provider zelf meelevert (GraphHopper path details).
// Onverhard op de racefiets weegt zwaar (>5% is een echte misser). Bewust geen
// toegangsstraf: road_access is auto-toegang en zou fietspaden benadelen.
// Providers zonder meting (ORS) krijgen geen straf — daar blijft de
// Overpass-verificatie achteraf de enige poort.

// Puur + testbaar (taak #487): vaste racefiets-straf voor kandidaten met
// gemeten onbekend wegdek. Groter dan de opgetelde kwaliteitswensen zodat
// "eerst een alternatief zonder onbekend wegdek" echt de selectie stuurt;
// kleiner dan de harde-afkeur-1000 zodat in regio's zonder volledig
// geverifieerde route nog steeds de beste kandidaat overblijft (die de UI
// vervolgens alleen na expliciete keuze aanbiedt). null-meting: 0 — nooit
// gokken, alleen echte data rangschikken.
export function roadUnknownGatePenalty(
  profile: string,
  surfaceKnownFraction: number | null,
): number {
  if (profile !== "cycling-road") return 0;
  if (surfaceKnownFraction == null) return 0;
  return surfaceKnownFraction >= 0.999 ? 0 : 5;
}

export async function generateVariedLoop(
  provider: RoutingProvider,
  req: LoopRequest,
  opts?: {
    candidates?: number;
    scenery?: SceneryWish | null;
    environmentOf?: (
      path: [number, number][],
    ) => Promise<CandidateEnvironment | null>;
    // Prefer turn-poor candidates (long uninterrupted stretches) — used for
    // interval trainings, where every turn breaks a block. Ranks real ORS
    // candidates by their real turn-by-turn steps; never changes geometry.
    preferUninterrupted?: boolean;
    // Hoogtemeter-doel: kies de ECHTE kandidaat waarvan de gemeten stijging
    // het dichtst bij dit doel ligt. Alleen rangschikken van echte
    // ORS-kandidaten — het doel wordt nooit "gemaakt" of gegarandeerd.
    targetAscentM?: number | null;
    // Officiële-kaart-controlelaag (BGT NL / GRB Vlaanderen, taken #428/#470):
    // aandeel (0..1) van een
    // kandidaatpad dat volgens de officiële overheidswegenkaart half verhard
    // of onverhard is. null = geen oordeel (buiten NL / bron faalde / te dunne
    // dekking) — dan weegt dit simpelweg niet mee. Alleen racefiets
    // (cycling-road); de motor wordt hiermee NIET vervangen, alleen de
    // selectie tussen echte kandidaten gecontroleerd.
    unpavedShareOf?: (path: [number, number][]) => Promise<number | null>;
    // WP-1: eerlijke fasemelding — aangeroepen zodra de blokkerende
    // veiligheidscontrole van de winnaar begint (Overpass kan bij een koud
    // gebied tientallen seconden duren; de klant toont dan een aparte status).
    onPhase?: (p: "berekenen" | "veiligheidscontrole") => void;
    // Obstakel-telling (Overpass, gedeelde cache met de routeopmerkingen).
    // Acceptatiegrenzen René (30-07-2026): een kandidaat met een trap, een
    // aantoonbaar fietsverbod of een afgesloten/privé-poort wordt nooit
    // gekozen zolang er een alternatief is; racefiets tevens 0 onverhard
    // (taak #437). null = geen meting (bron faalde) — eerlijk niet mee.
    obstaclesOf?: (path: [number, number][]) => Promise<RouteObstacles | null>;
    // Fail-closed eindverificatie van de WINNAAR (taak #505, besluit René
    // 30-07-2026): een blokkerende obstakelmeting zonder tijdbudget. De
    // scorende `obstaclesOf` hierboven mag een kort budget hebben (selectie-
    // heuristiek), maar de geleverde route zelf wordt hiermee volledig
    // geverifieerd: hard geblokkeerd ⇒ volgende kandidaat proberen; meting
    // definitief mislukt ⇒ UnverifiableRouteError — nooit stil als veilig
    // behandelen, nooit leveren.
    verifyObstaclesOf?: (
      path: [number, number][],
    ) => Promise<RouteObstacles | null>;
    // Onverhard-voorkeur (taak #440, gravel/MTB): gewenst aandeel onverhard
    // (0..1) uit de schuifbalk in de routegeneratie-UI. Rangschikt ECHTE
    // kandidaten op hoe dicht hun GEMETEN onverhard-aandeel bij deze voorkeur
    // ligt — een voorkeur, nooit een garantie. Zonder wegdekmeting (ORS)
    // weegt dit eerlijk niet mee: nooit gokken. Racefiets negeert dit veld
    // volledig — daar geldt de harde 0%-grens (taak #437) hierboven.
    unpavedTargetShare?: number | null;
    // Meerdere voorstellen (kaart-planner): vul deze array met maximaal
    // `alternatesMax` extra ECHTE kandidaten uit de interne pool die (a) niet
    // hard afgekeurd zijn, (b) zelf een schone lus zijn en (c) écht anders
    // lopen dan de winnaar en elkaar (onderlinge overlap-check). De winnaar
    // blijft de best scorende; dit gooit de verliezers niet langer stil weg.
    alternatesOut?: RouteResult[];
    alternatesMax?: number;
  },
): Promise<RouteResult> {
  const preference = req.elevationPreference ?? "any";
  const scenery =
    opts?.scenery && (opts.scenery.nature || opts.scenery.avoidTrafficLights)
      ? opts.scenery
      : null;
  const wantsScenery = scenery != null && opts?.environmentOf != null;
  // Vaste eis (geen optie): zodra er een omgevingsmeting beschikbaar is,
  // vergelijken we kandidaten ALTIJD op stoplichten/wegobstakels en bebouwing
  // en wint de rustigste route. Een expliciete natuur-wens komt daar bovenop.
  const wantsCalmRoads = opts?.environmentOf != null;
  const preferUninterrupted = opts?.preferUninterrupted === true;
  const targetAscentM =
    typeof opts?.targetAscentM === "number" &&
    Number.isFinite(opts.targetAscentM) &&
    opts.targetAscentM >= 0
      ? opts.targetAscentM
      : null;
  // Onverhard-voorkeur: alleen geldig op niet-racefietsprofielen (racefiets
  // houdt de harde 0%-grens) en alleen bij een zinnige waarde (0..1).
  const unpavedTargetShare =
    req.profile !== "cycling-road" &&
    typeof opts?.unpavedTargetShare === "number" &&
    Number.isFinite(opts.unpavedTargetShare) &&
    opts.unpavedTargetShare >= 0 &&
    opts.unpavedTargetShare <= 1
      ? opts.unpavedTargetShare
      : null;
  // Vermijd drukke N-wegen (taak #462): een VOORKEUR, geen harde poort. De
  // motor krijgt de straf al mee (req.avoidBusyRoads → custom model); hier
  // rangschikken we bovendien echte kandidaten op hun GEMETEN N-weg-aandeel.
  // Zonder meting (ORS) telt dit eerlijk niet mee — nooit gokken.
  const avoidBusyRoads = req.avoidBusyRoads === true;
  // A stated flat/hilly wish needs a wider pool of real candidates to choose the
  // best-matching one — in hilly terrain the genuinely flat loops only appear in
  // later seeds, so too small a sample silently returns a hillier route. A
  // neutral request stays cheap at 3 ORS calls. The early-exit below still stops
  // as soon as a clean, on-distance, on-elevation loop appears, so the extra
  // ceiling only costs more calls when a good match is actually hard to find.
  // A scenery wish (natuur / weinig verkeerslichten) also needs a real pool to
  // compare, so it raises the ceiling and disables the early exit.
  const defaultCandidates =
    preference !== "any" ||
    wantsScenery ||
    preferUninterrupted ||
    targetAscentM != null ||
    unpavedTargetShare != null ||
    avoidBusyRoads
      ? 8
      : wantsCalmRoads
        ? 4 // vaste rustige-wegen-vergelijking: echte keuze nodig, maar betaalbaar
        : 3;
  const n = Math.min(Math.max(opts?.candidates ?? defaultCandidates, 1), 10);
  const target = req.distanceKm;
  const pool: { result: RouteResult; score: number }[] = [];
  let lastErr: unknown = null;

  const _loopT0 = performance.now();
  // Haal en beoordeel één echte kandidaat (index i bepaalt de seed). Retourneert
  // de kandidaat of null bij een providerfout. Gedeeld door de basisronde én de
  // racefiets-verlengingsronde hieronder.
  const addCandidate = async (
    i: number,
  ): Promise<{ result: RouteResult; score: number } | null> => {
    // Distinct, deterministic-when-seeded variants: a large prime step keeps the
    // ORS round-trip seeds well separated so candidates differ meaningfully.
    const seed =
      req.seed != null
        ? (req.seed + i * 7919) % 1_000_000
        : Math.floor(Math.random() * 1e6);
    let result: RouteResult;
    const _candT0 = performance.now();
    try {
      result = await provider.generateLoop({ ...req, seed });
    } catch (err) {
      lastErr = err;
      console.log(`[PERF] loop.candidate[${i}] FAILED ms=${Math.round(performance.now()-_candT0)}`);
      return null;
    }
    console.log(`[PERF] loop.candidate[${i}] ok distKm=${result.distanceKm?.toFixed(1)} ms=${Math.round(performance.now()-_candT0)}`);
    const overlap = pathOverlapFraction(result.path);
    // Distance drift matters strongly: a "clean" loop that is 50% too long is a
    // worse answer than a slightly-repetitive one at the requested length.
    const drift =
      target > 0 && result.distanceKm != null
        ? Math.abs(result.distanceKm - target) / target
        : 0;
    const elevation = elevationPenalty(result, preference);
    // For interval trainings turn-poor stretches matter: weigh the candidate's
    // real turn density in, so the selected loop interrupts blocks the least.
    const turniness = preferUninterrupted ? turnDensityPenalty(result) : 0;
    // Overlap, distance and elevation-match all weigh in; distance now carries
    // real weight so the requested length is honoured, and elevation match is
    // decisive when the rider asked for flat/hilly.
    // Hoogtemeter-doel: afstand tussen de ECHT gemeten stijging van deze
    // kandidaat en het doel, genormaliseerd. Kandidaten zonder leesbare
    // hoogtedata krijgen geen bonus of straf (nooit gegokt).
    let ascentMiss = 0;
    if (targetAscentM != null) {
      const ascent = trackAscentM(result);
      if (ascent != null) {
        ascentMiss = Math.min(
          Math.abs(ascent - targetAscentM) / Math.max(targetAscentM, 100),
          1.5,
        );
      }
    }
    // Racefiets (cycling-road): acceptatiegrens René (PO-01, doctrine art. 10)
    // is NUL aantoonbaar onverhard — niet "zo min mogelijk". Elke gemeten
    // onverharde meter geeft daarom meteen een straf die vrijwel elke andere
    // kwaliteitsafweging verslaat (basisstraf + oplopend), zodat een schone
    // kandidaat praktisch altijd wint. Zonder meting (ORS, te veel onbekend
    // wegdek) telt dit niet mee: nooit gokken, alleen echte data rangschikken.
    const unpavedShare =
      req.profile === "cycling-road" && result.pavedFraction != null
        ? 1 - result.pavedFraction
        : 0;
    const surfacePenalty =
      unpavedShare > 0 ? 3 + Math.min(unpavedShare / 0.05, 1) * 3 : 0;
    // "Bij twijfel vermijden" (hertest Hengelo): een racefietskandidaat met
    // veel wegvakken zonder wegdek-tag is een gok. Weeg het ONBEKENDE aandeel
    // mee (lichter dan aantoonbaar onverhard) zodat een gemeten-verharde lus
    // wint van een grotendeels ongetagde lus. Nooit gokken: zonder
    // surface-details (ORS) telt dit simpelweg niet mee.
    const unknownMiss =
      req.profile === "cycling-road" && result.surfaceKnownFraction != null
        ? 1 - result.surfaceKnownFraction
        : 0;
    // Afkeurregel taak #487 (aanscherping René 30-07-2026): op de racefiets
    // is onbekend wegdek géén zachte tolerantie meer. Eerst wordt een
    // alternatief ZONDER onbekend wegdek gezocht: een gemeten kandidaat met
    // ook maar één onbekend vak krijgt een vaste straf die vrijwel elke
    // kwaliteitsafweging verslaat, zodat een volledig-geverifieerde kandidaat
    // praktisch altijd wint. Zonder meting telt dit niet mee (nooit gokken).
    const unknownGate = roadUnknownGatePenalty(
      req.profile,
      result.surfaceKnownFraction ?? null,
    );
    // Onverhard-voorkeur (gravel/MTB, taak #440): afstand tussen het GEMETEN
    // onverhard-aandeel van deze kandidaat en de gewenste voorkeur. Alleen
    // rangschikken van echte metingen — zonder wegdekdata telt dit niet mee
    // (nooit gokken) en een exact aandeel wordt nooit gegarandeerd.
    let unpavedMiss = 0;
    if (unpavedTargetShare != null && result.pavedFraction != null) {
      unpavedMiss = Math.min(
        Math.abs(1 - result.pavedFraction - unpavedTargetShare) / 0.5,
        1.5,
      );
    }
    // N-wegen-voorkeur: straf naar rato van het GEMETEN aandeel primary/
    // secondary. Genormaliseerd op 15% — daarboven telt de volle straf. Een
    // voorkeur die zwaar meeweegt, maar nooit een kandidaat hard afkeurt.
    const busyPenalty =
      avoidBusyRoads && result.busyRoadFraction != null
        ? Math.min(result.busyRoadFraction / 0.15, 1.5) * 2.0
        : 0;
    const score =
      overlap + drift * 1.2 + elevation * 0.8 + turniness * 0.9 +
      // unknownMiss LICHTER dan surfacePenalty: aantoonbaar onverhard is
      // altijd erger dan onbekend (anders wint een gemeten-gravel-lus van een
      // grotendeels ongetagde maar waarschijnlijk-asfalt-lus). Wel zwaarder
      // dan andere kwaliteitswensen: onbekend wegdek is een risico, geen
      // vrijbrief (acceptatiegrens PO-01 §3).
      ascentMiss * 1.0 + surfacePenalty + unknownGate + unknownMiss * 2.0 +
      unpavedMiss * 1.0 + busyPenalty;
    const cand = { result, score };
    pool.push(cand);
    return cand;
  };

  // Is deze kandidaat volgens de routebron zelf volledig verhard (of zonder
  // meting)? Grens René: 0% aantoonbaar onverhard op de racefiets.
  const fullyPavedOrUnmeasured = (result: RouteResult): boolean =>
    result.pavedFraction == null || result.pavedFraction >= 0.999;

  for (let i = 0; i < n; i++) {
    const cand = await addCandidate(i);
    if (!cand) continue;
    const { result } = cand;
    const overlap = pathOverlapFraction(result.path);
    const drift =
      target > 0 && result.distanceKm != null
        ? Math.abs(result.distanceKm - target) / target
        : 0;
    const elevation = elevationPenalty(result, preference);
    // Good enough — a clean loop, close to the requested length, that already
    // matches the elevation wish. Only then do we stop spending ORS calls.
    // With a scenery wish we keep collecting: the environment comparison needs
    // multiple real candidates to have anything to choose between. A turn-poor
    // wish also needs a real pool to compare, so it disables the early exit.
    if (
      !wantsScenery &&
      !wantsCalmRoads &&
      !preferUninterrupted &&
      targetAscentM == null &&
      // Onverhard-voorkeur: er valt pas iets te kiezen met meerdere echte
      // kandidaten, dus geen vroege stop zolang de voorkeur actief is.
      unpavedTargetShare == null &&
      // N-wegen vermijden: pas kiezen met meerdere echte kandidaten.
      !avoidBusyRoads &&
      overlap < 0.08 &&
      drift < 0.15 &&
      elevation < 0.35 &&
      // Racefiets: pas vroeg stoppen als de lus volgens de routebron zelf
      // VOLLEDIG verhard is (acceptatiegrens: 0% aantoonbaar onverhard) én
      // het wegdek VOLLEDIG bekend is (taak #487: onbekend wegdek is geen
      // zachte tolerantie — eerst een alternatief zonder onbekend zoeken);
      // zonder meting blijft de oude regel.
      (req.profile !== "cycling-road" ||
        result.pavedFraction == null ||
        (result.pavedFraction >= 0.999 &&
          (result.surfaceKnownFraction == null ||
            result.surfaceKnownFraction >= 0.999)))
    )
      break;
  }

  // Racefiets-verlenging (acceptatiegrens René, PO-01 30-07-2026, taak #436):
  // als na de basisronde ÉLKE kandidaat volgens de routebron zelf aantoonbaar
  // onverharde meters bevat, is de beste-van-slechte nog steeds een afkeur.
  // Blijf dan extra ECHTE kandidaten vragen (tot het bestaande plafond van 10)
  // tot er één volledig verhard is. Kost alleen extra provider-calls wanneer
  // het netwerk het echt moeilijk maakt; nooit geometrie verzinnen.
  if (req.profile === "cycling-road" && pool.length > 0) {
    // Taak #487: dezelfde verlenging geldt voor onbekend wegdek — zolang er
    // geen kandidaat is die (indien gemeten) volledig verhard ÉN volledig
    // bekend is, blijven we echte extra kandidaten vragen. Nooit geometrie
    // verzinnen; lukt het niet, dan blijft de beste over en beslist de
    // renner expliciet in de UI.
    const fullyVerifiedOrUnmeasured = (result: RouteResult): boolean =>
      fullyPavedOrUnmeasured(result) &&
      (result.surfaceKnownFraction == null ||
        result.surfaceKnownFraction >= 0.999);
    let extra = n;
    while (
      extra < 10 &&
      !pool.some((c) => fullyVerifiedOrUnmeasured(c.result))
    ) {
      await addCandidate(extra);
      extra++;
    }
  }

  if (pool.length === 0) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error("ORS leverde geen bruikbare route op");
  }

  pool.sort((a, b) => a.score - b.score);

  // Officiële-kaart-controlelaag (racefiets, BGT NL / GRB Vlaanderen): leg de beste kandidaten
  // way-voor-way naast de officiële overheidswegenkaart. Een kandidaat die
  // daar half verhard/onverhard blijkt, verliest — zelfde gewicht als de
  // provider-wegdekpoort (>5% is een echte misser). Zonder oordeel (null)
  // verandert er niets: nooit gokken, alleen echte data rangschikken.
  if (
    req.profile === "cycling-road" &&
    opts?.unpavedShareOf != null &&
    pool.length > 1
  ) {
    const top = pool.slice(0, 3);
    const shares = await Promise.all(
      top.map((c) => opts.unpavedShareOf!(c.result.path).catch(() => null)),
    );
    let adjusted = false;
    for (let i = 0; i < top.length; i++) {
      const share = shares[i];
      if (share == null || share <= 0) continue;
      top[i]!.score += Math.min(share / 0.05, 1.5) * 1.2;
      adjusted = true;
    }
    if (adjusted) pool.sort((a, b) => a.score - b.score);
  }

  // Obstakel-poort (fietsprofielen): trap / fietsverbod / afgesloten poort is
  // een harde afkeur (+1000 — zo'n kandidaat wint alleen als ÁLLE kandidaten
  // dit gebrek hebben; de routeopmerkingen blijven het dan eerlijk melden).
  // Racefiets (cycling-road): aantoonbaar onverharde/ruwe vakken zijn
  // EVENEENS een harde afkeur (+1000) — acceptatiegrens René PO-01 §5.2,
  // taak #437. Overige poorten/hekken tellen licht mee zodat de kandidaat
  // met de minste obstakels wint. Alleen echte metingen; een mislukte meting
  // weegt niet mee (nooit gokken).
  //
  // Obstakel-resultaten worden gecached (obstaclesMeasured) zodat de harde
  // afkeurpoort hieronder ze opnieuw kan gebruiken zonder extra Overpass-call.
  const obstaclesMeasured = new Map<
    RouteResult,
    { steps: number; forbidden: number; blockedGates: number; gates: number; unpavedSegments: number } | null
  >();
  // MTB-regressie (René, 30-07-2026): de obstakelpoort gold alleen voor
  // cycling-road/cycling-regular; een MTB-route met fietsverbod, privéterrein
  // en afgesloten poorten werd daardoor nooit gemeten en toch als "KLAAR"
  // aangeboden. Verbod/trap/afgesloten poort geldt nu voor ÁLLE fietsprofielen;
  // alleen de onverhard-grens blijft racefiets/gewone fiets.
  const unpavedIsHard =
    req.profile === "cycling-road" || req.profile === "cycling-regular";
  // De obstakelmeting is fiets-specifiek (fietsverbod, trap, afgesloten
  // poort); voor een eventueel niet-fietsprofiel zou dezelfde poort ten
  // onrechte afkeuren (een trap is geen blokkade voor een wandelaar).
  const isCyclingProfile = req.profile.startsWith("cycling-");
  if (isCyclingProfile && opts?.obstaclesOf != null && pool.length > 1) {
    const measured = new Set<(typeof pool)[number]>();
    const applyPenalties = async (cands: typeof pool) => {
      const fresh = cands.filter((c) => !measured.has(c));
      if (fresh.length === 0) return false;
      const obstacles = await Promise.all(
        fresh.map((c) => opts.obstaclesOf!(c.result.path).catch(() => null)),
      );
      let adjusted = false;
      for (let i = 0; i < fresh.length; i++) {
        measured.add(fresh[i]!);
        const o = obstacles[i];
        // Cache opslaan ook bij null (meting mislukt = eerlijk niet gewogen).
        obstaclesMeasured.set(fresh[i]!.result, o ?? null);
        if (o == null) continue;
        let penalty = 0;
        if (o.steps > 0) penalty += 1000;
        if (o.forbidden > 0) penalty += 1000;
        if (o.blockedGates > 0) penalty += 1000;
        // Racefiets én gewone fiets (cycling-regular, taak #441): onverhard/
        // ruw in de remarkslaag is gelijkwaardig aan een verbod —
        // acceptatiegrens is NUL aantoonbaar onverhard (PO-01 §5.2).
        if (unpavedIsHard && o.unpavedSegments > 0) penalty += 1000;
        penalty += Math.min(o.gates, 10) * 0.15;
        if (penalty > 0) {
          fresh[i]!.score += penalty;
          adjusted = true;
        }
      }
      return adjusted;
    };
    if (await applyPenalties(pool.slice(0, 3))) {
      pool.sort((a, b) => a.score - b.score);
      // Schuift een ongemeten kandidaat door de straffen naar de kop, meet
      // die dan alsnog (max 2 extra rondes) — anders zou een niet-gemeten
      // trap-kandidaat alsnog stil kunnen winnen.
      for (let round = 0; round < 2 && !measured.has(pool[0]!); round++) {
        if (await applyPenalties([pool[0]!])) {
          pool.sort((a, b) => a.score - b.score);
        }
      }
    }
  }

  // ── Harde afkeurpoort na selectie (PO-01 §5.2, taak #437; fail-closed
  // sinds taak #505) ────────────────────────────────────────────────────────
  // Hulpfunctie: controleer een kandidaat op harde grenzen. Gebruikt de
  // gecachede meting als die beschikbaar én geslaagd is; anders een verse
  // meting — bij voorkeur de BLOKKERENDE `verifyObstaclesOf` (geen tijdbudget,
  // taak #505: het oude 2500 ms-budget liet 11/12 lussen met blokkades door
  // omdat Overpass 14–98 s kan duren en de timeout fail-open was).
  // Gooit NoSuitableRouteError bij een harde grens; gooit
  // UnverifiableRouteError wanneer óók de blokkerende meting geen antwoord
  // gaf (alle mirrors kapot) — zo'n kandidaat wordt nooit stil als veilig
  // behandeld of geleverd.
  const hardRejectIfNeeded = async (winner: RouteResult): Promise<void> => {
    if (opts?.obstaclesOf == null && opts?.verifyObstaclesOf == null) return;
    const verifier = opts?.verifyObstaclesOf ?? opts?.obstaclesOf;
    const cached = obstaclesMeasured.get(winner);
    // Gecachede null = eerder mislukt/te traag binnen budget ⇒ opnieuw meten,
    // nu blokkerend. Alleen een echte, geslaagde meting telt.
    let obs =
      cached != null ? cached : await verifier!(winner.path).catch(() => null);
    if (obs != null) obstaclesMeasured.set(winner, obs);
    if (obs == null) {
      if (opts?.verifyObstaclesOf != null) {
        // Fail-closed: zonder geslaagde meting is de kandidaat niet
        // verifieerbaar en wordt hij nooit geleverd.
        throw new UnverifiableRouteError(req.profile);
      }
      return; // legacy-pad zonder blokkerende verifier (bv. tests): oude gedrag
    }
    const _t_gate = performance.now();
    // Harde blokkades gelden voor ÁLLE fietsprofielen (René, 30-07-2026):
    // fietsverbod, trap én afgesloten poort/privéterrein. blockedGates zat
    // eerder alleen in de +1000-scorestraf en ontbrak hier — precies het gat
    // waardoor een MTB-route met afgesloten poorten toch "KLAAR" werd.
    const hasForbidden =
      obs.forbidden > 0 || obs.steps > 0 || obs.blockedGates > 0;
    // Onverhard=0-grens geldt voor racefiets (taak #437) ÉN gewone fiets
    // (cycling-regular, taak #441) — René: 0% onverhard is voor beide van
    // belang. Gravel/MTB mogen wél onverhard rijden.
    const hasUnpaved = unpavedIsHard && obs.unpavedSegments > 0;
    console.log(
      `[PERF] hardRejectGate ms=${Math.round(performance.now() - _t_gate)} ` +
        `profile=${req.profile} forbidden=${obs.forbidden} steps=${obs.steps} ` +
        `blockedGates=${obs.blockedGates} unpaved=${obs.unpavedSegments} ` +
        `hasForbidden=${hasForbidden} hasUnpaved=${hasUnpaved}`,
    );
    if (hasForbidden || hasUnpaved) {
      throw new NoSuitableRouteError(
        req.profile,
        // Gebruikerstaal (WP-1): de exacte tellers staan al in de PERF-log
        // hierboven — de renner krijgt een begrijpelijke reden.
        hasForbidden
          ? "elke gevonden kandidaat bevat een fietsverbod, trap of afgesloten poort"
          : `de gevonden wegen bevatten aantoonbaar onverhard wegdek (${obs.unpavedSegments} stuk${obs.unpavedSegments > 1 ? "ken" : ""})`,
      );
    }
  };

  // Meerdere voorstellen: kies uit de interne pool extra kandidaten die écht
  // anders lopen dan de winnaar (en elkaar). Alleen kandidaten zonder harde
  // straf (trap/verbod/onverhard = +1000), zelf een schone lus, en — voor de
  // racefiets — volledig verhard volgens de routebron. Elk voorstel gaat door
  // dezelfde harde afkeurpoort als de winnaar; valt hij daar, dan wordt hij
  // stil overgeslagen (nooit een foute route aanbieden).
  const collectAlternates = async (winner: RouteResult): Promise<void> => {
    const out = opts?.alternatesOut;
    if (!out) return;
    const max = Math.max(0, Math.min(opts?.alternatesMax ?? 2, 4));
    for (const c of pool) {
      if (out.length >= max) break;
      if (c.result === winner) continue;
      if (c.score >= 500) continue; // hard bestraft — nooit aanbieden
      if (req.profile === "cycling-road" && !fullyPavedOrUnmeasured(c.result))
        continue;
      if (pathOverlapFraction(c.result.path) > 0.2) continue; // dubbelspoor-lus
      if (pathSharedFraction(c.result.path, winner.path) > 0.6) continue;
      if (out.some((r) => pathSharedFraction(c.result.path, r.path) > 0.6))
        continue;
      try {
        await hardRejectIfNeeded(c.result);
      } catch {
        continue; // harde grens geraakt — eerlijk overslaan
      }
      out.push(c.result);
    }
  };

  // ── Fail-closed winnaarkeuze (taak #505) ─────────────────────────────────
  // Probeer kandidaten in voorkeursvolgorde; iedere kandidaat wordt vóór
  // levering volledig geverifieerd. Hard geblokkeerd ⇒ eerlijk loggen en de
  // volgende ECHTE kandidaat proberen; pas als álle kandidaten hard
  // geblokkeerd zijn faalt de generatie eerlijk (NoSuitableRouteError).
  // Niet-verifieerbaar (meting definitief mislukt) ⇒ direct
  // UnverifiableRouteError — dan is geen enkele kandidaat controleerbaar en
  // mag er niets geleverd worden.
  const pickVerifiedWinner = async (
    ordered: RouteResult[],
  ): Promise<RouteResult> => {
    opts?.onPhase?.("veiligheidscontrole");
    let lastHard: NoSuitableRouteError | null = null;
    for (const cand of ordered) {
      try {
        await hardRejectIfNeeded(cand);
        return cand;
      } catch (err) {
        if (err instanceof NoSuitableRouteError) {
          lastHard = err;
          console.log(
            `[loop-quality] kandidaat hard geblokkeerd — volgende proberen: ${err.reason}`,
          );
          continue;
        }
        throw err; // UnverifiableRouteError of onverwachte fout
      }
    }
    throw (
      lastHard ??
      new NoSuitableRouteError(req.profile, "geen verifieerbare kandidaat")
    );
  };

  if (wantsCalmRoads && pool.length > 1) {
    // Compare the best few candidates on real map facts. Environment lookups
    // are the expensive part (Overpass), so cap at 4 and run them in parallel.
    // When a lookup fails the candidate simply keeps its base score — we never
    // guess what the map would have said.
    const top = pool.slice(0, 4);
    const envs = await Promise.all(
      top.map((c) =>
        opts!.environmentOf!(c.result.path).catch(() => null),
      ),
    );
    let best = top[0]!;
    let bestTotal = Number.POSITIVE_INFINITY;
    for (let i = 0; i < top.length; i++) {
      const c = top[i]!;
      const env = envs[i];
      let envPenalty = 0;
      if (env) {
        if (scenery?.nature && env.forestSharePct != null) {
          envPenalty += (1 - env.forestSharePct / 100) * 0.9;
        }
        // Vaste eis: stoplichten en andere wegobstakels wegen ALTIJD mee.
        // Eigen wegobjecten-database (lichten + overwegen + rotondes +
        // drempels) heeft voorrang; anders het kale lichten-aantal.
        const obstacles = env.stopObstacles ?? env.trafficLights;
        if (obstacles != null) {
          const km = c.result.distanceKm ?? target;
          const perKm = km > 0 ? obstacles / km : obstacles;
          envPenalty += Math.min(perKm / 1.5, 1) * 0.9;
        }
        // Vaste eis: zo min mogelijk door dorpskernen/woonwijken — het
        // gemeten bebouwingsaandeel weegt altijd mee.
        if (env.builtUpSharePct != null) {
          envPenalty += (env.builtUpSharePct / 100) * 0.8;
        }
      }
      const total = c.score + envPenalty;
      if (total < bestTotal) {
        bestTotal = total;
        best = c;
      }
    }
    // Fail-closed (taak #505): de omgevings-beste eerst, daarna de rest van de
    // pool op score — hard geblokkeerd schuift eerlijk door naar de volgende.
    const orderedCalm = [
      best.result,
      ...pool.filter((c) => c !== best).map((c) => c.result),
    ];
    const calmWinner = await pickVerifiedWinner(orderedCalm);
    await collectAlternates(calmWinner);
    return calmWinner;
  }

  const winner = await pickVerifiedWinner(pool.map((c) => c.result));
  await collectAlternates(winner);
  return winner;
}

/**
 * Fail-closed verificatiefout (taak #505): de obstakelmeting van de winnaar
 * gaf óók blokkerend geen antwoord (alle Overpass-mirrors kapot). Zo'n route
 * is niet controleerbaar op fietsverbod/trap/afgesloten poort en wordt daarom
 * NOOIT geleverd, opgeslagen of als "KLAAR" getoond — de gebruiker krijgt een
 * eerlijke melding in plaats van een stil-onveilige route.
 */
export class UnverifiableRouteError extends Error {
  readonly profile: string;
  constructor(profile: string) {
    super(
      "De route kon niet gecontroleerd worden op blokkades (de kaartbron gaf geen antwoord). " +
        "We bieden een ongecontroleerde route niet aan — probeer het over een paar minuten opnieuw.",
    );
    this.name = "UnverifiableRouteError";
    this.profile = profile;
  }
}

/**
 * Harde afkeurpoort (PO-01 §5.2, taak #437): de motor heeft na alle
 * selectiepassen geen kandidaat gevonden die vrij is van aantoonbaar
 * onverhard wegdek (racefiets) of een zéker fietsverbod/trap. De renner
 * krijgt een eerlijke "geen geschikte route" melding — nooit een foute route.
 */
// Gebruikerstaal (WP-1): profielcodes zoals "cycling-regular" zijn intern —
// de renner ziet de fietsnaam.
const PROFILE_LABELS_NL: Record<string, string> = {
  "cycling-road": "de racefiets",
  "cycling-gravel": "de gravelbike",
  "cycling-mountain": "de mountainbike",
  "cycling-regular": "de gewone fiets",
};

export class NoSuitableRouteError extends Error {
  readonly profile: string;
  readonly reason: string;
  constructor(profile: string, reason: string) {
    super(
      `Geen geschikte route gevonden voor ${PROFILE_LABELS_NL[profile] ?? profile}: ${reason}. ` +
        "Probeer een ander startpunt, een kortere afstand of versoepel je voorkeuren.",
    );
    this.name = "NoSuitableRouteError";
    this.profile = profile;
    this.reason = reason;
  }
}
