// Volgauto-plan berekenen (I/O-laag). De AUTOroute komt volledig uit de
// routingprovider (ORS, profiel driving-car) — de router kiest zelf uitsluitend
// wegen die het wegennet als autotoegankelijk kent. Parkeerplaatsen komen uit
// echte OSM-data (Overpass). Alles wat niet lukt levert een eerlijke notitie
// of fout op — nooit een verzonnen route of beperking.

import type { RoutePathPoint, VolgautoMeetpoint, VolgautoSegment } from "@workspace/db";
import { getRoutingProvider } from "../routing";
import type { LatLon, RouteStep } from "../routing/types";
import {
  comparePaths,
  cumulativeKm,
  haversineMeters,
  pickMeetpoints,
  type ParkingCandidate,
} from "./plan";

// Vaste eerlijkheidsmelding — kaartdata over voertuigbeperkingen is nooit
// gegarandeerd volledig; deze zin hoort ALTIJD bij een volgautoplan.
export const VOLGAUTO_DISCLAIMER =
  "Controleer lokale verkeersborden. Niet alle voertuigbeperkingen zijn mogelijk beschikbaar.";

export type VolgautoComputation = {
  carGeometry: RoutePathPoint[];
  carNav: RouteStep[];
  carDistanceKm: number | null;
  carDurationSec: number | null;
  segments: VolgautoSegment[];
  meetpoints: VolgautoMeetpoint[];
  sharedKm: number;
  separatedKm: number;
  dataNotes: string[];
};

// De autoroute volgt de fietsroute zo goed als wettelijk kan: we sturen de
// autorouter door een handvol steunpunten LANGS de fietsroute. Waar een
// steunpunt voor een auto onbereikbaar is (bijv. midden op een fietspad),
// laten we dat punt vallen en noteren dat eerlijk.
const SUPPORT_POINT_EVERY_KM = 4;
const MAX_SUPPORT_POINTS = 12;

function supportPoints(bike: RoutePathPoint[], cum: number[]): LatLon[] {
  const total = cum[cum.length - 1] ?? 0;
  const step = Math.max(SUPPORT_POINT_EVERY_KM, total / MAX_SUPPORT_POINTS);
  const pts: LatLon[] = [{ lat: bike[0]![0], lon: bike[0]![1] }];
  let nextAt = step;
  for (let i = 1; i < bike.length - 1; i++) {
    if (cum[i]! >= nextAt) {
      pts.push({ lat: bike[i]![0], lon: bike[i]![1] });
      nextAt += step;
    }
  }
  const last = bike[bike.length - 1]!;
  pts.push({ lat: last[0], lon: last[1] });
  return pts;
}

async function routeCar(points: LatLon[]): Promise<{
  path: RoutePathPoint[];
  steps: RouteStep[];
  distanceKm: number | null;
  durationSec: number | null;
  droppedPoints: number;
}> {
  const provider = getRoutingProvider();
  let pts = points.slice();
  let dropped = 0;
  // Onbereikbare steunpunten (fietspad, autovrij) één voor één laten vallen;
  // begin- en eindpunt blijven altijd staan.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result = await provider.routeWaypoints({
        points: pts,
        profile: "driving-car",
      });
      return {
        path: result.path,
        steps: result.steps,
        distanceKm: result.distanceKm,
        durationSec: result.durationSec,
        droppedPoints: dropped,
      };
    } catch (err) {
      if (pts.length <= 2) throw err;
      // Laat het middelste tussenpunt vallen en probeer opnieuw.
      const mid = Math.floor(pts.length / 2);
      pts = pts.filter((_, i) => i !== mid || i === 0 || i === pts.length - 1);
      pts = [points[0]!, ...pts.slice(1, -1), points[points.length - 1]!];
      dropped++;
    }
  }
  // Laatste poging: alleen start → einde.
  const result = await provider.routeWaypoints({
    points: [points[0]!, points[points.length - 1]!],
    profile: "driving-car",
  });
  return {
    path: result.path,
    steps: result.steps,
    distanceKm: result.distanceKm,
    durationSec: result.durationSec,
    droppedPoints: dropped,
  };
}

// Echte parkeerplaatsen rond de aansluitpunten via Overpass (compacte
// nwr-vorm; de uitgebreide vorm time-out op grote gebieden). Mislukt de
// opvraag, dan zonder parkeerdata verder met een eerlijke notitie.
const OVERPASS_URL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter";

async function fetchParkings(
  around: { lat: number; lon: number }[],
): Promise<ParkingCandidate[] | null> {
  if (around.length === 0) return [];
  const clauses = around
    .slice(0, 12)
    .map(
      (p) =>
        `nwr["amenity"="parking"](around:400,${p.lat.toFixed(5)},${p.lon.toFixed(5)});`,
    )
    .join("\n");
  const query = `[out:json][timeout:20];(\n${clauses}\n);out center 120;`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 22_000);
    let res: Response;
    try {
      res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Sparki/1.0 (cycling training app)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as {
      elements?: {
        lat?: number;
        lon?: number;
        center?: { lat?: number; lon?: number };
        tags?: Record<string, string>;
      }[];
    };
    const out: ParkingCandidate[] = [];
    for (const e of json.elements ?? []) {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat == null || lon == null) continue;
      const name = (e.tags?.name ?? "").replace(/<[^>]*>/g, "").trim();
      out.push({ lat, lon, name: name || null });
    }
    return out;
  } catch {
    return null;
  }
}

export async function computeVolgautoPlan(
  bike: RoutePathPoint[],
): Promise<VolgautoComputation> {
  if (bike.length < 2) {
    throw new Error("Deze route heeft geen opgeslagen lijn op de kaart.");
  }
  const bikeCum = cumulativeKm(bike);
  const pts = supportPoints(bike, bikeCum);
  const car = await routeCar(pts);
  if (car.path.length < 2) {
    throw new Error("De routedienst gaf geen bruikbare autoroute terug.");
  }

  const cmp = comparePaths(bike, car.path);

  // Aansluitpunten: waar de auto weer bij de fietsroute komt. Parkeerdata is
  // best-effort; zonder blijven de routepunten zelf eerlijk staan.
  const rejoinCoords = cmp.rejoinKms.map((km) => {
    let idx = 0;
    for (let i = 0; i < bikeCum.length; i++) {
      if (bikeCum[i]! >= km) {
        idx = i;
        break;
      }
      idx = i;
    }
    return { lat: bike[idx]![0], lon: bike[idx]![1] };
  });
  const parkings = await fetchParkings(rejoinCoords);
  const meetpoints = pickMeetpoints(
    bike,
    bikeCum,
    cmp.rejoinKms,
    parkings ?? [],
    car.path,
  );

  const dataNotes: string[] = [VOLGAUTO_DISCLAIMER];
  if (car.droppedPoints > 0) {
    dataNotes.push(
      "Een deel van de fietsroute is voor auto's niet bereikbaar; de autoroute wijkt daar af.",
    );
  }
  if (parkings == null) {
    dataNotes.push(
      "Parkeerinformatie (OpenStreetMap) was tijdelijk niet beschikbaar; aansluitpunten liggen op de route zelf.",
    );
  }
  // Start ver uit elkaar? Eerlijk benoemen dat auto en fiets apart starten.
  const startGapM = haversineMeters(
    bike[0]![0],
    bike[0]![1],
    car.path[0]![0],
    car.path[0]![1],
  );
  if (startGapM > 250) {
    dataNotes.push(
      "De autoroute start op een ander punt dan de fietsroute (dichtstbijzijnde autotoegankelijke weg).",
    );
  }

  return {
    carGeometry: car.path,
    carNav: car.steps,
    carDistanceKm: car.distanceKm,
    carDurationSec: car.durationSec,
    segments: cmp.segments,
    meetpoints,
    sharedKm: cmp.sharedKm,
    separatedKm: cmp.separatedKm,
    dataNotes,
  };
}
