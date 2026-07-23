// Route-matching + afwijkingsdetectie — pure, deterministische engine.
//
// GESPIEGELD BESTAND: artifacts/sparki/src/lib/route-match.ts moet
// byte-identiek blijven (de test controleert dit). Wijzig beide samen.
//
// Waarom dit bestaat: de navigatie matchte de GPS-positie alleen op LOSSE
// routepunten met een vaste 60 m-grens en één meting was genoeg voor
// "Je wijkt af van de route". Bij routepunten die verder uit elkaar liggen
// (bochten, lange rechte stukken) lag het dichtstbijzijnde PUNT al snel
// >60 m weg terwijl de renner exact op het routeSEGMENT reed → valse
// meldingen. Deze engine:
//   1. matcht op het dichtstbijzijnde routesegment (projectie), niet op punten;
//   2. gebruikt een dynamische corridor (GPS-nauwkeurigheid + snelheid);
//   3. eist meerdere opeenvolgende metingen én een minimale duur;
//   4. negeert één onmogelijke GPS-sprong;
//   5. onderdrukt herhaalmeldingen per afwijkingsepisode;
//   6. herstelt automatisch zodra de renner weer op de route matcht.
// Kaart, voortgang en afwijking gebruiken dezelfde gematchte positie.

export type MatchLatLon = { lat: number; lon: number };

const EARTH_R = 6371000;

export function haversineMeters(a: MatchLatLon, b: MatchLatLon): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Lokale meter-projectie (equirectangulair) rond een referentiepunt — ruim
// voldoende nauwkeurig op segmentlengtes van honderden meters.
function toXY(ref: MatchLatLon, p: MatchLatLon): { x: number; y: number } {
  const x =
    ((p.lon - ref.lon) * Math.PI * EARTH_R * Math.cos((ref.lat * Math.PI) / 180)) /
    180;
  const y = ((p.lat - ref.lat) * Math.PI * EARTH_R) / 180;
  return { x, y };
}

export type RouteMatch = {
  // Segment [segIndex, segIndex+1] waar de positie op geprojecteerd is.
  segIndex: number;
  // Fractie (0..1) langs dat segment.
  t: number;
  // Loodrechte afstand tot het segment in meters.
  distanceM: number;
  // Afgelegde afstand langs de route (km) op het gematchte punt.
  alongKm: number;
  // De map-matched positie zelf.
  matched: MatchLatLon;
};

function projectOnSegment(
  a: MatchLatLon,
  b: MatchLatLon,
  p: MatchLatLon,
): { t: number; distanceM: number; matched: MatchLatLon } {
  const A = toXY(a, a);
  const B = toXY(a, b);
  const P = toXY(a, p);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 <= 0 ? 0 : Math.max(0, Math.min(1, (P.x * dx + P.y * dy) / len2));
  const mx = A.x + t * dx;
  const my = A.y + t * dy;
  const ddx = P.x - mx;
  const ddy = P.y - my;
  const distanceM = Math.sqrt(ddx * ddx + ddy * ddy);
  const matched: MatchLatLon = {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
  };
  return { t, distanceM, matched };
}

// Zoekvenster rond de vorige match (segmentindexen). Buiten dit venster wordt
// alleen gezocht als het venster niets bruikbaars oplevert — zo blijft de
// match voortgangsvast (geen terugspringen naar een parallel stuk verderop).
const WINDOW_BACK = 30;
const WINDOW_FWD = 90;
const WINDOW_ESCAPE_M = 300;

/**
 * Match een GPS-positie op het dichtstbijzijnde ROUTESEGMENT.
 * `cumKm` is de cumulatieve afstand (km) per routepunt (zelfde lengte als
 * `path`). `hintSegIndex` is de segmentindex van de vorige match (of null).
 */
export function matchToRoute(
  path: MatchLatLon[],
  cumKm: number[],
  loc: MatchLatLon,
  hintSegIndex: number | null,
): RouteMatch | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    const d = haversineMeters(path[0]!, loc);
    return { segIndex: 0, t: 0, distanceM: d, alongKm: cumKm[0] ?? 0, matched: path[0]! };
  }
  const lastSeg = path.length - 2;
  const scan = (from: number, to: number): RouteMatch | null => {
    let best: RouteMatch | null = null;
    const lo = Math.max(0, from);
    const hi = Math.min(lastSeg, to);
    for (let i = lo; i <= hi; i++) {
      const pr = projectOnSegment(path[i]!, path[i + 1]!, loc);
      if (!best || pr.distanceM < best.distanceM) {
        const segStartKm = cumKm[i] ?? 0;
        const segEndKm = cumKm[i + 1] ?? segStartKm;
        best = {
          segIndex: i,
          t: pr.t,
          distanceM: pr.distanceM,
          alongKm: segStartKm + (segEndKm - segStartKm) * pr.t,
          matched: pr.matched,
        };
      }
    }
    return best;
  };
  if (hintSegIndex != null && Number.isFinite(hintSegIndex)) {
    const windowed = scan(hintSegIndex - WINDOW_BACK, hintSegIndex + WINDOW_FWD);
    if (windowed && windowed.distanceM <= WINDOW_ESCAPE_M) return windowed;
  }
  return scan(0, lastSeg);
}

/**
 * Eén positiebron voor kaart, voortgang én afwijking: zolang de renner
 * binnen de corridor op de route gematcht is, toont de kaart de gematchte
 * positie (op de lijn). Bij (mogelijke) afwijking toont de kaart eerlijk de
 * ruwe GPS-positie — nooit een verzonnen plek op de route.
 */
export function displayPosition(
  raw: MatchLatLon,
  match: RouteMatch | null,
  offRouteActive: boolean,
  corridorM: number,
): MatchLatLon {
  if (!match || offRouteActive) return raw;
  if (match.distanceM > corridorM) return raw;
  return match.matched;
}

// ── Afwijkingsdetectie (state machine) ─────────────────────────────

// Corridorbreedte: basis + GPS-nauwkeurigheid + snelheid. Nooit een extreem
// kleine vaste grens; nooit onbegrensd groot.
export function corridorMeters(
  accuracyM: number | null,
  speedMps: number | null,
): number {
  const acc =
    accuracyM != null && Number.isFinite(accuracyM) && accuracyM > 0
      ? Math.min(accuracyM, 50)
      : 15;
  const spd =
    speedMps != null && Number.isFinite(speedMps) && speedMps > 0
      ? Math.min(speedMps, 20)
      : 5;
  return Math.min(150, Math.max(50, 30 + 2 * acc + 1.5 * spd));
}

// Zoveel opeenvolgende metingen buiten de corridor zijn minimaal nodig …
const MIN_BAD_READINGS = 3;
// … en de situatie moet minimaal zo lang duren (ms) …
const MIN_BAD_DURATION_MS = 6000;
// … en pas boven deze factor × corridor telt "duidelijk buiten".
const ENTER_FACTOR = 1.0;
// Terug-op-route zodra binnen deze factor × corridor gematcht wordt.
const EXIT_FACTOR = 0.8;
// Eén GPS-sprong: onmogelijke verplaatsingssnelheid t.o.v. de vorige
// geaccepteerde meting → meting negeren (35 m/s ≈ 126 km/h).
const JUMP_SPEED_MPS = 35;
// Voortgangscontrole: wie ondertussen logisch verder rijdt langs de route
// (≥ dit aantal meters vooruit) en niet ver buiten de corridor zit, wijkt
// niet echt af (parallel fietspad, scherpe bocht, brede weg).
const PROGRESS_GUARD_M = 20;
const PROGRESS_GUARD_FACTOR = 1.6;

export type OffRouteState = {
  active: boolean;
  episode: number;
  badCount: number;
  badSinceMs: number | null;
  badStartAlongKm: number | null;
  lastFix: { lat: number; lon: number; tMs: number } | null;
  pendingJump: { lat: number; lon: number; tMs: number } | null;
};

export function createOffRouteState(): OffRouteState {
  return {
    active: false,
    episode: 0,
    badCount: 0,
    badSinceMs: null,
    badStartAlongKm: null,
    lastFix: null,
    pendingJump: null,
  };
}

export type OffRouteInput = {
  lat: number;
  lon: number;
  timestampMs: number;
  distanceM: number;
  alongKm: number;
  accuracyM: number | null;
  speedMps: number | null;
};

export type OffRouteUpdate = {
  state: OffRouteState;
  // "enter" precies één keer per echte afwijkingsepisode; "exit" bij
  // automatisch herstel; null = geen statuswissel (dus ook geen melding).
  event: "enter" | "exit" | null;
  // Werd deze meting als GPS-sprong genegeerd?
  ignored: boolean;
};

export function updateOffRoute(
  state: OffRouteState,
  input: OffRouteInput,
): OffRouteUpdate {
  const next: OffRouteState = { ...state };
  const here = { lat: input.lat, lon: input.lon, tMs: input.timestampMs };

  // 1) GPS-sprongfilter: één onmogelijke sprong t.o.v. de vorige geaccepteerde
  // meting wordt genegeerd. Bevestigt de vólgende meting de nieuwe plek
  // (dicht bij de sprong), dan is het een echte verplaatsing en telt die wél.
  if (state.lastFix) {
    const dtS = Math.max(0.3, (input.timestampMs - state.lastFix.tMs) / 1000);
    const jumpM = haversineMeters(state.lastFix, here);
    if (jumpM / dtS > JUMP_SPEED_MPS) {
      if (
        state.pendingJump &&
        haversineMeters(state.pendingJump, here) / dtS <= JUMP_SPEED_MPS
      ) {
        // Tweede meting bevestigt de nieuwe plek → gewoon doorgaan.
        next.pendingJump = null;
      } else {
        next.pendingJump = here;
        return { state: next, event: null, ignored: true };
      }
    } else {
      next.pendingJump = null;
    }
  }
  next.lastFix = here;

  const corridor = corridorMeters(input.accuracyM, input.speedMps);

  // 2) Binnen de corridor (met hysterese bij actief) → op de route.
  const within = state.active
    ? input.distanceM <= corridor * EXIT_FACTOR
    : input.distanceM <= corridor * ENTER_FACTOR;
  if (within) {
    next.badCount = 0;
    next.badSinceMs = null;
    next.badStartAlongKm = null;
    if (state.active) {
      next.active = false;
      return { state: next, event: "exit", ignored: false };
    }
    return { state: next, event: null, ignored: false };
  }

  // 3) Buiten de corridor: tellen, maar pas actief na genoeg opeenvolgende
  // metingen, genoeg duur én zonder logische voortgang langs de route.
  next.badCount = state.badCount + 1;
  next.badSinceMs = state.badSinceMs ?? input.timestampMs;
  next.badStartAlongKm = state.badStartAlongKm ?? input.alongKm;

  if (next.active) return { state: next, event: null, ignored: false };

  const longEnough =
    input.timestampMs - (next.badSinceMs ?? input.timestampMs) >=
    MIN_BAD_DURATION_MS;
  const enoughReadings = next.badCount >= MIN_BAD_READINGS;
  const progressedM =
    (input.alongKm - (next.badStartAlongKm ?? input.alongKm)) * 1000;
  const ridingAlong =
    progressedM >= PROGRESS_GUARD_M &&
    input.distanceM <= corridor * PROGRESS_GUARD_FACTOR;

  if (enoughReadings && longEnough && !ridingAlong) {
    next.active = true;
    next.episode = state.episode + 1;
    return { state: next, event: "enter", ignored: false };
  }
  return { state: next, event: null, ignored: false };
}
