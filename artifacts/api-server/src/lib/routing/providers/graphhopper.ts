// GraphHopper provider — de betaalde routeringsmotor waarvoor René op
// 2026-07-29 gekozen heeft (taak #419, optie B uit het productonderzoek).
// Anders dan ORS respecteren GraphHopper-fietsprofielen wegdek én
// fietslegaliteit als kern van de kostenfunctie: `racingbike` mijdt onverhard
// en verboden wegen hard, `mtb` mag juist het pad op. Vereist de
// GRAPHHOPPER_API_KEY secret; zonder sleutel meldt isConfigured() dat eerlijk
// en valt de registry terug op ORS.
//
// Net als ORS kan GraphHopper niets garanderen dat OSM niet weet — fouten in
// de kaartdata blijven mogelijk. Die eerlijkheid blijft in de UI staan.

import { sanitizeNavSteps } from "../nav-sanitize";
import { noteRoutingProviderCall } from "../../overpass/client";
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

const GH_PROFILE: Record<RoutingProfile, string> = {
  "cycling-road": "racingbike",
  "cycling-mountain": "mtb",
  "cycling-regular": "bike",
  // Gravel (taak #445): GraphHopper heeft geen apart gravelprofiel; het vrije
  // "bike"-profiel + het milde gravel-custom-model laat onverhard gewoon toe.
  "cycling-gravel": "bike",
  "foot-walking": "foot",
  "foot-hiking": "hike",
  "driving-car": "car",
};

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
  5: "Rechtdoor",
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
  // COMPACTED (halfverhard — hertest Hengelo/Twente!) en FINE_GRAVEL horen er
  // ook bij: op de racefiets is halfverhard gewoon een misser.
  if: "surface == GRAVEL || surface == FINE_GRAVEL || surface == COMPACTED || surface == DIRT || surface == GROUND || surface == SAND || surface == COBBLESTONE || surface == UNPAVED || surface == GRASS || surface == OTHER",
  multiply_by: "0.05",
} as const;

// "Bij twijfel vermijden" (René's hertest Hengelo, 30-07-2026): wegen zonder
// wegdek-tag in OSM zijn op de racefiets een gok — in de praktijk bleek een
// route met 16% onbekende ondergrond deels gravel. Het Komoot-principe: bij
// twijfel de weg mijden tenzij het niet anders kan. 0.4 (geen 0.05): een
// onbekende weg is meestal gewoon asfalt (NL-woonstraten), dus hard straffen
// zou routes onnodig lang maken; mild straffen laat getagde wegen winnen.
const ROAD_UNKNOWN_SURFACE_RULE = {
  if: "surface == MISSING",
  multiply_by: "0.4",
} as const;

const GRAVEL_SURFACE_RULE = {
  if: "surface == SAND || surface == GRASS",
  multiply_by: "0.3",
} as const;

// Trap op de route = afstappen en dragen; acceptatiegrens René (30-07-2026):
// een kandidaat met een trap wordt nooit gekozen. Bestraf trappen daarom al
// in de motor zelf (0.05, geen harde 0 — die laat de zoektocht exploderen
// wanneer een eindpunt zo'n weg raakt). Geldt voor racefiets én gravel/bike;
// mtb heeft geen model en houdt zijn eigen afweging.
const STEPS_RULE = {
  if: "road_class == STEPS",
  multiply_by: "0.05",
} as const;

// Vermijd drukke N-wegen (taak #462, kalibratie René 30-07-2026): VOORKEUR-
// straf op road_class primary/secondary. In NL zijn dat de N-wegen; rijdt de
// route op zo'n wegvak, dan rijdt hij op de rijbaan zelf — een vrijliggend
// fietspad is in OSM een eigen weg met een eigen road_class en wordt dus
// nooit meebestraft. 0.15 (geen 0.05): dit is een voorkeur, geen harde poort —
// een kort onvermijdbaar stuk N-weg mag de route niet onmogelijk maken.
const BUSY_ROAD_RULE = {
  if: "road_class == PRIMARY || road_class == SECONDARY",
  multiply_by: "0.15",
} as const;

const CYCLING_PROFILES: readonly RoutingProfile[] = [
  "cycling-road",
  "cycling-regular",
  "cycling-gravel",
  "cycling-mountain",
];

// Exported for the calibration regression test (gravel steering / racefiets
// hard border) — production code calls this only via route().
export function customModelFor(
  profile: RoutingProfile,
  avoidBusyRoads: boolean,
  unpavedTargetShare: number | null = null,
): Record<string, unknown> | null {
  const rules: Record<string, unknown>[] = [];
  switch (profile) {
    case "cycling-road":
      rules.push(ROAD_SURFACE_RULE, ROAD_UNKNOWN_SURFACE_RULE, STEPS_RULE);
      break;
    case "cycling-regular":
      // Zelfde wegdeksturing als de racefiets: de harde afkeurpoort eist voor
      // de gewone fiets óók 0% onverhard (taak #441) — een motor die gravel
      // vrij laat bouwt dan alleen kandidaten die de poort daarna afkeurt.
      // Bewezen 02-08-2026 rond Herentals: elke kandidaat bevatte onverhard,
      // de generatie maalde 5 minuten en eindigde eerlijk maar leeg.
      rules.push(ROAD_SURFACE_RULE, ROAD_UNKNOWN_SURFACE_RULE, STEPS_RULE);
      break;
    case "cycling-gravel":
      // Gravel (taak #445): onverhard is welkom; alleen zand/gras en trappen
      // mild bestraffen zodat de route wel fietsbaar blijft.
      rules.push(GRAVEL_SURFACE_RULE, STEPS_RULE);
      // Onverhard-voorkeur (30-07-2026, feedback René): de gravel-schuif
      // stuurde alleen de nakeuze tussen kandidaten — maar als de motor
      // uitsluitend asfaltlussen bouwt, valt er niets te kiezen. Laat de
      // motor daarom zelf onverhard opzoeken: een voorkeursstraf op verhard
      // wegdek, naar rato van de gewenste onverhard-fractie (30% wens ⇒
      // asfalt ×0.64; 100% ⇒ ×0.3). Gemeten 30-07-2026: bij ×0.76 bleef een
      // Twentse lus op ~91% verhard steken — vandaar deze stevigere schaal.
      // Nooit een harde 0: een route mag nooit onmogelijk worden; het gemeten
      // aandeel achteraf blijft de eerlijke meetlat (voorkeur, geen garantie).
      if (
        typeof unpavedTargetShare === "number" &&
        unpavedTargetShare > 0 &&
        unpavedTargetShare <= 1
      ) {
        const factor = Math.max(0.3, 1 - 1.2 * unpavedTargetShare);
        rules.push({
          if: "surface == ASPHALT || surface == CONCRETE || surface == PAVED || surface == PAVING_STONES",
          multiply_by: String(factor),
        });
      }
      break;
    default:
      break;
  }
  // N-wegen-voorkeur geldt voor alle fietsprofielen (ook MTB, die verder geen
  // model heeft) — nooit voor voet- of autoprofielen.
  if (avoidBusyRoads && CYCLING_PROFILES.includes(profile)) {
    rules.push(BUSY_ROAD_RULE);
  }
  return rules.length > 0 ? { priority: rules } : null;
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
    case "cycling-gravel":
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
  details?: {
    surface?: [number, number, string | null][];
    road_class?: [number, number, string | null][];
  };
  instructions?: {
    distance?: number;
    sign?: number;
    text?: string;
    street_name?: string;
  }[];
};

const PAVED_SURFACES = new Set([
  "asphalt",
  "concrete",
  "paved",
  "paving_stones",
]);
type GhRouteResponse = {
  paths?: GhPath[];
  message?: string;
};
type GhResponse = { paths?: GhPath[]; message?: string };

type GhGeocodeResponse = {
  hits?: {
    point?: { lat?: number; lng?: number };
    name?: string;
    city?: string;
    country?: string;
    street?: string;
  }[];
};

export class GraphHopperProvider implements RoutingProvider {
  readonly name = "graphhopper";
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

  // Vertaal een GraphHopper-fout naar begrijpelijk Nederlands. De rauwe
  // melding staat al in de logs; hier alleen een eerlijke, leesbare uitleg.
  private dutchGhError(status: number, raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes("cannot find point") || r.includes("point_not_found")) {
      return "Vlak bij dit startpunt is geen berijdbare weg gevonden. Kies een punt dichter bij een weg.";
    }
    if (r.includes("connection between locations not found")) {
      return "Er is geen route gevonden tussen deze punten. Probeer een ander start- of eindpunt.";
    }
    if (r.includes("profile parameter can only be")) {
      return "Het GraphHopper-abonnement ondersteunt dit fietsprofiel (nog) niet — waarschijnlijk een gratis pakket zonder racefiets/MTB-profielen. Dit is een instellingsfout, geen gebruikersfout.";
    }
    if (r.includes("flexible mode")) {
      return "Het GraphHopper-abonnement ondersteunt geen rondritten (gratis pakket zonder flexible mode). Dit is een instellingsfout, geen gebruikersfout.";
    }
    if (status === 429 || r.includes("limit") || r.includes("too many")) {
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
    noteRoutingProviderCall(); // ROUTEMETING_01 M3
    return fetch(`${GH_BASE}/route?key=${encodeURIComponent(this.apiKey())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  }

  private async route(
    profile: RoutingProfile,
    body: Record<string, unknown>,
    avoidBusyRoads = false,
    unpavedTargetShare: number | null = null,
  ): Promise<RouteResult> {
    // Custom model (wegdek- en trapstraffen) vereist flexible mode
    // (ch.disable). Bij "maximum nodes exceeded" (eindpunt snapt op een zwaar
    // bestrafte weg) volgt één eerlijke herkansing zónder model — de
    // verificatiepoort achteraf (obstakels/wegdek) blijft dan gewoon gelden.
    const customModel = customModelFor(
      profile,
      avoidBusyRoads,
      unpavedTargetShare,
    );
    const payload: Record<string, unknown> = {
      profile: GH_PROFILE[profile],
      elevation: true,
      instructions: true,
      locale: "nl",
      points_encoded: false,
      // Wegdek + wegtype per wegvak uit de routebron ZELF — dezelfde motor
      // die de route kiest, vertelt ook wat het wegdek/wegtype is. road_class
      // voedt de eerlijke N-wegen-meting (busyRoadFraction, taak #462).
      details: ["surface", "road_class"],
      ...(customModel ? { custom_model: customModel, "ch.disable": true } : {}),
      ...body,
    };
    return this.routeWithPayload(profile, payload, customModel != null);
  }

  private async routeWithPayload(
    profile: RoutingProfile,
    payload: Record<string, unknown>,
    hasCustomModel: boolean,
  ): Promise<RouteResult> {
    const _t0 = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    let res: Response;
    try {
      res = await this.routeOnce(payload, controller.signal);
      // Transient rate-limit: één keer opnieuw na 2 s, zodat een korte
      // quota-piek niet meteen de routeaanvraag van een renner breekt.
      if (res.status === 429) {
        console.warn(
          `[GH] 429 rate-limit — retrying once after 2 s (profile=${profile})`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        res = await this.routeOnce(payload, controller.signal);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("abort"));
      console.log(
        `[PERF] gh.route profile=${profile} TIMEOUT/ERR ms=${Math.round(performance.now() - _t0)}`,
      );
      throw isAbort ? new Error("GraphHopper-request time-out (>20s)") : err;
    }
    clearTimeout(timeoutId);
    console.log(
      `[PERF] gh.route profile=${profile} status=${res.status} ms=${Math.round(performance.now() - _t0)}`,
    );

    const text = await res.text();
    let json: GhRouteResponse;
    try {
      json = JSON.parse(text) as GhRouteResponse;
    } catch {
      json = {};
    }
    if (!res.ok) {
      const raw = json.message ?? text.slice(0, 300);
      if (
        hasCustomModel &&
        typeof raw === "string" &&
        raw.toLowerCase().includes("maximum nodes")
      ) {
        console.warn(
          `[GH] maximum nodes met custom model — eerlijke herkansing zonder model (profile=${profile})`,
        );
        const { custom_model: _cm, ...rest } = payload;
        return this.routeWithPayload(profile, rest, false);
      }
      console.warn(`[GH] route error status=${res.status}: ${raw}`);
      throw new Error(this.dutchGhError(res.status, raw));
    }
    const path = json.paths?.[0];
    const coords = path?.points?.coordinates;
    if (!path || !coords || coords.length < 2) {
      throw new Error("De routeservice gaf geen bruikbare route terug.");
    }

    const points: GeoPoint[] = [];
    const geometry: [number, number][] = [];
    for (const c of coords) {
      const lon = c[0];
      const lat = c[1];
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const ele = typeof c[2] === "number" ? c[2] : null;
      points.push({ lat, lon, ele });
      geometry.push([lat, lon]);
    }

    // Cues: cumulatieve km per instructie = som van de vorige instructie-
    // afstanden (GraphHopper geeft per instructie de afstand tot de volgende).
    const cues: RouteStep[] = [];
    let cumM = 0;
    for (const ins of path.instructions ?? []) {
      const sign = typeof ins.sign === "number" ? ins.sign : 0;
      const note = (ins.text ?? "").trim();
      if (note) {
        cues.push({
          km: Math.round((cumM / 1000) * 100) / 100,
          dir: SIGN_DIR[sign] ?? "Rechtdoor",
          note,
        });
      }
      cumM += typeof ins.distance === "number" ? ins.distance : 0;
    }

    // Verhard aandeel uit GraphHoppers eigen surface-details. Onbekende
    // wegvakken tellen in geen van beide bakken; is méér dan 40% onbekend dan
    // is de meting te dun en zeggen we eerlijk niets (null).
    let pavedFraction: number | null = null;
    let surfaceKnownFraction: number | null = null;
    let busyRoadFraction: number | null = null;
    const surfaceDetails = path.details?.surface;
    const roadClassDetails = path.details?.road_class;
    // Cumulatieve afstand per coördinaat-index (haversine, meters) — gedeeld
    // door de wegdek- en de wegtype-meting.
    let cum: number[] | null = null;
    const buildCum = (): number[] => {
      if (cum) return cum;
      cum = new Array(coords.length).fill(0);
      const R = 6371000;
      for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i - 1]!;
        const [lon2, lat2] = coords[i]!;
        if (
          typeof lat1 !== "number" || typeof lon1 !== "number" ||
          typeof lat2 !== "number" || typeof lon2 !== "number"
        ) {
          cum[i] = cum[i - 1]!;
          continue;
        }
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        cum[i] = cum[i - 1]! + 2 * R * Math.asin(Math.sqrt(a));
      }
      return cum;
    };
    if (Array.isArray(surfaceDetails) && surfaceDetails.length > 0) {
      const c = buildCum();
      const totalM = c[c.length - 1]!;
      let pavedM = 0;
      let unpavedM = 0;
      for (const seg of surfaceDetails) {
        const from = seg[0];
        const to = seg[1];
        const value = typeof seg[2] === "string" ? seg[2] : "";
        if (
          !Number.isInteger(from) || !Number.isInteger(to) ||
          from < 0 || to >= c.length || to <= from
        ) {
          continue;
        }
        const m = c[to]! - c[from]!;
        if (PAVED_SURFACES.has(value)) pavedM += m;
        else if (UNPAVED_SURFACES_GH.has(value)) unpavedM += m;
      }
      const knownM = pavedM + unpavedM;
      if (totalM > 0) {
        surfaceKnownFraction = Math.min(Math.max(knownM / totalM, 0), 1);
      }
      if (totalM > 0 && knownM / totalM >= 0.6) {
        pavedFraction = Math.min(Math.max(pavedM / knownM, 0), 1);
      }
    }
    // Aandeel drukke doorgaande wegen (primary/secondary — N-wegen) uit de
    // road_class-details van de motor zélf (taak #462). Vrijliggende
    // fietspaden zijn eigen wegen met een eigen road_class en tellen dus
    // nooit mee. Zonder details: eerlijk null, nooit gokken.
    if (Array.isArray(roadClassDetails) && roadClassDetails.length > 0) {
      const c = buildCum();
      const totalM = c[c.length - 1]!;
      let busyM = 0;
      for (const seg of roadClassDetails) {
        const from = seg[0];
        const to = seg[1];
        const value = typeof seg[2] === "string" ? seg[2].toLowerCase() : "";
        if (
          !Number.isInteger(from) || !Number.isInteger(to) ||
          from < 0 || to >= c.length || to <= from
        ) {
          continue;
        }
        if (value === "primary" || value === "secondary") {
          busyM += c[to]! - c[from]!;
        }
      }
      if (totalM > 0) {
        busyRoadFraction = Math.min(Math.max(busyM / totalM, 0), 1);
      }
    }

    return {
      points,
      path: geometry,
      pavedFraction,
      surfaceKnownFraction,
      busyRoadFraction,
      distanceKm:
        typeof path.distance === "number"
          ? Math.round((path.distance / 1000) * 100) / 100
          : null,
      durationSec:
        typeof path.time === "number" ? Math.round(path.time / 1000) : null,
      ascentM: typeof path.ascend === "number" ? Math.round(path.ascend) : null,
      steps: sanitizeNavSteps(cues),
    };
  }

  async generateLoop(req: LoopRequest): Promise<RouteResult> {
    const lengthM = Math.round(
      Math.min(Math.max(req.distanceKm, 3), 300) * 1000,
    );
    // Boven ~150 km wordt het round_trip-algoritme traag/onbetrouwbaar; dan
    // bouwen we de lus zelf met echte waypoints op een cirkel (zelfde aanpak
    // als bij ORS — de geometrie blijft 100% echt wegennetwerk).
    if (lengthM > 150_000) {
      return this.longLoopViaWaypoints(req, lengthM);
    }
    return this.route(
      req.profile,
      {
        points: [[req.start.lon, req.start.lat]],
        algorithm: "round_trip",
        "round_trip.distance": lengthM,
        "round_trip.seed": req.seed ?? Math.floor(Math.random() * 1e6),
        "ch.disable": true,
      },
      req.avoidBusyRoads === true,
      req.unpavedTargetShare ?? null,
    );
  }

  // Lange lus: waypoints op een cirkel rond de start; seed draait de
  // startrichting zodat best-of-N selectie echt verschillende lussen krijgt.
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
    const ghPoints: [number, number][] = [[req.start.lon, req.start.lat]];
    for (let i = 1; i < nPoints; i++) {
      const angle = backBearing + (dir * (2 * Math.PI * i)) / nPoints;
      const [wLat, wLon] = dest(cLat, cLon, angle, radiusM);
      ghPoints.push([(wLon * 180) / Math.PI, (wLat * 180) / Math.PI]);
    }
    ghPoints.push([req.start.lon, req.start.lat]);
    return this.route(
      req.profile,
      { points: ghPoints },
      req.avoidBusyRoads === true,
      req.unpavedTargetShare ?? null,
    );
  }

  async routePointToPoint(req: PointToPointRequest): Promise<RouteResult> {
    return this.route(
      req.profile,
      {
        points: [
          [req.start.lon, req.start.lat],
          [req.end.lon, req.end.lat],
        ],
      },
      req.avoidBusyRoads === true,
    );
  }

  async routeWaypoints(req: WaypointRequest): Promise<RouteResult> {
    if (req.points.length < 2) {
      throw new Error("Een route heeft minimaal twee punten nodig");
    }
    return this.route(
      req.profile,
      { points: req.points.map((p) => [p.lon, p.lat]) },
      req.avoidBusyRoads === true,
    );
  }

  private hitLabel(h: NonNullable<GhGeocodeResponse["hits"]>[number]): string {
    const parts = [h.name, h.city, h.country].filter(
      (p): p is string => Boolean(p),
    );
    // Ontdubbel (name kan gelijk zijn aan city bij plaatsnamen).
    return [...new Set(parts)].join(", ");
  }

  async geocodeSearch(
    text: string,
    limit = 5,
    focus?: LatLon,
  ): Promise<GeocodeResult[]> {
    try {
      const url = new URL(`${GH_BASE}/geocode`);
      url.searchParams.set("key", this.apiKey());
      url.searchParams.set("q", text);
      url.searchParams.set("locale", "nl");
      url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 10)));
      if (focus) {
        // GraphHopper geocoder: `point` geeft een voorkeurslocatie mee zodat
        // dichtbijgelegen naamgenoten voorop komen (bias, geen filter).
        url.searchParams.set("point", `${focus.lat},${focus.lon}`);
      }
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = (await res.json()) as GhGeocodeResponse;
      const out: GeocodeResult[] = [];
      for (const h of json.hits ?? []) {
        const lat = h.point?.lat;
        const lon = h.point?.lng;
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        // GraphHopper geeft per hit een `extent` [lonMin, latMin, lonMax,
        // latMax] mee voor gebieden (plaats/provincie). Alleen doorgeven als
        // alle vier de getallen echt zijn — geen verzonnen vak.
        const ext = (h as { extent?: unknown }).extent;
        const bbox =
          Array.isArray(ext) &&
          ext.length === 4 &&
          ext.every((v) => typeof v === "number" && Number.isFinite(v))
            ? (ext as [number, number, number, number])
            : undefined;
        out.push({ lat, lon, label: this.hitLabel(h) || text, ...(bbox ? { bbox } : {}) });
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

  async reverseGeocode(point: LatLon): Promise<string | null> {
    try {
      const url = new URL(`${GH_BASE}/geocode`);
      url.searchParams.set("key", this.apiKey());
      url.searchParams.set("reverse", "true");
      url.searchParams.set("point", `${point.lat},${point.lon}`);
      url.searchParams.set("locale", "nl");
      url.searchParams.set("limit", "1");
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as GhGeocodeResponse;
      const h = json.hits?.[0];
      if (!h) return null;
      return h.name ?? this.hitLabel(h) ?? null;
    } catch {
      return null;
    }
  }
}

const UNPAVED_SURFACES_GH = new Set([
  "unpaved",
  "gravel",
  "fine_gravel",
  "dirt",
  "ground",
  "grass",
  "sand",
  "mud",
  "compacted",
  "cobblestone",
  "wood",
  "pebblestone",
]);
