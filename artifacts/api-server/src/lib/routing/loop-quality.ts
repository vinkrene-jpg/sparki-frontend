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

// Grid cell for snapping coordinates so we can tell when a route re-uses the
// same stretch of road. ~0.0006° ≈ 55–65 m in the Netherlands — coarse enough
// to treat "there and back on the same road" as one shared edge, fine enough
// not to merge genuinely different parallel roads.
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
    targetAscentM != null
      ? 8
      : wantsCalmRoads
        ? 4 // vaste rustige-wegen-vergelijking: echte keuze nodig, maar betaalbaar
        : 3;
  const n = Math.min(Math.max(opts?.candidates ?? defaultCandidates, 1), 10);
  const target = req.distanceKm;
  const pool: { result: RouteResult; score: number }[] = [];
  let lastErr: unknown = null;

  const _loopT0 = performance.now();
  for (let i = 0; i < n; i++) {
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
      continue;
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
    const score =
      overlap + drift * 1.2 + elevation * 0.8 + turniness * 0.9 +
      ascentMiss * 1.0;
    pool.push({ result, score });
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
      overlap < 0.08 &&
      drift < 0.15 &&
      elevation < 0.35
    )
      break;
  }

  if (pool.length === 0) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error("ORS leverde geen bruikbare route op");
  }

  pool.sort((a, b) => a.score - b.score);

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
    return best.result;
  }

  return pool[0]!.result;
}
