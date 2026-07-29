// GraphHopper provider — surface- en toegangsbewust routeren TIJDENS de
// generatie (Product Proof PO-01, taak #419). Anders dan de publieke ORS-API
// kan GraphHopper via custom models onverhard wegdek en verboden/privéwegen
// bestraffen in de kostenfunctie zelf, in plaats van achteraf te constateren
// dat een route ongeschikt is.
//
// Eerlijkheidscontract blijft gelden: geometrie, afstand, duur en stijging
// komen altijd van de provider; niets wordt verzonnen. OSM-wegdekdata is deels
// "missing" — daarom blijft de bestaande Overpass-verificatie ná generatie de
// onafhankelijke poort. Requires the GRAPHHOPPER_API_KEY secret.

import { isCyclingProfile } from "../profile-selection";
import { sanitizeNavSteps } from "../nav-sanitize";
import type {
  GeocodeResult,
  GeoPoint,
  LatLon,
  LoopRequest,
  PointToPointRequest,
  RouteResult,
  RouteStep,
  RoutingProfile,
  RoutingProvider,
  WaypointRequest,
} from "../types";

const GH_BASE = "https://graphhopper.com/api/1";

// GraphHopper instruction `sign` → kort Nederlands manoeuvrewoord.
const SIGN_DIR: Record<number, string> = {
  [-98]: "Keren",
  [-8]: "Keren",
  [-7]: "Links aanhouden",
  [-3]: "Scherp links",
  [-2]: "Links",
  [-1]: "Flauw links",
  0: "Rechtdoor",
  1: "Flauw rechts",
  2: "Rechts",
  3: "Scherp rechts",
  4: "Aankomst",
  5: "Via",
  6: "Rotonde",
  7: "Rechts aanhouden",
  8: "Keren",
};

// Custom model per fietsprofiel. Principes:
// - racefiets: onverhard/kasseien zwaar bestraffen (0.05 i.p.v. 0 — een harde
//   0 laat de zoektocht exploderen wanneer een eindpunt zo'n weg raakt).
// - gravel: milde straf op de ruigste ondergrond, rest vrij.
// - mtb: geen wegdekstraf (onverhard is juist gewenst).
// Toegang: GEEN road_access-regel. Empirisch geverifieerd: `road_access` is
// AUTO-toegang en markeert in Nederland vooral vrijliggende fietspaden als
// "no" — een straf daarop zou routes juist van fietspaden wegduwen.
// Fietslegaliteit (bicycle=no) borgt het fietsprofiel van GraphHopper zelf;
// de onafhankelijke Overpass-verificatie achteraf blijft de eerlijke poort.

const ROAD_SURFACE_RULE = {
  if: "surface == GRAVEL || surface == DIRT || surface == GROUND || surface == SAND || surface == COBBLESTONE || surface == UNPAVED || surface == GRASS || surface == OTHER",
  multiply_by: "0.05",
} as const;

const GRAVEL_SURFACE_RULE = {
  if: "surface == SAND || surface == GRASS",
  multiply_by: "0.3",
} as const;

function customModelFor(profile: RoutingProfile): Record<string, unknown> | null {
  switch (profile) {
    case "cycling-road":
      return { priority: [ROAD_SURFACE_RULE] };
    case "cycling-regular":
      return { priority: [GRAVEL_SURFACE_RULE] };
    default:
      return null;
  }
}

// RoutingProfile → GraphHopper-profielnaam.
function ghProfile(profile: RoutingProfile): string {
  switch (profile) {
    case "cycling-road":
      return "racingbike";
    case "cycling-mountain":
      return "mtb";
    case "cycling-regular":
      return "bike";
    case "foot-walking":
      return "foot";
    case "foot-hiking":
      return "hike";
    case "driving-car":
      return "car";
  }
}

type GhPath = {
  distance?: number;
  time?: number;
  ascend?: number;
  points?: { coordinates?: number[][] };
  instructions?: { distance?: number; sign?: number; text?: string }[];
  // Path details: per detail een lijst [vanIndex, totIndex, waarde].
  details?: Record<string, [number, number, unknown][]>;
};
type GhResponse = { paths?: GhPath[]; message?: string };

type GhGeocodeResponse = {
  hits?: {
    point?: { lat?: number; lng?: number };
    name?: string;
    street?: string;
    city?: string;
    country?: string;
  }[];
};

export class GraphHopperProvider implements RoutingProvider {
  readonly name = "graphhopper";
  readonly supportedProfiles: readonly RoutingProfile[] = [
    "cycling-road",
    "cycling-mountain",
    "cycling-regular",
    "foot-walking",
    "foot-hiking",
    "driving-car",
  ];

  isConfigured(): boolean {
    return Boolean(process.env.GRAPHHOPPER_API_KEY);
  }

  private apiKey(): string {
    const key = process.env.GRAPHHOPPER_API_KEY;
    if (!key) {
      throw new Error(
        "GRAPHHOPPER_API_KEY is niet ingesteld — routegeneratie is niet beschikbaar.",
      );
    }
    return key;
  }

  private dutchGhError(status: number, raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes("cannot find point") || r.includes("point 0")) {
      return "Vlak bij dit startpunt is geen berijdbare weg gevonden. Kies een punt dichter bij een weg.";
    }
    if (r.includes("connection between locations not found")) {
      return "Er is geen route gevonden tussen deze punten. Probeer een ander start- of eindpunt.";
    }
    if (r.includes("maximum nodes exceeded")) {
      return "Tussen deze punten is geen geschikte route voor dit fietstype gevonden. Probeer een ander punt in de buurt.";
    }
    if (status === 429 || r.includes("limit")) {
      return "De routeservice is even overbelast. Probeer het over een paar minuten opnieuw.";
    }
    if (status === 401 || status === 403) {
      return "De routeservice weigert de aanvraag (sleutelprobleem). Dit is een instellingsfout, geen gebruikersfout.";
    }
    return `De routeservice kon deze route niet maken (foutcode ${status}). Probeer het opnieuw of pas het startpunt of de afstand aan.`;
  }

  private async routeOnce(
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Response> {
    return fetch(`${GH_BASE}/route?key=${encodeURIComponent(this.apiKey())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  }

  // Kern-request. Bij "maximum nodes exceeded" mét custom model één eerlijke
  // herkansing zónder model: dat gebeurt vrijwel alleen wanneer een eindpunt
  // op een privé-/verboden weg snapt en de bestraffing het punt onbereikbaar
  // maakt. De Overpass-verificatiepoort ná generatie vangt het resultaat af —
  // er wordt dus nooit stilletjes een ongeschikte route als geschikt getoond.
  private async route(
    profile: RoutingProfile,
    baseBody: Record<string, unknown>,
  ): Promise<RouteResult> {
    const model = customModelFor(profile);
    const bodies: Record<string, unknown>[] = [];
    const withModel = model
      ? { ...baseBody, "ch.disable": true, custom_model: model }
      : null;
    // round_trip vereist flexible routing, dus ch.disable blijft dan nodig.
    const isRoundTrip = baseBody["algorithm"] === "round_trip";
    if (withModel) bodies.push(withModel);
    bodies.push(isRoundTrip ? { ...baseBody, "ch.disable": true } : baseBody);

    let lastErr: Error | null = null;
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i]!;
      const _t0 = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);
      let res: Response;
      try {
        res = await this.routeOnce(body, controller.signal);
        if (res.status === 429) {
          console.warn(`[GH] 429 rate-limit — retry na 2 s (profile=${profile})`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          res = await this.routeOnce(body, controller.signal);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"));
        console.log(
          `[PERF] gh.route profile=${profile} TIMEOUT/ERR ms=${Math.round(performance.now() - _t0)}`,
        );
        throw isAbort ? new Error("GraphHopper-request time-out (>25s)") : err;
      }
      clearTimeout(timeoutId);
      console.log(
        `[PERF] gh.route profile=${profile} status=${res.status} customModel=${"custom_model" in body} ms=${Math.round(performance.now() - _t0)}`,
      );

      const text = await res.text();
      let json: GhResponse;
      try {
        json = JSON.parse(text) as GhResponse;
      } catch {
        throw new Error(`GraphHopper gaf een ongeldig antwoord (status ${res.status})`);
      }

      if (!res.ok) {
        const raw = json.message ?? text.slice(0, 300);
        console.error(`GraphHopper-fout (status ${res.status}): ${raw}`);
        const retriable =
          "custom_model" in body &&
          i + 1 < bodies.length &&
          raw.toLowerCase().includes("maximum nodes exceeded");
        if (retriable) {
          console.warn(
            `[GH] custom model maakte doel onbereikbaar (snapte eindpunt op verboden weg?) — herkansing zonder model; verificatiepoort blijft gelden`,
          );
          lastErr = new Error(this.dutchGhError(res.status, raw));
          continue;
        }
        throw new Error(this.dutchGhError(res.status, raw));
      }

      const path = json.paths?.[0];
      const coords = path?.points?.coordinates;
      if (!coords || coords.length < 2) {
        throw new Error("GraphHopper leverde geen bruikbare route op");
      }
      return this.toResult(path, coords);
    }
    throw lastErr ?? new Error("GraphHopper leverde geen bruikbare route op");
  }

  private toResult(path: GhPath, coords: number[][]): RouteResult {
    const points: GeoPoint[] = [];
    const geometry: [number, number][] = [];
    for (const c of coords) {
      const lon = c[0];
      const lat = c[1];
      const ele = c.length > 2 ? c[2] : undefined;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      points.push({ lat, lon, ele: typeof ele === "number" ? ele : null });
      geometry.push([lat, lon]);
    }
    return {
      points,
      path: geometry,
      distanceKm:
        typeof path.distance === "number"
          ? Math.round((path.distance / 1000) * 100) / 100
          : null,
      durationSec:
        typeof path.time === "number" ? Math.round(path.time / 1000) : null,
      ascentM: typeof path.ascend === "number" ? Math.round(path.ascend) : null,
      steps: this.extractSteps(path.instructions),
      surfaceStats: this.surfaceStats(path, points),
    };
  }

  // Wegdek-/toegangsmeting uit de GraphHopper path details. Verhard is een
  // expliciete allowlist; "missing" telt eerlijk als onbekend (nooit als
  // verhard aangenomen). Restricted = wegen waar fietsers volgens de
  // kaartgegevens niet mogen komen (no/private). Retourneert null wanneer de
  // provider geen details meeleverde — nooit een geschatte statistiek.
  private surfaceStats(
    path: GhPath,
    points: GeoPoint[],
  ): RouteResult["surfaceStats"] {
    const surface = path.details?.["surface"];
    if (!surface) return null;
    // Cumulatieve afstand (m) langs de route per puntindex.
    const along: number[] = new Array(points.length).fill(0);
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lon - a.lon);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
      along[i] = along[i - 1]! + 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    const spanM = (from: number, to: number): number => {
      const a = Math.max(0, Math.min(from, points.length - 1));
      const b = Math.max(0, Math.min(to, points.length - 1));
      return Math.max(0, along[b]! - along[a]!);
    };
    const PAVED = new Set([
      "asphalt",
      "paved",
      "concrete",
      "paving_stones",
      "wood",
      "metal",
    ]);
    let unpavedM = 0;
    let missingM = 0;
    for (const [from, to, value] of surface ?? []) {
      const v = typeof value === "string" ? value.toLowerCase() : "missing";
      if (v === "missing") missingM += spanM(from, to);
      else if (!PAVED.has(v)) unpavedM += spanM(from, to);
    }
    const totalM = along[points.length - 1] ?? 0;
    return {
      totalM: Math.round(totalM),
      unpavedM: Math.round(unpavedM),
      missingM: Math.round(missingM),
    };
  }

  private extractSteps(
    instructions: { distance?: number; sign?: number; text?: string }[] | undefined,
  ): RouteStep[] {
    if (!instructions) return [];
    const cues: RouteStep[] = [];
    let runningM = 0;
    for (const ins of instructions) {
      const text = (ins.text ?? "").trim();
      if (text) {
        cues.push({
          km: Math.round((runningM / 1000) * 10) / 10,
          dir:
            typeof ins.sign === "number" && SIGN_DIR[ins.sign]
              ? SIGN_DIR[ins.sign]!
              : "Volg",
          note: text,
        });
      }
      if (typeof ins.distance === "number") runningM += ins.distance;
    }
    return sanitizeNavSteps(cues);
  }

  private baseBody(profile: RoutingProfile): Record<string, unknown> {
    return {
      profile: ghProfile(profile),
      locale: "nl",
      elevation: true,
      instructions: true,
      points_encoded: false,
      // Veerponten nooit als snap-doel (fiets én voet).
      snap_preventions: ["ferry"],
      // Voor fietsprofielen levert de path detail `surface` de wegdekmeting mee
      // (gratis in hetzelfde antwoord) — grondslag voor de geschiktheidspoort.
      ...(isCyclingProfile(profile) ? { details: ["surface"] } : {}),
    };
  }

  async generateLoop(req: LoopRequest): Promise<RouteResult> {
    const lengthM = Math.round(Math.min(Math.max(req.distanceKm, 3), 300) * 1000);
    // Boven ~150 km wordt round_trip onbetrouwbaar/afgewezen; dan bouwen we de
    // lus zelf via echte waypoints op een cirkel (zelfde aanpak als ORS-pad).
    if (lengthM > 150_000) {
      return this.longLoopViaWaypoints(req, lengthM);
    }
    const roundTripBody = (distM: number): Record<string, unknown> => ({
      ...this.baseBody(req.profile),
      points: [[req.start.lon, req.start.lat]],
      algorithm: "round_trip",
      "round_trip.distance": distM,
      "round_trip.seed": req.seed ?? Math.floor(Math.random() * 1e6),
    });
    const first = await this.route(req.profile, roundTripBody(lengthM));
    // Het custom model (wegdek-/toegangsstraffen) rekt round_trip-lussen op:
    // GraphHopper plant de gevraagde afstand op de kale graaf en wijkt daarna
    // uit naar geschikte wegen (empirisch ~+45% voor racefiets). Eén eerlijke
    // hercorrectie met geschaalde vraagafstand; we houden het resultaat dat
    // het dichtst bij de gevraagde afstand ligt. Geometrie blijft 100% echt.
    const targetKm = lengthM / 1000;
    if (first.distanceKm != null && first.distanceKm > 0) {
      const drift = Math.abs(first.distanceKm - targetKm) / targetKm;
      if (drift > 0.2) {
        const correctedM = Math.round(
          Math.min(Math.max((lengthM * targetKm) / first.distanceKm, 3000), 150_000),
        );
        try {
          const second = await this.route(req.profile, roundTripBody(correctedM));
          if (
            second.distanceKm != null &&
            Math.abs(second.distanceKm - targetKm) <
              Math.abs(first.distanceKm - targetKm)
          ) {
            return second;
          }
        } catch {
          // Correctiepoging mislukt — eerste echte resultaat blijft geldig.
        }
      }
    }
    return first;
  }

  // Lange lus: waypoints op een cirkel rond de start (geometrie blijft 100%
  // echt wegennetwerk — alleen de tussenpunten kiezen wij). Identieke wiskunde
  // als de ORS-provider zodat best-of-N-selectie zich hetzelfde gedraagt.
  private async longLoopViaWaypoints(
    req: LoopRequest,
    lengthM: number,
  ): Promise<RouteResult> {
    const seed = req.seed ?? Math.floor(Math.random() * 1e6);
    const nPoints = Math.max(4, Math.min(8, req.points ?? 6));
    const radiusM = lengthM / (2 * Math.PI * 1.25);
    const startBearing = ((seed % 360) * Math.PI) / 180;
    const R = 6371000;
    const lat1 = (req.start.lat * Math.PI) / 180;
    const lon1 = (req.start.lon * Math.PI) / 180;
    const dest = (
      fromLat: number,
      fromLon: number,
      bearing: number,
      distM: number,
    ): [number, number] => {
      const d = distM / R;
      const lat2 = Math.asin(
        Math.sin(fromLat) * Math.cos(d) +
          Math.cos(fromLat) * Math.sin(d) * Math.cos(bearing),
      );
      const lon2 =
        fromLon +
        Math.atan2(
          Math.sin(bearing) * Math.sin(d) * Math.cos(fromLat),
          Math.cos(d) - Math.sin(fromLat) * Math.sin(lat2),
        );
      return [lat2, lon2];
    };
    const [cLat, cLon] = dest(lat1, lon1, startBearing, radiusM);
    const backBearing = startBearing + Math.PI;
    const dir = seed % 2 === 0 ? 1 : -1;
    const pts: [number, number][] = [[req.start.lon, req.start.lat]];
    for (let i = 1; i < nPoints; i++) {
      const angle = backBearing + (dir * (2 * Math.PI * i)) / nPoints;
      const [wLat, wLon] = dest(cLat, cLon, angle, radiusM);
      pts.push([(wLon * 180) / Math.PI, (wLat * 180) / Math.PI]);
    }
    pts.push([req.start.lon, req.start.lat]);
    return this.route(req.profile, {
      ...this.baseBody(req.profile),
      points: pts,
    });
  }

  async routePointToPoint(req: PointToPointRequest): Promise<RouteResult> {
    return this.route(req.profile, {
      ...this.baseBody(req.profile),
      points: [
        [req.start.lon, req.start.lat],
        [req.end.lon, req.end.lat],
      ],
    });
  }

  async routeWaypoints(req: WaypointRequest): Promise<RouteResult> {
    if (req.points.length < 2) {
      throw new Error("Een route heeft minimaal twee punten nodig");
    }
    return this.route(req.profile, {
      ...this.baseBody(req.profile),
      points: req.points.map((p) => [p.lon, p.lat]),
    });
  }

  private geocodeLabel(hit: NonNullable<GhGeocodeResponse["hits"]>[number]): string | null {
    const parts = [hit.name, hit.city, hit.country].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    // Dedupliceer (naam kan gelijk zijn aan stad) maar behoud volgorde.
    const uniq = parts.filter((p, i) => parts.indexOf(p) === i);
    return uniq.length ? uniq.join(", ") : null;
  }

  async reverseGeocode(point: LatLon): Promise<string | null> {
    try {
      const url = new URL(`${GH_BASE}/geocode`);
      url.searchParams.set("key", this.apiKey());
      url.searchParams.set("reverse", "true");
      url.searchParams.set("point", `${point.lat},${point.lon}`);
      url.searchParams.set("locale", "nl");
      url.searchParams.set("limit", "1");
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const json = (await res.json()) as GhGeocodeResponse;
      const hit = json.hits?.[0];
      if (!hit) return null;
      return hit.name ?? this.geocodeLabel(hit);
    } catch {
      return null;
    }
  }

  async geocodeSearch(text: string, limit = 5): Promise<GeocodeResult[]> {
    try {
      const url = new URL(`${GH_BASE}/geocode`);
      url.searchParams.set("key", this.apiKey());
      url.searchParams.set("q", text);
      url.searchParams.set("locale", "nl");
      url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 10)));
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const json = (await res.json()) as GhGeocodeResponse;
      const out: GeocodeResult[] = [];
      for (const hit of json.hits ?? []) {
        const lat = hit.point?.lat;
        const lon = hit.point?.lng;
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        out.push({ lat, lon, label: this.geocodeLabel(hit) ?? text });
      }
      return out;
    } catch {
      return [];
    }
  }

  async geocode(text: string): Promise<GeocodeResult | null> {
    const results = await this.geocodeSearch(text, 1);
    return results[0] ?? null;
  }
}
