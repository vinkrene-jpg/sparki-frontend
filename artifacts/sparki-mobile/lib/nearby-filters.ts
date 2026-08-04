// Kaart-eerst routevoorstellen (taak #561, mobiele evenknie van web-taak #560):
// client-side filterlaag over de lijst uit GET /api/routes/nearby, zodat de
// teller live is zonder server-bursts. De semantiek spiegelt bewust de
// webcomponent (route-kaart-start.tsx) én de serverlaag (lib/routes-nearby.ts):
// "onbekend" telt alleen mee bij "geen voorkeur" — nooit stil bij een klasse
// gerekend, en zodra er op moeilijkheid gefilterd wordt valt "onbekend" af.

export type NearbySport = "cycling" | "walking" | "hiking";

export type NearbyMoeilijkheid = "makkelijk" | "gemiddeld" | "zwaar";

export type NearbyRoute = {
  key: string;
  soort: "route" | "kandidaat";
  id: number;
  bron: "bewaard" | "plan" | "gereden" | "gedeeld" | "openbaar";
  bronLabel: string;
  naam: string;
  sport: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  surface: string;
  isLus: boolean;
  moeilijkheid: NearbyMoeilijkheid | null;
  startAfstandKm: number;
  geometry: [number, number][];
  verificatie: "controle_bij_gebruik";
};

export type NearbyRoutesResponse = {
  sport: string;
  radiusKm: number;
  /** Totaal aantal matches op de server (kan groter zijn dan `routes`). */
  total: number;
  /** true = de lijst is afgekapt op het payload-plafond (dichtstbij eerst). */
  afgekapt: boolean;
  corpusNote: string;
  verificatieNote: string;
  routes: NearbyRoute[];
};

export type NearbyFilters = {
  minKm: number | null;
  maxKm: number | null;
  minHm: number | null;
  maxHm: number | null;
  ondergrond: "geen" | "verhard" | "onverhard";
  type: "alle" | "lus" | "heenterug";
  moeilijkheid: Record<NearbyMoeilijkheid, boolean>;
};

export const NEARBY_FILTERS_LEEG: NearbyFilters = {
  minKm: null,
  maxKm: null,
  minHm: null,
  maxHm: null,
  ondergrond: "geen",
  type: "alle",
  moeilijkheid: { makkelijk: true, gemiddeld: true, zwaar: true },
};

export function nearbyFiltersActief(f: NearbyFilters): boolean {
  return (
    f.minKm != null ||
    f.maxKm != null ||
    f.minHm != null ||
    f.maxHm != null ||
    f.ondergrond !== "geen" ||
    f.type !== "alle" ||
    !f.moeilijkheid.makkelijk ||
    !f.moeilijkheid.gemiddeld ||
    !f.moeilijkheid.zwaar
  );
}

// Zelfde ondergrondklasse als de server (lib/routes-nearby): "unknown" telt
// alleen mee bij "geen voorkeur".
export function ondergrondKlasse(
  surface: string,
): "verhard" | "onverhard" | "onbekend" {
  if (surface === "asfalt") return "verhard";
  if (["gravel", "mtb", "pad", "mixed"].includes(surface)) return "onverhard";
  return "onbekend";
}

export function pasNearbyFilters(
  routes: NearbyRoute[],
  f: NearbyFilters,
): NearbyRoute[] {
  return routes.filter((r) => {
    if (f.minKm != null && (r.distanceKm == null || r.distanceKm < f.minKm))
      return false;
    if (f.maxKm != null && (r.distanceKm == null || r.distanceKm > f.maxKm))
      return false;
    if (
      f.minHm != null &&
      (r.elevationGainM == null || r.elevationGainM < f.minHm)
    )
      return false;
    if (
      f.maxHm != null &&
      (r.elevationGainM == null || r.elevationGainM > f.maxHm)
    )
      return false;
    if (f.ondergrond !== "geen" && ondergrondKlasse(r.surface) !== f.ondergrond)
      return false;
    if (f.type === "lus" && !r.isLus) return false;
    if (f.type === "heenterug" && r.isLus) return false;
    const alle =
      f.moeilijkheid.makkelijk &&
      f.moeilijkheid.gemiddeld &&
      f.moeilijkheid.zwaar;
    if (!alle) {
      // Zodra er op moeilijkheid gefilterd wordt, valt "onbekend" eerlijk af.
      if (r.moeilijkheid == null || !f.moeilijkheid[r.moeilijkheid])
        return false;
    }
    return true;
  });
}
