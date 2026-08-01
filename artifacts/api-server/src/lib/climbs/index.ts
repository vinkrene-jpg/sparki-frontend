// Klimmenverkenner orchestration: turns the raw sources (Overpass catalogue,
// Nominatim geocoding, routing-provider profile derivation, Wikipedia/Wikidata
// enrichment) into the honest search + detail results the API serves. Every
// value comes from a real source or is explicitly reported as missing.

import { geocodeArea } from "./geocode";
import {
  fetchClimbHitsRaw,
  presentClimbHits,
  fetchClimbTags,
  fetchRoadGeometry,
  type ClimbHit,
} from "./overpass";
import { cacheGetDb, cachePutDb } from "./cache";
import type { GeoArea } from "./geocode";
import {
  deriveClimbProfile,
  deriveRoadClimbProfile,
  type DerivedClimbProfile,
} from "./profile";
import { enrichDescription, type ClimbDescription } from "./enrich";

export type ClimbSearchResult = {
  area: { label: string; lat: number; lon: number } | null;
  // De werkelijk gebruikte (geklemde) zoekstraal in km.
  radiusKm: number;
  climbs: ClimbHit[];
};

export type ClimbDetail = {
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  elevationM: number | null;
  kind: "pass" | "peak" | "road";
  description: ClimbDescription;
  profile: DerivedClimbProfile | null;
  // Honest reason the derived profile is absent, when it is.
  profileUnavailableReason: string | null;
};

export class ClimbSourceError extends Error {
  constructor(
    message: string,
    readonly reason: "area_not_found" | "unreachable" | "not_found",
  ) {
    super(message);
    this.name = "ClimbSourceError";
  }
}

// Zoekstraal in km rond het gevonden gebiedscentrum. Instelbaar door de
// gebruiker; geklemd zodat de Overpass-query nooit ontspoort.
const MIN_RADIUS_KM = 2;
const MAX_RADIUS_KM = 60;
export const DEFAULT_RADIUS_KM = 15;

// TTL's van de DB-cache. Klimtoppen/klimwegen veranderen zelden — een paar
// dagen cache is eerlijk; daarna volgt automatisch een verse echte Overpass-
// fetch. Geocoderesultaten (plaats → coördinaten) zijn nog stabieler.
const CLIMB_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 dagen
const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen

export async function searchClimbs(opts: {
  q: string;
  name?: string | null;
  limit?: number;
  radiusKm?: number | null;
  // Direct zoeken rond bekende coördinaten (bv. de startlocatie in Route
  // maken) — slaat de geocodeerstap over. `q` mag dan leeg zijn; het label
  // wordt alleen voor presentatie gebruikt.
  at?: { lat: number; lon: number; label?: string | null } | null;
}): Promise<ClimbSearchResult> {
  // 1. Gebied bepalen — met DB-cache op de genormaliseerde zoekterm zodat een
  //    herhaalde zoekopdracht ook Nominatim overslaat. Alleen échte successen
  //    worden gecachet; "niet gevonden" blijft altijd een live antwoord.
  let area: GeoArea;
  if (opts.at) {
    // Punt-gebied: de echte zoek-bbox wordt hieronder uit de straal berekend;
    // de eigen bbox van dit "gebied" is dus gewoon het punt zelf.
    area = {
      label: opts.at.label?.trim() || "startlocatie",
      lat: opts.at.lat,
      lon: opts.at.lon,
      south: opts.at.lat,
      west: opts.at.lon,
      north: opts.at.lat,
      east: opts.at.lon,
    };
  } else {
    const geoKey = `geo:${opts.q.trim().toLowerCase()}`;
    let found = await cacheGetDb<GeoArea>(geoKey, GEOCODE_CACHE_TTL_MS);
    if (!found) {
      found = await geocodeArea(opts.q).catch(() => {
        throw new ClimbSourceError("geocode_unreachable", "unreachable");
      });
      if (!found) {
        throw new ClimbSourceError("area_not_found", "area_not_found");
      }
      await cachePutDb(geoKey, found);
    }
    area = found;
  }
  // Echte straal rond het centrum — de bbox van de plaats zelf is voor een
  // dorpskern veel te klein (dan vind je rond Valkenburg bijna niets).
  const radiusKm = Math.min(
    Math.max(opts.radiusKm ?? DEFAULT_RADIUS_KM, MIN_RADIUS_KM),
    MAX_RADIUS_KM,
  );
  const halfLat = radiusKm / 111;
  const halfLon =
    radiusKm / (111 * Math.max(Math.cos((area.lat * Math.PI) / 180), 0.2));

  // 2. Overpass-catalogus — DB-cache per (afgerond centrum, straal). Het
  //    naamfilter en de limiet worden pas bij presentatie toegepast, zodat één
  //    gecachet gebied alle varianten van de zoekopdracht direct bedient.
  const areaKey = `climbs:${area.lat.toFixed(3)},${area.lon.toFixed(3)}:r${radiusKm}`;
  let rawHits = await cacheGetDb<ClimbHit[]>(areaKey, CLIMB_CACHE_TTL_MS);
  if (!rawHits) {
    rawHits = await fetchClimbHitsRaw({
      south: area.lat - halfLat,
      west: area.lon - halfLon,
      north: area.lat + halfLat,
      east: area.lon + halfLon,
    }).catch(() => {
      throw new ClimbSourceError("overpass_unreachable", "unreachable");
    });
    await cachePutDb(areaKey, rawHits);
  }
  const climbs = presentClimbHits(rawHits, {
    nameFilter: opts.name ?? null,
    limit: opts.limit,
  });
  return {
    area: { label: area.label, lat: area.lat, lon: area.lon },
    radiusKm,
    climbs,
  };
}

export async function climbDetail(osmId: string): Promise<ClimbDetail> {
  const info = await fetchClimbTags(osmId).catch(() => {
    throw new ClimbSourceError("overpass_unreachable", "unreachable");
  });
  if (!info) {
    throw new ClimbSourceError("not_found", "not_found");
  }
  const { tags, lat, lon } = info;
  const name = tags.name?.trim() || "Onbekende klim";
  const kind: "pass" | "peak" | "road" =
    tags.mountain_pass === "yes" || tags.mountain_pass === "1"
      ? "pass"
      : tags.highway
        ? "road"
        : "peak";
  const elevationM = parseEle(tags.ele);

  // Description + derived profile are independent; run them in parallel and let
  // each degrade honestly on its own.
  //
  // Road climbs (klimwegen zoals de Cauberg) krijgen hun profiel uit de ECHTE
  // weggeometrie zelf — een route-trace naar het way-center kan vele malen
  // langer en vlakker uitvallen dan de echte klim. Passen/toppen behouden het
  // bestaande trace-gedrag. Mislukt het weggeometrie-pad, dan tonen we de
  // eerlijke "geen profiel"-staat; er wordt nooit iets gefabriceerd.
  const profilePromise =
    kind === "road"
      ? fetchRoadGeometry({ name, lat, lon })
          .then((segments) => deriveRoadClimbProfile(segments))
          .catch(() => null)
      : deriveClimbProfile({ lat, lon, elevationM }).catch(() => null);
  const [description, profile] = await Promise.all([
    enrichDescription(tags).catch(() => null),
    profilePromise,
  ]);

  let profileUnavailableReason: string | null = null;
  if (!profile) {
    profileUnavailableReason =
      kind === "road"
        ? "Het klimprofiel van deze weg kon niet uit de weggeometrie worden afgeleid — alleen de locatie is bekend."
        : "Er kon geen betrouwbaar klimprofiel worden afgeleid — alleen hoogte en locatie zijn bekend.";
  }

  return {
    osmId,
    name,
    lat,
    lon,
    elevationM,
    kind,
    description,
    profile,
    profileUnavailableReason,
  };
}

function parseEle(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}
