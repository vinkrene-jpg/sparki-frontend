// OpenRouteService (ORS) provider — the first concrete RoutingProvider. Every
// route's geometry, distance, duration, elevation, and turn-by-turn steps come
// from ORS, never fabricated. Requires the ORS_API_KEY secret.
//
// ORS cannot *guarantee* "no traffic lights" / "only scenic villages" — it can
// only *prefer* via profile + avoid_features. Where we can only prefer, the UI
// must say so honestly. This module exposes capabilities; the honesty wording
// lives in the route generator/UI.

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

const ORS_BASE = "https://api.openrouteservice.org";

// avoid_features valid for cycling profiles. Keeps generated cycling routes off
// ferries and stairs (which a bike can't ride). For foot profiles we avoid only
// ferries — walkers/hikers can legitimately use steps. We cannot avoid "busy
// city centres" via a feature flag — surfaced honestly in the UI.
const CYCLING_AVOID = ["ferries", "steps"] as const;
const FOOT_AVOID = ["ferries"] as const;

// ORS step.type → short Dutch maneuver word. Codes per ORS directions spec.
const STEP_TYPE_DIR: Record<number, string> = {
  0: "Links",
  1: "Rechts",
  2: "Scherp links",
  3: "Scherp rechts",
  4: "Flauw links",
  5: "Flauw rechts",
  6: "Rechtdoor",
  7: "Rotonde",
  8: "Rotonde af",
  9: "Keren",
  10: "Aankomst",
  11: "Vertrek",
  12: "Links aanhouden",
  13: "Rechts aanhouden",
};

type OrsGeoJson = {
  features?: {
    geometry?: { coordinates?: number[][] };
    properties?: {
      summary?: { distance?: number; duration?: number; ascent?: number };
      segments?: {
        steps?: {
          distance?: number;
          instruction?: string;
          name?: string;
          type?: number;
        }[];
      }[];
    };
  }[];
  error?: { message?: string } | string;
};

type PeliasResponse = {
  features?: {
    geometry?: { coordinates?: number[] };
    properties?: { label?: string; name?: string };
  }[];
};

export class OrsProvider implements RoutingProvider {
  readonly name = "ors";
  readonly supportedProfiles: readonly RoutingProfile[] = [
    "cycling-road",
    "cycling-mountain",
    "cycling-regular",
    "cycling-gravel",
    "foot-walking",
    "foot-hiking",
    "driving-car",
  ];

  isConfigured(): boolean {
    return Boolean(process.env.ORS_API_KEY);
  }

  private apiKey(): string {
    const key = process.env.ORS_API_KEY;
    if (!key) {
      throw new Error(
        "ORS_API_KEY is niet ingesteld — routegeneratie is niet beschikbaar.",
      );
    }
    return key;
  }

  private avoidFor(profile: RoutingProfile): readonly string[] {
    // driving-car: ORS routeert een auto zelf alleen over wegen die het
    // wegennet als autotoegankelijk kent; wij vermijden alleen veerponten.
    if (profile === "driving-car") return FOOT_AVOID;
    return isCyclingProfile(profile) ? CYCLING_AVOID : FOOT_AVOID;
  }

  // Vertaal een ORS-fout naar begrijpelijk Nederlands. De rauwe melding staat
  // al in de logs; hier alleen een eerlijke, leesbare uitleg voor de renner.
  private dutchOrsError(status: number, raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes("could not find routable point") || r.includes("point 0")) {
      return "Vlak bij dit startpunt is geen berijdbare weg gevonden. Kies een punt dichter bij een weg.";
    }
    if (
      r.includes("route could not be found") ||
      r.includes("unable to find a route")
    ) {
      return "Er is geen route gevonden tussen deze punten. Probeer een ander start- of eindpunt.";
    }
    if (r.includes("must not be greater than") || r.includes("maximum")) {
      return "Deze afstand is te groot voor de routeservice. Probeer een kortere afstand.";
    }
    if (status === 429 || r.includes("quota") || r.includes("rate limit")) {
      return "De routeservice is even overbelast. Probeer het over een paar minuten opnieuw.";
    }
    if (status === 401 || status === 403) {
      return "De routeservice weigert de aanvraag (sleutelprobleem). Dit is een instellingsfout, geen gebruikersfout.";
    }
    return `De routeservice kon deze route niet maken (foutcode ${status}). Probeer het opnieuw of pas het startpunt of de afstand aan.`;
  }

  private async directionsOnce(
    profile: RoutingProfile,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Response> {
    // ORS kent geen apart gravelprofiel (taak #445): gravel rijdt op het
    // reguliere fietsprofiel; de kwaliteitspoorten blijven profiel-eigen.
    const orsProfile = profile === "cycling-gravel" ? "cycling-regular" : profile;
    return fetch(`${ORS_BASE}/v2/directions/${orsProfile}/geojson`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey(),
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  private async directions(
    profile: RoutingProfile,
    body: Record<string, unknown>,
  ): Promise<RouteResult> {
    const _t0 = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await this.directionsOnce(profile, body, controller.signal);
      // Transient rate-limit: retry once after 2 s so a brief ORS quota window
      // doesn't kill a real user's route request.
      if (res.status === 429) {
        console.warn(`[ORS] 429 rate-limit — retrying once after 2 s (profile=${profile})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        res = await this.directionsOnce(profile, body, controller.signal);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("abort"));
      console.log(`[PERF] ors.directions profile=${profile} TIMEOUT/ERR ms=${Math.round(performance.now()-_t0)}`);
      throw isAbort ? new Error("ORS-request time-out (>15s)") : err;
    }
    clearTimeout(timeoutId);
    console.log(`[PERF] ors.directions profile=${profile} status=${res.status} ms=${Math.round(performance.now()-_t0)}`);

    const text = await res.text();
    let json: OrsGeoJson;
    try {
      json = JSON.parse(text) as OrsGeoJson;
    } catch {
      throw new Error(`ORS gaf een ongeldig antwoord (status ${res.status})`);
    }

    if (!res.ok) {
      const raw =
        typeof json.error === "string"
          ? json.error
          : (json.error?.message ?? "");
      // Eerlijk maar leesbaar: de rauwe (Engelse) ORS-fout gaat naar de logs,
      // de gebruiker krijgt een begrijpelijke Nederlandse melding.
      console.error(`ORS-fout (status ${res.status}): ${raw || text.slice(0, 300)}`);
      throw new Error(this.dutchOrsError(res.status, raw));
    }

    const feature = json.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      throw new Error("ORS leverde geen bruikbare route op");
    }

    const points: GeoPoint[] = [];
    const path: [number, number][] = [];
    for (const c of coords) {
      const lon = c[0];
      const lat = c[1];
      const ele = c.length > 2 ? c[2] : undefined;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      points.push({ lat, lon, ele: typeof ele === "number" ? ele : null });
      path.push([lat, lon]);
    }

    const summary = feature?.properties?.summary;
    const steps = this.extractSteps(feature?.properties?.segments);

    return {
      points,
      path,
      distanceKm:
        typeof summary?.distance === "number"
          ? Math.round((summary.distance / 1000) * 100) / 100
          : null,
      durationSec:
        typeof summary?.duration === "number"
          ? Math.round(summary.duration)
          : null,
      ascentM:
        typeof summary?.ascent === "number" ? Math.round(summary.ascent) : null,
      steps,
    };
  }

  // Flatten ORS segments→steps into cumulative-distance turn cues. The
  // instruction applies at the running distance BEFORE the step is walked/ridden.
  private extractSteps(
    segments:
      | { steps?: { distance?: number; instruction?: string; name?: string; type?: number }[] }[]
      | undefined,
  ): RouteStep[] {
    if (!segments) return [];
    const cues: RouteStep[] = [];
    let runningM = 0;
    for (const seg of segments) {
      for (const step of seg.steps ?? []) {
        const instruction = (step.instruction ?? "").trim();
        if (instruction) {
          cues.push({
            km: Math.round((runningM / 1000) * 10) / 10,
            dir:
              typeof step.type === "number" && STEP_TYPE_DIR[step.type]
                ? STEP_TYPE_DIR[step.type]!
                : "Volg",
            note: instruction,
          });
        }
        if (typeof step.distance === "number") runningM += step.distance;
      }
    }
    // Waypoints zijn routevormgevers, geen bestemmingen: alleen de echte
    // eerste vertrek- en laatste aankomststap blijven staan.
    return sanitizeNavSteps(cues);
  }

  async generateLoop(req: LoopRequest): Promise<RouteResult> {
    const lengthM = Math.round(
      Math.min(Math.max(req.distanceKm, 3), 300) * 1000,
    );
    // ORS `round_trip` weigert alles boven 100 km ("must not be greater than
    // 100000.0 meters"). Voor langere lussen bouwen we de rondte zelf: echte
    // waypoints op een cirkel rond het startpunt, geroute via de gewone
    // directions-API (die wél lange afstanden aankan). De geometrie blijft
    // 100% echt wegennetwerk — alleen de tussenpunten kiezen wij.
    if (lengthM > 95000) {
      return this.longLoopViaWaypoints(req, lengthM);
    }
    return this.directions(req.profile, {
      coordinates: [[req.start.lon, req.start.lat]],
      elevation: true,
      instructions: true,
      language: "nl",
      options: {
        avoid_features: this.avoidFor(req.profile),
        round_trip: {
          length: lengthM,
          points: req.points ?? 4,
          seed: req.seed ?? Math.floor(Math.random() * 1e6),
        },
      },
    });
  }

  // Lange lus (>95 km): waypoints op een cirkel rond de start. De straal is
  // afgestemd op de gevraagde afstand (wegen zijn ~25% langer dan de ideale
  // cirkel); de seed draait de startrichting zodat regenereren en best-of-N
  // selectie echt verschillende lussen opleveren.
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
    // Middelpunt van de cirkel ligt op één straal afstand in de startrichting,
    // zodat het startpunt zelf óp de cirkel ligt.
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
    // Richting van middelpunt terug naar start bepaalt waar op de cirkel we
    // beginnen; de overige punten volgen met gelijke hoekstappen (met de klok
    // mee of tegen, afhankelijk van de seed, voor extra variatie).
    const backBearing = startBearing + Math.PI;
    const dir = seed % 2 === 0 ? 1 : -1;
    const coordinates: [number, number][] = [[req.start.lon, req.start.lat]];
    for (let i = 1; i < nPoints; i++) {
      const angle = backBearing + dir * (2 * Math.PI * i) / nPoints;
      const [wLat, wLon] = dest(cLat, cLon, angle, radiusM);
      coordinates.push([(wLon * 180) / Math.PI, (wLat * 180) / Math.PI]);
    }
    coordinates.push([req.start.lon, req.start.lat]);
    return this.directions(req.profile, {
      coordinates,
      elevation: true,
      instructions: true,
      language: "nl",
      options: { avoid_features: this.avoidFor(req.profile) },
    });
  }

  async routePointToPoint(req: PointToPointRequest): Promise<RouteResult> {
    return this.directions(req.profile, {
      coordinates: [
        [req.start.lon, req.start.lat],
        [req.end.lon, req.end.lat],
      ],
      elevation: true,
      instructions: true,
      language: "nl",
      options: { avoid_features: this.avoidFor(req.profile) },
    });
  }

  // Route through an ordered list of user-placed waypoints (≥2). ORS threads the
  // real road network through every coordinate in order — the returned geometry
  // is the actual ridable path, never a straight line between the clicks.
  async routeWaypoints(req: WaypointRequest): Promise<RouteResult> {
    if (req.points.length < 2) {
      throw new Error("Een route heeft minimaal twee punten nodig");
    }
    return this.directions(req.profile, {
      coordinates: req.points.map((p) => [p.lon, p.lat]),
      elevation: true,
      instructions: true,
      language: "nl",
      options: { avoid_features: this.avoidFor(req.profile) },
    });
  }

  // Reverse geocode a coordinate to a human-readable place name (best-effort;
  // returns null on any failure — naming never blocks a route).
  async reverseGeocode(point: LatLon): Promise<string | null> {
    try {
      const url = new URL(`${ORS_BASE}/geocode/reverse`);
      url.searchParams.set("api_key", this.apiKey());
      url.searchParams.set("point.lat", String(point.lat));
      url.searchParams.set("point.lon", String(point.lon));
      url.searchParams.set("size", "1");
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const json = (await res.json()) as PeliasResponse;
      const p = json.features?.[0]?.properties;
      return p?.name ?? p?.label ?? null;
    } catch {
      return null;
    }
  }

  // Forward geocode free text to a list of candidates (best-first). Returns an
  // empty array on any failure — search never throws at the caller.
  async geocodeSearch(text: string, limit = 5): Promise<GeocodeResult[]> {
    try {
      const url = new URL(`${ORS_BASE}/geocode/search`);
      url.searchParams.set("api_key", this.apiKey());
      url.searchParams.set("text", text);
      url.searchParams.set("size", String(Math.min(Math.max(limit, 1), 10)));
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const json = (await res.json()) as PeliasResponse;
      const out: GeocodeResult[] = [];
      for (const f of json.features ?? []) {
        const coords = f?.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const lon = coords[0];
        const lat = coords[1];
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        out.push({ lat, lon, label: f?.properties?.label ?? text });
      }
      return out;
    } catch {
      return [];
    }
  }

  // Forward geocode free text to a coordinate. Returns null when nothing usable.
  async geocode(text: string): Promise<GeocodeResult | null> {
    try {
      const url = new URL(`${ORS_BASE}/geocode/search`);
      url.searchParams.set("api_key", this.apiKey());
      url.searchParams.set("text", text);
      url.searchParams.set("size", "1");
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const json = (await res.json()) as PeliasResponse;
      const f = json.features?.[0];
      const coords = f?.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const lon = coords[0];
      const lat = coords[1];
      if (typeof lat !== "number" || typeof lon !== "number") return null;
      return { lat, lon, label: f?.properties?.label ?? text };
    } catch {
      return null;
    }
  }
}
