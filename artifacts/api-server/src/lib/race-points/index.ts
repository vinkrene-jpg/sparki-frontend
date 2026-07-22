// Wedstrijdpunten — deterministische kern van het centrale wedstrijdmodel.
// AI (documentanalyse) doet alleen interpretatie en levert kandidaat-punten;
// alles hier is pure, controleerbare code: coercie/validatie van kandidaten,
// kind → klasse, statusovergangen en actieve-puntselectie. Geen enkele functie
// verzint een locatie, kilometer of gevaar.

import {
  racePointKinds,
  racePointStatuses,
  type CandidateRacePoint,
  type RacePoint,
  type RacePointClass,
  type RacePointKind,
  type RacePointStatus,
} from "@workspace/db";

// Kind → technische klasse. Routevormingspunten (A) en navigatiemanoeuvres (B)
// leven in routes.waypoints/routes.nav en komen hier nooit binnen.
const WEDSTRIJD_KINDS: ReadonlySet<string> = new Set([
  "start",
  "neutralisatie_einde",
  "sprint",
  "bergprijs",
  "laatste_km",
  "lokale_ronde",
  "finish",
]);

export function kindToClass(kind: RacePointKind): RacePointClass {
  return WEDSTRIJD_KINDS.has(kind) ? "wedstrijd" : "info";
}

export function isRacePointKind(v: unknown): v is RacePointKind {
  return typeof v === "string" && (racePointKinds as readonly string[]).includes(v);
}

export function isRacePointStatus(v: unknown): v is RacePointStatus {
  return (
    typeof v === "string" && (racePointStatuses as readonly string[]).includes(v)
  );
}

// Nederlandse standaardlabels per kind (voor kandidaten zonder eigen label).
export const KIND_LABELS: Record<RacePointKind, string> = {
  start: "Officiële start",
  neutralisatie_einde: "Einde neutralisatie",
  sprint: "Tussensprint",
  bergprijs: "Bergprijs",
  bevoorrading: "Bevoorrading",
  afvalzone: "Afvalzone",
  gevaar: "Gevaarlijk punt",
  wegdek: "Slecht wegdek",
  spoorwegovergang: "Spoorwegovergang",
  laatste_km: "Laatste kilometer",
  lokale_ronde: "Lokale ronde",
  finish: "Finish",
  info: "Wedstrijdinfo",
};

function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Strikte coercie van model-uitvoer naar kandidaat-punten. Alles wat niet
// letterlijk klopt (onbekend kind, lege omschrijving, ongeldige getallen)
// wordt weggelaten — nooit "gerepareerd" met een verzonnen waarde.
export function coerceCandidatePoints(raw: unknown): CandidateRacePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: CandidateRacePoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!isRacePointKind(r.kind)) continue;
    const description =
      typeof r.description === "string" && r.description.trim()
        ? r.description.trim().slice(0, 500)
        : null;
    if (!description) continue;
    const page = r.page;
    const km = finiteOrNull(r.km ?? r.raceKm);
    const lat = finiteOrNull(r.lat);
    const lng = finiteOrNull(r.lng ?? r.lon);
    // Coördinaten alleen als BEIDE aanwezig en plausibel zijn.
    const hasCoords =
      lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    out.push({
      kind: r.kind,
      description,
      page:
        typeof page === "number" && Number.isInteger(page) && page >= 1
          ? page
          : null,
      raceKm: km != null && km >= 0 && km < 5000 ? Math.round(km * 100) / 100 : null,
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      confidence:
        r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
          ? r.confidence
          : null,
    });
    if (out.length >= 80) break; // harde bovengrens tegen ontspoorde uitvoer
  }
  return out;
}

// Kandidaat → insert-waarden voor race_points (status altijd "voorgesteld";
// activatie gebeurt uitsluitend door de renner/trainer op de kaart).
export function candidateToInsert(
  c: CandidateRacePoint,
  ctx: { raceId: number; clerkId: string; analysisId: number; fileName: string },
) {
  return {
    raceId: ctx.raceId,
    clerkId: ctx.clerkId,
    kind: c.kind,
    pointClass: kindToClass(c.kind),
    label: KIND_LABELS[c.kind],
    description: c.description,
    sourceAnalysisId: ctx.analysisId,
    sourceFile: ctx.fileName,
    sourcePage: c.page,
    raceKm: c.raceKm,
    lat: c.lat,
    lng: c.lng,
    confidence: c.confidence,
    status: "voorgesteld" as const,
  };
}

// Alleen door de renner bevestigde of aangepaste punten zijn actief —
// voorgesteld/afgewezen doet nooit mee in wedstrijdmodus of live weergave.
export function activeRacePoints<T extends Pick<RacePoint, "status">>(
  points: T[],
): T[] {
  return points.filter((p) => p.status === "bevestigd" || p.status === "aangepast");
}

// Toegestane statusovergangen vanaf de kaartcontrole. Vanuit iedere status mag
// bevestigd/aangepast/afgewezen gekozen worden; terug naar "voorgesteld" kan
// niet (een menselijke beslissing wordt nooit stilletjes ongedaan gemaakt).
export function isAllowedStatusChange(next: RacePointStatus): boolean {
  return next !== "voorgesteld";
}

// Locatiestatus voor de UI: een punt zonder wedstrijdkilometer én zonder
// coördinaten is niet op de kaart te zetten.
export function locationConfirmed(
  p: Pick<RacePoint, "raceKm" | "lat" | "lng">,
): boolean {
  return p.raceKm != null || (p.lat != null && p.lng != null);
}

// --- Deterministische route-koppeling -------------------------------------

type LatLng = [number, number];

const EARTH_R = 6371000;
function haversineM(a: LatLng, b: LatLng): number {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Cumulatieve kilometers per geometriepunt.
export function cumulativeKm(geometry: LatLng[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cum.push(cum[i - 1]! + haversineM(geometry[i - 1]!, geometry[i]!) / 1000);
  }
  return cum;
}

// Snap coördinaten op de routelijn → wedstrijdkilometer. Eerlijk: levert null
// wanneer het punt verder dan maxOffM van de route ligt (dan is de gids-locatie
// niet op dit parcours te bevestigen).
export function snapToRouteKm(
  geometry: LatLng[],
  lat: number,
  lng: number,
  maxOffM = 250,
): number | null {
  if (geometry.length < 2) return null;
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < geometry.length; i++) {
    const d = haversineM(geometry[i]!, [lat, lng]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx === -1 || bestDist > maxOffM) return null;
  const cum = cumulativeKm(geometry);
  return Math.round(cum[bestIdx]! * 100) / 100;
}
