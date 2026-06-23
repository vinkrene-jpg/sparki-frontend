// OpenRouteService (ORS) client. Provides real cycling routing — point-to-point
// (A→B), round-trip loop generation, and geocoding — behind the ORS_API_KEY
// secret. All geometry and elevation returned here come from ORS; we never
// fabricate route geometry. Where ORS can only *prefer* something (surface,
// quiet roads) the caller surfaces that honestly to the user.

import type { BikeType, RoutePoint } from "@workspace/db";

const ORS_BASE = "https://api.openrouteservice.org";

function apiKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    throw new Error("ORS_API_KEY is not set");
  }
  return key;
}

export class OrsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OrsError";
    this.status = status;
  }
}

// Map a bike type to the ORS cycling profile that best matches its surface
// preference. ORS profiles: cycling-road (paved, fast), cycling-mountain
// (offroad/unpaved), cycling-regular (mixed everyday cycling).
export function bikeProfile(bike: BikeType): string {
  switch (bike) {
    case "race":
      return "cycling-road";
    case "mtb":
      return "cycling-mountain";
    case "gravel":
      return "cycling-regular";
  }
}

export type LatLon = { lat: number; lon: number };

export type OrsRoute = {
  // [lon, lat, ele?] tuples straight from ORS (3D when elevation requested).
  geometry: RoutePoint[];
  distanceKm: number | null;
  ascentM: number | null;
};

type GeoJsonFeatureCollection = {
  features?: Array<{
    geometry?: { coordinates?: number[][] };
    properties?: { summary?: { distance?: number }; ascent?: number };
  }>;
  error?: { message?: string } | string;
};

async function postDirections(
  profile: string,
  body: Record<string, unknown>,
): Promise<OrsRoute> {
  const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey(),
      "Content-Type": "application/json",
      Accept: "application/geo+json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as
    | GeoJsonFeatureCollection
    | null;

  if (!res.ok || !data) {
    const msg =
      (data &&
        (typeof data.error === "string"
          ? data.error
          : data.error?.message)) ||
      `ORS directions failed (${res.status})`;
    throw new OrsError(msg, res.status);
  }

  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates ?? [];
  if (coords.length === 0) {
    throw new OrsError("ORS returned no route geometry", 422);
  }

  const geometry = coords.map((c) =>
    c.length >= 3
      ? ([c[0]!, c[1]!, c[2]!] as RoutePoint)
      : ([c[0]!, c[1]!] as RoutePoint),
  );
  const distM = feature?.properties?.summary?.distance;
  const ascent = feature?.properties?.ascent;

  return {
    geometry,
    distanceKm: typeof distM === "number" ? Math.round(distM / 10) / 100 : null,
    ascentM: typeof ascent === "number" ? Math.round(ascent) : null,
  };
}

// Point-to-point (A→B) route with elevation.
export async function routeAtoB(
  profile: string,
  start: LatLon,
  end: LatLon,
): Promise<OrsRoute> {
  return postDirections(profile, {
    coordinates: [
      [start.lon, start.lat],
      [end.lon, end.lat],
    ],
    elevation: true,
  });
}

// Round-trip loop of approximately `targetKm` km starting/ending at `start`.
// `seed` varies the generated loop so "regenerate" yields a different route;
// `points` controls how many waypoints the loop is built from (fewer points =
// longer, straighter stretches, which suits interval work).
export async function routeLoop(
  profile: string,
  start: LatLon,
  targetKm: number,
  opts: { seed?: number; points?: number } = {},
): Promise<OrsRoute> {
  return postDirections(profile, {
    coordinates: [[start.lon, start.lat]],
    elevation: true,
    options: {
      round_trip: {
        length: Math.round(targetKm * 1000),
        points: opts.points ?? 4,
        seed: opts.seed ?? Math.floor(Math.random() * 1_000_000),
      },
    },
  });
}

type PeliasResponse = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: { label?: string; name?: string };
  }>;
};

// Reverse-geocode a coordinate to a human place label (best-effort; null on
// failure — callers must not fabricate a name).
export async function reverseGeocode(point: LatLon): Promise<string | null> {
  try {
    const url = `${ORS_BASE}/geocode/reverse?api_key=${encodeURIComponent(
      apiKey(),
    )}&point.lon=${point.lon}&point.lat=${point.lat}&size=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as PeliasResponse;
    const f = data.features?.[0]?.properties;
    return f?.label ?? f?.name ?? null;
  } catch {
    return null;
  }
}

export type GeocodeResult = { label: string; lat: number; lon: number };

// Forward-geocode an address/place query to candidate coordinates.
export async function searchGeocode(
  query: string,
  near?: LatLon,
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    api_key: apiKey(),
    text: query,
    size: "5",
  });
  if (near) {
    params.set("focus.point.lon", String(near.lon));
    params.set("focus.point.lat", String(near.lat));
  }
  const res = await fetch(`${ORS_BASE}/geocode/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new OrsError(`ORS geocoding failed (${res.status})`, res.status);
  }
  const data = (await res.json()) as PeliasResponse;
  const results: GeocodeResult[] = [];
  for (const f of data.features ?? []) {
    const coord = f.geometry?.coordinates;
    const label = f.properties?.label;
    if (coord && label) {
      results.push({ label, lon: coord[0], lat: coord[1] });
    }
  }
  return results;
}
