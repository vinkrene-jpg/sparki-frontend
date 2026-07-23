// Volgauto-plananalyse — PURE functies, geen I/O. Vergelijkt de FIETSroute
// met de afzonderlijk berekende AUTOroute (ORS driving-car) en leidt daaruit
// gedeelde delen, splitsingen en aansluitpunten af. Alles is meetkunde op
// echte routegeometrie; er wordt nooit een verkeersbeperking verzonnen. Waar
// auto- en fietsroute uiteenlopen weten we alleen DAT de autorouter een andere
// weg koos — niet met zekerheid waarom. Die onzekerheid hoort de UI eerlijk te
// tonen ("Controleer lokale verkeersborden...").

import type {
  RoutePathPoint,
  VolgautoMeetpoint,
  VolgautoSegment,
} from "@workspace/db";

export function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Cumulatieve km per punt van een pad.
export function cumulativeKm(path: RoutePathPoint[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(
      out[i - 1]! +
        haversineMeters(
          path[i - 1]![0],
          path[i - 1]![1],
          path[i]![0],
          path[i]![1],
        ) /
          1000,
    );
  }
  return out;
}

// Kortste afstand (meters) van een punt tot een pad, plus de km-positie langs
// dat pad van het dichtstbijzijnde padpunt. Grof maar deterministisch:
// punt-tot-punt (paden zijn dicht bemonsterd door de provider).
export function nearestOnPath(
  lat: number,
  lon: number,
  path: RoutePathPoint[],
  pathCumKm: number[],
): { distM: number; km: number; idx: number } {
  let best = Number.POSITIVE_INFINITY;
  let bestIdx = 0;
  for (let i = 0; i < path.length; i++) {
    const d = haversineMeters(lat, lon, path[i]![0], path[i]![1]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  return { distM: best, km: pathCumKm[bestIdx] ?? 0, idx: bestIdx };
}

export type CompareOptions = {
  // Auto "deelt" een fietsroutedeel wanneer de autoroute binnen deze afstand
  // van dat deel loopt. 60 m vangt parallelle rijbaan + GPS-/snapverschil.
  sharedThresholdM?: number;
  // Korte flikkeringen (< dit aantal km) worden samengevoegd met de buren om
  // een rustig, leesbaar beeld te geven — geen tientallen minisegmenten.
  minSegmentKm?: number;
};

export type PathComparison = {
  segments: VolgautoSegment[];
  // km-posities (fietsroute) waar fietsers en auto SPLITSEN.
  splitKms: number[];
  // km-posities (fietsroute) waar de auto weer kan AANSLUITEN.
  rejoinKms: number[];
  sharedKm: number;
  separatedKm: number;
};

// Vergelijk fietsroute met autoroute → gedeelde/gescheiden segmenten langs de
// fietsroute. Beide geometrieën komen uit de routingprovider (echte wegen).
export function comparePaths(
  bike: RoutePathPoint[],
  car: RoutePathPoint[],
  opts: CompareOptions = {},
): PathComparison {
  const threshold = opts.sharedThresholdM ?? 60;
  const minSeg = opts.minSegmentKm ?? 0.25;
  if (bike.length < 2 || car.length < 2) {
    return {
      segments: [],
      splitKms: [],
      rejoinKms: [],
      sharedKm: 0,
      separatedKm: 0,
    };
  }
  const bikeCum = cumulativeKm(bike);
  const carCum = cumulativeKm(car);

  // Per fietspunt: ligt de autoroute dichtbij?
  const shared: boolean[] = bike.map((p) => {
    const near = nearestOnPath(p[0], p[1], car, carCum);
    return near.distM <= threshold;
  });

  // Ruwe segmenten bouwen.
  type Raw = { kind: "gedeeld" | "gescheiden"; startIdx: number; endIdx: number };
  const raw: Raw[] = [];
  for (let i = 0; i < shared.length; i++) {
    const kind = shared[i] ? "gedeeld" : "gescheiden";
    const last = raw[raw.length - 1];
    if (last && last.kind === kind) last.endIdx = i;
    else raw.push({ kind, startIdx: i, endIdx: i });
  }

  // Flikkeringen kleiner dan minSeg opnemen in de omliggende segmenten.
  const smoothed: Raw[] = [];
  for (const seg of raw) {
    const lenKm = bikeCum[seg.endIdx]! - bikeCum[seg.startIdx]!;
    const prev = smoothed[smoothed.length - 1];
    if (prev && (lenKm < minSeg || prev.kind === seg.kind)) {
      if (prev.kind === seg.kind || lenKm < minSeg) {
        prev.endIdx = seg.endIdx;
        continue;
      }
    }
    if (!prev && lenKm < minSeg && raw.length > 1) {
      // eerste ministukje: laat het opgaan in het volgende segment
      smoothed.push({ ...seg });
      continue;
    }
    smoothed.push({ ...seg });
  }
  // Na samensmelten kunnen buren gelijkgestemd zijn — nogmaals samenvoegen.
  const merged: Raw[] = [];
  for (const seg of smoothed) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === seg.kind) prev.endIdx = seg.endIdx;
    else merged.push({ ...seg });
  }

  const segments: VolgautoSegment[] = merged.map((s) => ({
    kind: s.kind,
    startKm: round1(bikeCum[s.startIdx]!),
    endKm: round1(bikeCum[s.endIdx]!),
  }));

  const splitKms: number[] = [];
  const rejoinKms: number[] = [];
  for (let i = 1; i < merged.length; i++) {
    const km = round1(bikeCum[merged[i]!.startIdx]!);
    if (merged[i]!.kind === "gescheiden") splitKms.push(km);
    else rejoinKms.push(km);
  }

  let sharedKm = 0;
  let separatedKm = 0;
  for (const s of segments) {
    const len = s.endKm - s.startKm;
    if (s.kind === "gedeeld") sharedKm += len;
    else separatedKm += len;
  }
  return {
    segments,
    splitKms,
    rejoinKms,
    sharedKm: round1(sharedKm),
    separatedKm: round1(separatedKm),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Echte parkeerlocatie uit OSM (Overpass) — nooit verzonnen.
export type ParkingCandidate = { lat: number; lon: number; name: string | null };

// Kies aansluitpunten: voor elk rejoin-km-punt van de fietsroute wordt bij
// voorkeur een ECHTE parkeerplaats vlakbij gekozen (veilig wachten buiten de
// rijbaan); anders eerlijk het routepunt zelf ("aansluitpunt op de route").
export function pickMeetpoints(
  bike: RoutePathPoint[],
  bikeCum: number[],
  rejoinKms: number[],
  parkings: ParkingCandidate[],
  car: RoutePathPoint[] | null,
  maxParkingDistM = 400,
): VolgautoMeetpoint[] {
  const carCum = car && car.length >= 2 ? cumulativeKm(car) : null;
  const out: VolgautoMeetpoint[] = [];
  for (const km of rejoinKms) {
    // routepunt bij deze km
    let idx = 0;
    for (let i = 0; i < bikeCum.length; i++) {
      if (bikeCum[i]! >= km) {
        idx = i;
        break;
      }
      idx = i;
    }
    const at = bike[idx]!;
    let best: ParkingCandidate | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const p of parkings) {
      const d = haversineMeters(at[0], at[1], p.lat, p.lon);
      if (d <= maxParkingDistM && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    const lat = best ? best.lat : at[0];
    const lon = best ? best.lon : at[1];
    const carKm =
      car && carCum
        ? (() => {
            const n = nearestOnPath(lat, lon, car, carCum);
            return n.distM <= 150 ? round1(n.km) : null;
          })()
        : null;
    out.push({
      lat,
      lon,
      bikeKm: km,
      carKm,
      name: best
        ? (best.name ?? "Parkeerplaats")
        : "Aansluitpunt op de route",
      source: best ? "parkeerplaats" : "route",
    });
  }
  return out;
}

// ETA-vergelijking op een aansluitpunt — een SCHATTING op basis van resterende
// afstand en gemiddelde snelheden; de UI benoemt dit als geschat.
export type EtaCompare = {
  bikeMin: number | null;
  carMin: number | null;
  verdict: "auto_eerder" | "renners_eerder" | "vergelijkbaar" | "onbekend";
  waitMin: number | null;
};

export function compareEta(input: {
  bikeRemainingKm: number | null;
  carRemainingKm: number | null;
  bikeSpeedKmh?: number | null;
  carSpeedKmh?: number | null;
}): EtaCompare {
  const bikeSpeed = input.bikeSpeedKmh && input.bikeSpeedKmh > 3 ? input.bikeSpeedKmh : 27;
  const carSpeed = input.carSpeedKmh && input.carSpeedKmh > 5 ? input.carSpeedKmh : 45;
  const bikeMin =
    input.bikeRemainingKm != null && input.bikeRemainingKm >= 0
      ? Math.round((input.bikeRemainingKm / bikeSpeed) * 60)
      : null;
  const carMin =
    input.carRemainingKm != null && input.carRemainingKm >= 0
      ? Math.round((input.carRemainingKm / carSpeed) * 60)
      : null;
  if (bikeMin == null || carMin == null) {
    return { bikeMin, carMin, verdict: "onbekend", waitMin: null };
  }
  const diff = bikeMin - carMin;
  if (Math.abs(diff) <= 2) {
    return { bikeMin, carMin, verdict: "vergelijkbaar", waitMin: 0 };
  }
  return diff > 0
    ? { bikeMin, carMin, verdict: "auto_eerder", waitMin: diff }
    : { bikeMin, carMin, verdict: "renners_eerder", waitMin: 0 };
}

// ---------------------------------------------------------------------------
// Stabiliteit van het gekozen aansluitpunt (anti-flapping). Zelfde geest als
// lib/off-route-choice.ts op mobiel: een eenmaal gekozen punt blijft staan
// tenzij (a) het gepasseerd/onbereikbaar is, of (b) een kandidaat een
// RELEVANTE verbetering is én de minimale stabiliteitsperiode voorbij is.
// ---------------------------------------------------------------------------

export type MeetpointChoice = {
  point: VolgautoMeetpoint;
  chosenAtMs: number;
};

export function shouldSwitchMeetpoint(input: {
  current: MeetpointChoice | null;
  candidate: VolgautoMeetpoint | null;
  nowMs: number;
  // Renners al voorbij het huidige punt? (bikeKm van de renners)
  ridersBikeKm: number | null;
  minStabilityMs?: number; // standaard 120 s
  minImprovementKm?: number; // kandidaat moet ≥ zoveel km "eerder" liggen? nee — verderop-logica: relevant verschil
}): { switch: boolean; reason: "geen_huidig" | "gepasseerd" | "verbetering" | "behouden" } {
  const minStability = input.minStabilityMs ?? 120_000;
  const minImprove = input.minImprovementKm ?? 1;
  if (!input.current) {
    return input.candidate
      ? { switch: true, reason: "geen_huidig" }
      : { switch: false, reason: "behouden" };
  }
  // Gepasseerd: renners zijn al (ruim) voorbij het huidige punt → altijd
  // wisselen naar een punt verderop, ook binnen de stabiliteitsperiode.
  if (
    input.ridersBikeKm != null &&
    input.ridersBikeKm > input.current.point.bikeKm + 0.2 &&
    input.candidate &&
    input.candidate.bikeKm > input.ridersBikeKm
  ) {
    return { switch: true, reason: "gepasseerd" };
  }
  if (!input.candidate) return { switch: false, reason: "behouden" };
  // Binnen de stabiliteitsperiode wisselen we niet op "iets beter".
  if (input.nowMs - input.current.chosenAtMs < minStability) {
    return { switch: false, reason: "behouden" };
  }
  // Relevante verbetering: kandidaat ligt wezenlijk anders (≥ minImprove km)
  // én is nog vóór de renners niet gepasseerd.
  const delta = Math.abs(input.candidate.bikeKm - input.current.point.bikeKm);
  if (delta >= minImprove) {
    return { switch: true, reason: "verbetering" };
  }
  return { switch: false, reason: "behouden" };
}
