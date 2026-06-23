// OpenRouteService (ORS) provider — the first concrete RoutingProvider. Every
// route's geometry, distance, duration, elevation, and turn-by-turn steps come
// from ORS, never fabricated. Requires the ORS_API_KEY secret.
//
// ORS cannot *guarantee* "no traffic lights" / "only scenic villages" — it can
// only *prefer* via profile + avoid_features. Where we can only prefer, the UI
// must say so honestly. This module exposes capabilities; the honesty wording
// lives in the route generator/UI.

import { isCyclingProfile } from "../profile-selection";
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
    "foot-walking",
    "foot-hiking",
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
    return isCyclingProfile(profile) ? CYCLING_AVOID : FOOT_AVOID;
  }

  private async directions(
    profile: RoutingProfile,
    body: Record<string, unknown>,
  ): Promise<RouteResult> {
    const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey(),
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: OrsGeoJson;
    try {
      json = JSON.parse(text) as OrsGeoJson;
    } catch {
      throw new Error(`ORS gaf een ongeldig antwoord (status ${res.status})`);
    }

    if (!res.ok) {
      const msg =
        typeof json.error === "string"
          ? json.error
          : (json.error?.message ?? `ORS-fout (status ${res.status})`);
      throw new Error(msg);
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
    return cues;
  }

  async generateLoop(req: LoopRequest): Promise<RouteResult> {
    const lengthM = Math.round(
      Math.min(Math.max(req.distanceKm, 3), 200) * 1000,
    );
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
