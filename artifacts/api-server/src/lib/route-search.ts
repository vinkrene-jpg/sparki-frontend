// Zoeklaag voor routeaanvragen (taak #512, opdracht René 31-07-2026 §4–6):
// bij een routevraag eerst zoeken in de EIGEN bekende routes — (1) eerder
// gereden routes uit de ritgeschiedenis, (2) bewust opgeslagen routes,
// (3) toegestane gedeelde routes — en pas daarna nieuwe Sparki-generatie.
//
// Dit is uitdrukkelijk GEEN parallelle routemotor: deze laag rangschikt alleen
// écht bestaande, opgeslagen routes op meetbare criteria (startplaats,
// afstand/tijd, hoogte, fietssoort/ondergrond, lus-of-A-B) en levert per
// voorstel een eerlijke motivering op basis van die metingen. Nieuwe
// voorstellen blijven uit de bestaande generator komen.
//
// Fail-closed verificatie: élke geleverde bekende route gaat vóór levering
// door dezelfde blokkademeting als een nieuw gegenereerde route
// (verifyKnownRoutes). Een route over een inmiddels geblokkeerde weg wordt
// gemarkeerd als geblokkeerd en is niet bruikbaar; een route waarvan de meting
// definitief mislukt is "niet controleerbaar" en evenmin bruikbaar. Nooit
// stilletjes een ongecontroleerde route aanbieden.

import type { RoutePathPoint } from "@workspace/db";

// ── Types ────────────────────────────────────────────────────────────────────

export type KnownRouteOrigin = "gereden" | "bewaard" | "gedeeld";

export const KNOWN_ROUTE_ORIGIN_LABELS: Record<KnownRouteOrigin, string> = {
  gereden: "Eerder door jou gereden",
  bewaard: "Uit je routebibliotheek",
  gedeeld: "Met jou gedeeld",
};

// Een kandidaat-rij uit de database (eigen of gedeelde route), al ontdaan van
// alles wat de aanvrager niet mag zien (gedeelde routes: geometrie is de
// veilige, privacy-getransformeerde kijkersweergave).
export type KnownRouteRow = {
  id: number;
  name: string;
  source: string;
  linkedActivityImportId: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  surface: string;
  favorite: boolean;
  geometry: RoutePathPoint[] | null;
  // "eigen" = rij van de aanvrager zelf; "gedeeld" = met de aanvrager gedeeld.
  ownership: "eigen" | "gedeeld";
  gedeeldVia?: string | null;
};

export type KnownRouteQuery = {
  start: { lat: number; lon: number };
  targetDistanceKm: number;
  mode: "loop" | "ptp";
  bikeType: string | null; // racefiets | gravel | mtb | null
  elevationPreference: "flat" | "hilly" | "any";
  // Gewenst aandeel onverhard (0..1) — alleen gravel/MTB, anders null.
  unpavedTargetShare: number | null;
  trainingType: string | null;
};

export type KnownRouteMatch = {
  routeId: number;
  name: string;
  origin: KnownRouteOrigin;
  originLabel: string;
  ownership: "eigen" | "gedeeld";
  gedeeldVia: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  surface: string;
  geometry: RoutePathPoint[];
  // Waarom deze route past — alleen zinnen op basis van echte metingen.
  matchReasons: string[];
  // Afstand van jouw startpunt tot het dichtstbijzijnde punt van de route.
  startAfstandKm: number;
  score: number;
};

export type KnownRouteVerification =
  | { status: "geverifieerd" }
  | {
      status: "geblokkeerd";
      reden: string;
      blockage: { forbidden: number; steps: number; blockedGates: number };
    }
  | { status: "niet_controleerbaar"; reden: string };

export type VerifiedKnownRoute = KnownRouteMatch & {
  verificatie: KnownRouteVerification;
  // Alleen een geverifieerde route is bruikbaar als voorstel.
  bruikbaar: boolean;
};

// ── Meetlat-constanten (bewust expliciet, testbaar) ──────────────────────────

// Maximale afstand van het gevraagde startpunt tot de route om nog "in de
// buurt" te heten. Verder weg past de route niet bij deze aanvraag.
export const MAX_START_AFSTAND_KM = 15;
// Toegestane afwijking van de gevraagde afstand (aandeel van het doel).
export const MAX_AFSTAND_AFWIJKING = 0.35;
// Een lus: begin- en eindpunt liggen hemelsbreed binnen deze afstand.
export const LUS_SLUIT_KM = 1.5;
// Hoeveel bekende routes we maximaal voorstellen (opdracht: 3–5 bestaande).
export const MAX_BEKENDE_VOORSTELLEN = 5;
// Hoeveel gerangschikte kandidaten we maximaal aan de blokkadeverificatie
// aanbieden: de limiet van 5 geldt voor BRUIKBARE voorstellen, ná verificatie.
// Zou de limiet vóór verificatie liggen, dan kon een lager gerangschikte maar
// schone route nooit meer voorgesteld worden zodra de top-5 geblokkeerd bleek.
export const MAX_VERIFICATIE_KANDIDATEN = 12;

// ── Meetkunde ────────────────────────────────────────────────────────────────

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Kleinste hemelsbrede afstand van een punt tot de routepunten (bemonsterd —
// ruim voldoende voor "start in de buurt", geen segment-projectie nodig).
export function minAfstandTotRouteKm(
  start: { lat: number; lon: number },
  geometry: RoutePathPoint[],
): number {
  let best = Infinity;
  const step = Math.max(1, Math.floor(geometry.length / 200));
  for (let i = 0; i < geometry.length; i += step) {
    const p = geometry[i]!;
    const d = haversineKm(start.lat, start.lon, Number(p[0]), Number(p[1]));
    if (d < best) best = d;
  }
  // Eindpunt altijd meenemen.
  const last = geometry[geometry.length - 1]!;
  best = Math.min(
    best,
    haversineKm(start.lat, start.lon, Number(last[0]), Number(last[1])),
  );
  return best;
}

export function isLus(geometry: RoutePathPoint[]): boolean {
  if (geometry.length < 4) return false;
  const a = geometry[0]!;
  const b = geometry[geometry.length - 1]!;
  return (
    haversineKm(Number(a[0]), Number(a[1]), Number(b[0]), Number(b[1])) <=
    LUS_SLUIT_KM
  );
}

// ── Herkomstbepaling ─────────────────────────────────────────────────────────

export function classifyOrigin(row: KnownRouteRow): KnownRouteOrigin {
  if (row.ownership === "gedeeld") return "gedeeld";
  // Ritgeschiedenis: routes die aantoonbaar uit een echte rit komen.
  if (row.source === "ridden" || row.linkedActivityImportId != null) {
    return "gereden";
  }
  return "bewaard";
}

// ── Wegdek/fietssoort-verenigbaarheid ────────────────────────────────────────

// Past het opgeslagen wegdek bij de gevraagde fietssoort? Eerlijk streng voor
// de racefiets (harde 0%-onverhard-grens elders in het systeem): alleen
// asfalt-routes gelden als passend; "unknown" mag wél voorgesteld worden maar
// wordt door de bestaande racefiets-verificatie in de klant-kant eerlijk als
// niet-volledig-geverifieerd gemarkeerd.
export function surfacePastBijFiets(
  surface: string,
  bikeType: string | null,
): boolean {
  if (bikeType === "racefiets") {
    return surface === "asfalt" || surface === "unknown";
  }
  // Gravel/MTB/onbekend fietstype: alle ondergronden bespreekbaar.
  return true;
}

// ── Gedeelde routes: fail-closed rijbouw ─────────────────────────────────────

// Bouw de zoek-rij voor een gedeelde route. FAIL-CLOSED op het huisadres van
// de eigenaar: zonder bekend huisadres kan er geen veilige kijkersgeometrie
// (privacyzone + afgeschermde start/einde) gegarandeerd worden ⇒ de route
// doet dan helemaal niet mee aan de zoeklaag (null, en de geometrie-transform
// wordt niet eens aangeroepen). Alleen bij een bekend huisadres wordt de
// privacy-getransformeerde kijkersgeometrie gebruikt — nooit de ruwe.
export function sharedKnownRouteRow(
  route: {
    id: number;
    name: string;
    source: string;
    distanceKm: number | null;
    elevationGainM: number | null;
    durationSec: number | null;
    surface: string;
  },
  gedeeldVia: string | null,
  ownerHome: { lat: number; lon: number } | null,
  toViewerGeometry: () => RoutePathPoint[] | null,
): KnownRouteRow | null {
  if (ownerHome == null) return null;
  const geometry = toViewerGeometry();
  if (!Array.isArray(geometry) || geometry.length < 4) return null;
  return {
    id: route.id,
    name: route.name,
    source: route.source,
    linkedActivityImportId: null,
    distanceKm: route.distanceKm,
    elevationGainM: route.elevationGainM,
    durationSec: route.durationSec,
    surface: route.surface,
    favorite: false,
    geometry,
    ownership: "gedeeld",
    gedeeldVia,
  };
}

// ── Rangschikking ────────────────────────────────────────────────────────────

function fmtKm(v: number): string {
  return v < 10 ? v.toFixed(1).replace(".", ",") : String(Math.round(v));
}

// Rangschik bekende routes op de zoekcriteria. Puur en deterministisch:
// dezelfde rijen + dezelfde vraag = hetzelfde antwoord. Retourneert maximaal
// MAX_BEKENDE_VOORSTELLEN passende routes, beste eerst.
export function rankKnownRoutes(
  rows: KnownRouteRow[],
  query: KnownRouteQuery,
): KnownRouteMatch[] {
  const matches: KnownRouteMatch[] = [];
  for (const row of rows) {
    const geometry = Array.isArray(row.geometry)
      ? (row.geometry as RoutePathPoint[])
      : null;
    // Zonder geometrie valt er niets te verifiëren én niets te navigeren —
    // eerlijk overslaan (nooit een onverifieerbare route voorstellen).
    if (!geometry || geometry.length < 4) continue;
    if (row.distanceKm == null || row.distanceKm <= 0) continue;

    // Lus-of-A-B moet overeenkomen met de aanvraag.
    const lus = isLus(geometry);
    if (query.mode === "loop" && !lus) continue;
    if (query.mode === "ptp" && lus) continue;

    // Startplaats: de route moet in de buurt van het startpunt liggen.
    const startAfstandKm = minAfstandTotRouteKm(query.start, geometry);
    if (startAfstandKm > MAX_START_AFSTAND_KM) continue;

    // Afstand: binnen de toegestane afwijking van het doel.
    const afwijking =
      Math.abs(row.distanceKm - query.targetDistanceKm) /
      query.targetDistanceKm;
    if (afwijking > MAX_AFSTAND_AFWIJKING) continue;

    // Fietssoort/ondergrond.
    if (!surfacePastBijFiets(row.surface, query.bikeType)) continue;

    // Hoogtevoorkeur: alleen scoren als de route echte hoogtemeters heeft.
    const hmPerKm =
      row.elevationGainM != null && row.distanceKm > 0
        ? row.elevationGainM / row.distanceKm
        : null;
    if (query.elevationPreference === "flat" && hmPerKm != null && hmPerKm > 8)
      continue;
    if (query.elevationPreference === "hilly" && hmPerKm != null && hmPerKm < 6)
      continue;

    const origin = classifyOrigin(row);

    // Motivering: alleen zinnen op basis van echte metingen.
    const matchReasons: string[] = [];
    matchReasons.push(
      startAfstandKm <= 0.5
        ? "Start vrijwel op je gekozen startpunt"
        : `Loopt op ${fmtKm(startAfstandKm)} km van je startpunt`,
    );
    matchReasons.push(
      `${fmtKm(row.distanceKm)} km — dicht bij de gevraagde ${fmtKm(query.targetDistanceKm)} km`,
    );
    if (query.elevationPreference === "flat" && hmPerKm != null) {
      matchReasons.push("Vlak genoeg voor je vlakke voorkeur");
    } else if (query.elevationPreference === "hilly" && hmPerKm != null) {
      matchReasons.push(
        `${Math.round(row.elevationGainM!)} hoogtemeters — past bij je klimvoorkeur`,
      );
    }
    if (origin === "gereden") {
      matchReasons.push("Je kent deze route al uit een eerdere rit");
    } else if (origin === "bewaard" && row.favorite) {
      matchReasons.push("Staat als favoriet in je bibliotheek");
    }

    // Score: dichterbij + kleinere afstandsafwijking = beter; eigen gereden
    // routes vóór bewaard, bewaard vóór gedeeld (opdrachtvolgorde §4).
    const originBonus =
      origin === "gereden" ? 0.3 : origin === "bewaard" ? 0.15 : 0;
    const score =
      1 -
      Math.min(startAfstandKm / MAX_START_AFSTAND_KM, 1) * 0.4 -
      Math.min(afwijking / MAX_AFSTAND_AFWIJKING, 1) * 0.3 +
      originBonus +
      (row.favorite ? 0.05 : 0);

    matches.push({
      routeId: row.id,
      name: row.name,
      origin,
      originLabel: KNOWN_ROUTE_ORIGIN_LABELS[origin],
      ownership: row.ownership,
      gedeeldVia: row.gedeeldVia ?? null,
      distanceKm: row.distanceKm,
      elevationGainM: row.elevationGainM,
      durationSec: row.durationSec,
      surface: row.surface,
      geometry,
      matchReasons,
      startAfstandKm,
      score,
    });
  }
  matches.sort((a, b) => b.score - a.score || a.routeId - b.routeId);
  // Ruime kandidatenlijst: de eindlimiet (MAX_BEKENDE_VOORSTELLEN) wordt pas
  // NA de blokkadeverificatie toegepast, op de bruikbare voorstellen.
  return matches.slice(0, MAX_VERIFICATIE_KANDIDATEN);
}

// ── Fail-closed verificatie ──────────────────────────────────────────────────

// Dezelfde blokkademeting als bij nieuwe generatie (route-remarks
// routeObstaclesOf zonder budget = blokkerend wachten op een echte meting).
// obs == null ⇒ meting definitief mislukt ⇒ "niet controleerbaar" en NIET
// bruikbaar (fail-closed, taak #505). Blokkade gevonden ⇒ gemarkeerd
// "geblokkeerd" en niet bruikbaar, mét de eerlijke reden.
export async function verifyKnownRoutes(
  matches: KnownRouteMatch[],
  obstaclesOf: (
    path: RoutePathPoint[],
  ) => Promise<{
    forbidden: number;
    steps: number;
    blockedGates: number;
  } | null>,
  opts?: { maxBruikbaar?: number },
): Promise<VerifiedKnownRoute[]> {
  const maxBruikbaar = opts?.maxBruikbaar ?? Infinity;
  const out: VerifiedKnownRoute[] = [];
  let bruikbaarCount = 0;
  for (const m of matches) {
    // Genoeg bruikbare voorstellen gevonden — verdere (duurdere) metingen
    // overslaan. Ongemeten kandidaten worden simpelweg niet geleverd; er
    // verschijnt nooit een route zonder uitgevoerde meting.
    if (bruikbaarCount >= maxBruikbaar) break;
    let verificatie: KnownRouteVerification;
    try {
      const obs = await obstaclesOf(m.geometry);
      if (obs == null) {
        verificatie = {
          status: "niet_controleerbaar",
          reden:
            "De blokkademeting gaf geen antwoord — deze bekende route is nu niet controleerbaar en wordt daarom niet aangeboden om te rijden.",
        };
      } else if (obs.forbidden > 0 || obs.steps > 0 || obs.blockedGates > 0) {
        verificatie = {
          status: "geblokkeerd",
          reden:
            "Deze route loopt inmiddels over een harde blokkade (fietsverbod, trap of afgesloten poort/privéterrein) en wordt daarom niet aangeboden.",
          blockage: obs,
        };
      } else {
        verificatie = { status: "geverifieerd" };
      }
    } catch {
      verificatie = {
        status: "niet_controleerbaar",
        reden:
          "De blokkademeting mislukte — deze bekende route is nu niet controleerbaar en wordt daarom niet aangeboden om te rijden.",
      };
    }
    const bruikbaar = verificatie.status === "geverifieerd";
    if (bruikbaar) bruikbaarCount += 1;
    out.push({ ...m, verificatie, bruikbaar });
  }
  return out;
}

// ── Hybride voorstel ─────────────────────────────────────────────────────────

// Via-punten voor een hybride variant: de eerste helft van de bekende route
// wordt gevolgd (bemonsterd op vaste fracties), de terugweg wordt door de
// motor opnieuw gepland én — zoals elke route — fail-closed geverifieerd.
// Deterministisch: zelfde basisroute = zelfde via-punten.
export const HYBRIDE_VIA_FRACTIES = [0.18, 0.34, 0.5] as const;

export function hybrideViaPunten(
  geometry: RoutePathPoint[],
): { lat: number; lon: number }[] {
  if (!Array.isArray(geometry) || geometry.length < 4) return [];
  return HYBRIDE_VIA_FRACTIES.map((f) => {
    const idx = Math.min(
      geometry.length - 1,
      Math.max(0, Math.round(f * (geometry.length - 1))),
    );
    const p = geometry[idx]!;
    return { lat: Number(p[0]), lon: Number(p[1]) };
  });
}
