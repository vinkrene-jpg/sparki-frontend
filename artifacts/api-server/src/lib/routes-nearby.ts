// Kaart-eerst routevoorstellen (taak #560, Komoot-opzet): pure, testbare
// filterlaag voor GET /api/routes/nearby. Rangschikt en filtert ALLEEN écht
// bestaande routes uit het eigen corpus (bewaard, gereden kandidaten, plan-
// routes, gedeeld, openbaar) rond een punt — er wordt hier NOOIT iets
// gegenereerd en NOOIT een community-corpus gesuggereerd dat er niet is.
//
// Eerlijkheid over verificatie: dit is een bladerlaag. De fail-closed
// blokkadepoort draait niet per kaartbeweging (dat zou Overpass-bursts en
// koude-cache-leegte geven — zie geheugen "Blokkadepoort koude-cache
// fail-open"), maar blijft verplicht op elk GEBRUIKSPAD (opslaan, navigeren,
// overnemen). Elke geleverde rij draagt daarom expliciet
// `verificatie: "controle_bij_gebruik"` — nooit een stil "geverifieerd".

import type { RoutePathPoint } from "@workspace/db";
import { isLus, minAfstandTotRouteKm } from "./route-search";

// ── Types ────────────────────────────────────────────────────────────────────

export type NearbyBron = "bewaard" | "plan" | "gereden" | "gedeeld" | "openbaar";

export const NEARBY_BRON_LABELS: Record<NearbyBron, string> = {
  bewaard: "Uit je routebibliotheek",
  plan: "Route bij een geplande training",
  gereden: "Uit je eigen ritgeschiedenis",
  gedeeld: "Met jou gedeeld",
  openbaar: "Openbaar gezet door een andere gebruiker",
};

export type NearbyMoeilijkheid = "makkelijk" | "gemiddeld" | "zwaar";
export type NearbyOndergrond = "geen" | "verhard" | "onverhard";
export type NearbyType = "alle" | "lus" | "heenterug";

export type NearbyFilters = {
  center: { lat: number; lon: number };
  radiusKm: number;
  sport: string;
  minKm: number | null;
  maxKm: number | null;
  minHm: number | null;
  maxHm: number | null;
  ondergrond: NearbyOndergrond;
  type: NearbyType;
  moeilijkheid: NearbyMoeilijkheid[] | null; // null = alle
};

// Eén kandidaat-rij uit een corpusbron, vóór filtering.
export type NearbyInput = {
  soort: "route" | "kandidaat";
  id: number;
  bron: NearbyBron;
  naam: string;
  sport: string | null; // null = eerlijk onbekend (oude route)
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  surface: string;
  geometry: RoutePathPoint[] | null;
};

export type NearbyRouteOut = NearbyInput & {
  key: string;
  bronLabel: string;
  isLus: boolean;
  moeilijkheid: NearbyMoeilijkheid | null;
  startAfstandKm: number;
  // Eerlijkheidsveld: deze bladerlaag verifieert niet zelf; de fail-closed
  // blokkadecontrole draait verplicht op elk gebruikspad.
  verificatie: "controle_bij_gebruik";
};

export const NEARBY_DEFAULT_RADIUS_KM = 25;
export const NEARBY_MAX_RADIUS_KM = 100;

// Marge bovenop de straal voor de databankvoorselectie. De voorselectie kijkt
// naar ÁLLE punten van de routegeometrie (niet alleen de start), dus de marge
// hoeft alleen het gat tussen twee opeenvolgende spoorpunten te dekken: een
// segment kan de cirkel raken terwijl beide eindpunten er nét buiten liggen.
// Opgeslagen sporen zijn dicht bemonsterd (meters tot honderden meters tussen
// punten); 25 km is daar een zeer ruime, veilige bovengrens voor. De echte
// afstandscheck (minAfstandTotRouteKm) blijft altijd beslissend.
export const NEARBY_SEGMENT_MARGIN_KM = 25;

// Ophaal-bbox voor de databankvoorselectie: dekt de cirkel (straal + marge)
// volledig, zodat de SQL-voorselectie (bestaat er ÉÉN geometriepunt in deze
// bbox?) nooit een route wegstreept die de beslissende afstandscheck nog had
// kunnen halen.
export function nearbyOphaalBbox(
  center: { lat: number; lon: number },
  radiusKm: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const km = radiusKm + NEARBY_SEGMENT_MARGIN_KM;
  const dLat = km / 111.19;
  const dLon = km / (111.19 * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLon: center.lon - dLon,
    maxLon: center.lon + dLon,
  };
}

// ── Parameter-parsing (ongeldig ⇒ null ⇒ 400 in de route) ────────────────────

function num(v: unknown): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseNearbyFilters(q: {
  [k: string]: unknown;
}): NearbyFilters | null {
  const lat = num(q.lat);
  const lon = num(q.lon);
  if (lat == null || lon == null) return null;
  if (Math.abs(lat) > 75 || Math.abs(lon) > 180) return null;
  const radiusRaw = num(q.radiusKm);
  const radiusKm =
    radiusRaw == null
      ? NEARBY_DEFAULT_RADIUS_KM
      : radiusRaw >= 1 && radiusRaw <= NEARBY_MAX_RADIUS_KM
        ? radiusRaw
        : null;
  if (radiusKm == null) return null;
  const sport =
    typeof q.sport === "string" && q.sport.trim() !== ""
      ? q.sport.trim().toLowerCase()
      : "cycling";
  const ondergrond =
    q.ondergrond == null || q.ondergrond === ""
      ? "geen"
      : q.ondergrond === "geen" ||
          q.ondergrond === "verhard" ||
          q.ondergrond === "onverhard"
        ? (q.ondergrond as NearbyOndergrond)
        : null;
  if (ondergrond == null) return null;
  const type =
    q.type == null || q.type === ""
      ? "alle"
      : q.type === "alle" || q.type === "lus" || q.type === "heenterug"
        ? (q.type as NearbyType)
        : null;
  if (type == null) return null;
  let moeilijkheid: NearbyMoeilijkheid[] | null = null;
  if (typeof q.moeilijkheid === "string" && q.moeilijkheid.trim() !== "") {
    const parts = q.moeilijkheid.split(",").map((s) => s.trim());
    if (
      !parts.every(
        (p): p is NearbyMoeilijkheid =>
          p === "makkelijk" || p === "gemiddeld" || p === "zwaar",
      )
    ) {
      return null;
    }
    moeilijkheid = parts as NearbyMoeilijkheid[];
  }
  const minKm = num(q.minKm);
  const maxKm = num(q.maxKm);
  const minHm = num(q.minHm);
  const maxHm = num(q.maxHm);
  for (const v of [minKm, maxKm, minHm, maxHm]) {
    if (v != null && (v < 0 || v > 100000)) return null;
  }
  return {
    center: { lat, lon },
    radiusKm,
    sport,
    minKm,
    maxKm,
    minHm,
    maxHm,
    ondergrond,
    type,
    moeilijkheid,
  };
}

// ── Afleidingen (deterministisch, gedocumenteerde drempels) ──────────────────

// Indicatieve moeilijkheid uit ECHTE metingen (afstand + hoogtemeters/km).
// Bewust grof en per sportfamilie verschillend; zonder afstand geen oordeel
// (null = eerlijk onbekend, valt nooit stil in een moeilijkheidsfilter).
export function moeilijkheidOf(
  sport: string | null,
  distanceKm: number | null,
  elevationGainM: number | null,
): NearbyMoeilijkheid | null {
  if (distanceKm == null || distanceKm <= 0) return null;
  const hmPerKm =
    elevationGainM != null ? elevationGainM / distanceKm : 0;
  const foot = sport === "walking" || sport === "hiking";
  if (foot) {
    if (distanceKm > 18 || hmPerKm > 30) return "zwaar";
    if (distanceKm < 8 && hmPerKm < 15) return "makkelijk";
    return "gemiddeld";
  }
  if (distanceKm > 85 || hmPerKm > 8) return "zwaar";
  if (distanceKm < 35 && hmPerKm < 4) return "makkelijk";
  return "gemiddeld";
}

// Ondergrondklasse uit het opgeslagen wegdek. "unknown" is eerlijk onbekend en
// valt alleen onder "geen voorkeur" — nooit stilletjes bij verhard of onverhard.
export function ondergrondKlasse(
  surface: string,
): "verhard" | "onverhard" | "onbekend" {
  if (surface === "asfalt") return "verhard";
  if (
    surface === "gravel" ||
    surface === "mtb" ||
    surface === "pad" ||
    surface === "mixed"
  ) {
    return "onverhard";
  }
  return "onbekend";
}

// Past de sport van een rij bij de gevraagde sport? Oude routes zonder
// opgeslagen sport (null) tellen alleen mee bij fietsen: vóór de wandelfamilie
// bestond was elke route hier een fietsroute; de rij houdt sport=null zodat de
// klant "sport onbekend" kan blijven tonen.
export function sportPast(rowSport: string | null, gevraagd: string): boolean {
  if (rowSport == null) return gevraagd === "cycling";
  return rowSport === gevraagd;
}

// ── Filtering ────────────────────────────────────────────────────────────────

// Pas alle filters toe op één corpus-rij. Retourneert de verrijkte uitvoerrij
// of null wanneer de rij niet past. Puur en deterministisch.
export function toNearbyRoute(
  row: NearbyInput,
  f: NearbyFilters,
): NearbyRouteOut | null {
  const geometry = Array.isArray(row.geometry) ? row.geometry : null;
  // Zonder geometrie valt er niets op een kaart te tonen — eerlijk overslaan.
  if (!geometry || geometry.length < 4) return null;
  if (!sportPast(row.sport, f.sport)) return null;

  // Beslissende afstandscheck over de HELE lijn — bewust géén aparte
  // startpunt-afwijzing: een route kan ver van zijn startpunt vlak langs het
  // centrum lopen en telt dan gewoon mee.
  const startAfstandKm = minAfstandTotRouteKm(f.center, geometry);
  if (startAfstandKm > f.radiusKm) return null;

  if (f.minKm != null && (row.distanceKm == null || row.distanceKm < f.minKm))
    return null;
  if (f.maxKm != null && (row.distanceKm == null || row.distanceKm > f.maxKm))
    return null;
  if (
    f.minHm != null &&
    (row.elevationGainM == null || row.elevationGainM < f.minHm)
  )
    return null;
  if (
    f.maxHm != null &&
    (row.elevationGainM == null || row.elevationGainM > f.maxHm)
  )
    return null;

  if (f.ondergrond !== "geen") {
    // Streng: alleen rijen waarvan de klasse écht bekend is en past.
    if (ondergrondKlasse(row.surface) !== f.ondergrond) return null;
  }

  const lus = isLus(geometry);
  if (f.type === "lus" && !lus) return null;
  if (f.type === "heenterug" && lus) return null;

  const moeilijkheid = moeilijkheidOf(
    row.sport ?? f.sport,
    row.distanceKm,
    row.elevationGainM,
  );
  if (f.moeilijkheid != null) {
    // Onbekende moeilijkheid (geen afstand) valt eerlijk af zodra er op
    // moeilijkheid gefilterd wordt — nooit stil doorlaten.
    if (moeilijkheid == null || !f.moeilijkheid.includes(moeilijkheid)) {
      return null;
    }
  }

  return {
    ...row,
    geometry,
    key: `${row.soort}-${row.id}`,
    bronLabel: NEARBY_BRON_LABELS[row.bron],
    isLus: lus,
    moeilijkheid,
    startAfstandKm,
    verificatie: "controle_bij_gebruik",
  };
}

// Sorteer: dichtstbij eerst; bij gelijke afstand eigen bronnen vóór gedeeld/
// openbaar, daarna stabiel op sleutel (deterministisch).
const BRON_VOLGORDE: Record<NearbyBron, number> = {
  gereden: 0,
  bewaard: 1,
  plan: 2,
  gedeeld: 3,
  openbaar: 4,
};

export function sortNearby(routes: NearbyRouteOut[]): NearbyRouteOut[] {
  return [...routes].sort(
    (a, b) =>
      a.startAfstandKm - b.startAfstandKm ||
      BRON_VOLGORDE[a.bron] - BRON_VOLGORDE[b.bron] ||
      a.key.localeCompare(b.key),
  );
}
