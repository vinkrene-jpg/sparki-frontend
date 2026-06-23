// Provider-agnostic routing types. The rest of the app depends ONLY on these —
// never on a concrete provider — so additional providers (Google, Komoot,
// Strava, Mapbox, GraphHopper, …) can be added later by implementing
// `RoutingProvider` without touching route handlers or the frontend.

export const routingProfiles = [
  "cycling-road",
  "cycling-mountain",
  "cycling-regular",
  "foot-walking",
  "foot-hiking",
] as const;
export type RoutingProfile = (typeof routingProfiles)[number];

export type LatLon = { lat: number; lon: number };

// A point with optional elevation, ready for summarizeTrack().
export type GeoPoint = { lat: number; lon: number; ele: number | null };

// A turn-by-turn navigation cue. `km` is the cumulative distance from the start
// at which the instruction applies; `dir` is a short maneuver word; `note` is
// the full human-readable instruction (incl. street name when available).
export type RouteStep = { km: number; dir: string; note: string };

export type RouteResult = {
  // Ordered points for distance/elevation/climb summarisation.
  points: GeoPoint[];
  // Path geometry as [lat, lon] pairs, for storage + map redraw.
  path: [number, number][];
  // Provider-reported distance (km), moving duration (s), and ascent (m).
  distanceKm: number | null;
  durationSec: number | null;
  ascentM: number | null;
  // Turn-by-turn cues derived from the provider's instructions.
  steps: RouteStep[];
};

export type GeocodeResult = { lat: number; lon: number; label: string };

export type LoopRequest = {
  start: LatLon;
  distanceKm: number;
  profile: RoutingProfile;
  seed?: number;
  points?: number;
};

export type PointToPointRequest = {
  start: LatLon;
  end: LatLon;
  profile: RoutingProfile;
};

// An interactive, user-shaped route through an ordered list of points (≥2).
// The athlete clicks points on the map; the provider returns the real road
// route that threads through them in order (never an invented straight line).
export type WaypointRequest = {
  points: LatLon[];
  profile: RoutingProfile;
};

// The contract every routing provider implements. ORS is the first provider.
export interface RoutingProvider {
  readonly name: string;
  readonly supportedProfiles: readonly RoutingProfile[];
  isConfigured(): boolean;
  generateLoop(req: LoopRequest): Promise<RouteResult>;
  routePointToPoint(req: PointToPointRequest): Promise<RouteResult>;
  routeWaypoints(req: WaypointRequest): Promise<RouteResult>;
  geocode(text: string): Promise<GeocodeResult | null>;
  geocodeSearch(text: string, limit?: number): Promise<GeocodeResult[]>;
  reverseGeocode(point: LatLon): Promise<string | null>;
}
