// Provider-agnostic routing types. The rest of the app depends ONLY on these —
// never on a concrete provider — so additional providers (Google, Komoot,
// Strava, Mapbox, GraphHopper, …) can be added later by implementing
// `RoutingProvider` without touching route handlers or the frontend.

export const routingProfiles = [
  "cycling-road",
  "cycling-mountain",
  "cycling-regular",
  // Gravelfiets (taak #445): eigen profiel zodat de harde 0%-onverhard-poort
  // van racefiets/gewone fiets (cycling-road/cycling-regular) NIET voor
  // gravel geldt — onverhard is daar juist gewenst. Providers zonder apart
  // gravelprofiel mappen dit intern op hun reguliere fietsprofiel.
  "cycling-gravel",
  "foot-walking",
  "foot-hiking",
  // Voertuigprofiel voor de volgauto (Opdracht 3). Wordt NOOIT gebruikt voor
  // fietsroutes; alleen voor de afzonderlijke voertuiggeschikte route en
  // auto-rejoins. Renners kiezen dit profiel nooit zelf.
  "driving-car",
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
  // Aandeel van de afstand op verhard wegdek (0–1) volgens de routebron zélf
  // (GraphHopper path details). null = de bron kan dit niet zeggen (ORS) of
  // te veel wegvakken hebben geen wegdek-tag — dan wordt er nooit gegokt.
  pavedFraction?: number | null;
  // Aandeel van de afstand waarvoor de bron het wegdek überhaupt KENT (0–1).
  // null = geen wegdek-details (ORS). Op de racefiets is een groot onbekend
  // aandeel een risico ("bij twijfel vermijden") en weegt het mee bij selectie.
  surfaceKnownFraction?: number | null;
  // Aandeel van de afstand op drukke doorgaande wegen (road_class primary/
  // secondary — in NL: N-wegen) volgens de routebron zélf. Rijdt de route op
  // zo'n wegvak, dan rijdt hij op de rijbaan (een vrijliggend fietspad is in
  // OSM een eigen weg met een eigen road_class). null = de bron levert geen
  // wegtype-details (ORS) — dan wordt er nooit gegokt.
  busyRoadFraction?: number | null;
};

export type GeocodeResult = { lat: number; lon: number; label: string };

export type LoopRequest = {
  start: LatLon;
  distanceKm: number;
  profile: RoutingProfile;
  seed?: number;
  points?: number;
  // How much climbing the rider wants. Used only to SELECT among real ORS
  // candidates (flattest / hilliest) — never to fabricate elevation.
  elevationPreference?: "flat" | "hilly" | "any";
  // Vermijd drukke N-wegen (taak #462): VOORKEUR-straf op road_class primary/
  // secondary in het custom model van de motor. Geen harde poort — de
  // bestaande geschiktheidspoorten blijven ongewijzigd; de eerlijke melding
  // achteraf gebeurt op basis van de gemeten busyRoadFraction.
  avoidBusyRoads?: boolean;
  // Onverhard-voorkeur (0..1, alleen gravel/MTB): laat de motor zelf actief
  // onverharde wegen opzoeken (voorkeursstraf op verhard wegdek in het custom
  // model, naar rato van de voorkeur). VOORKEUR, geen garantie — de selectie
  // op het gemeten onverhard-aandeel achteraf blijft de eerlijke poort.
  // Racefiets negeert dit volledig (harde 0%-grens).
  unpavedTargetShare?: number | null;
};

export type PointToPointRequest = {
  start: LatLon;
  end: LatLon;
  profile: RoutingProfile;
  // Zie LoopRequest.avoidBusyRoads.
  avoidBusyRoads?: boolean;
};

// An interactive, user-shaped route through an ordered list of points (≥2).
// The athlete clicks points on the map; the provider returns the real road
// route that threads through them in order (never an invented straight line).
export type WaypointRequest = {
  points: LatLon[];
  profile: RoutingProfile;
  // Zie LoopRequest.avoidBusyRoads.
  avoidBusyRoads?: boolean;
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
  // `focus` biedt de provider een voorkeurslocatie (bv. het huisadres van de
  // renner) zodat bij gelijke namen (Hengelo OV vs. Hengelo Indonesië) de
  // dichtstbijzijnde kandidaten voorop komen. Bias, geen filter: de provider
  // mag verre kandidaten nog steeds teruggeven; de caller sorteert/filtert.
  geocodeSearch(
    text: string,
    limit?: number,
    focus?: LatLon,
  ): Promise<GeocodeResult[]>;
  reverseGeocode(point: LatLon): Promise<string | null>;
}
