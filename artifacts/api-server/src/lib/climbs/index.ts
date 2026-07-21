// Klimmenverkenner orchestration: turns the raw sources (Overpass catalogue,
// Nominatim geocoding, routing-provider profile derivation, Wikipedia/Wikidata
// enrichment) into the honest search + detail results the API serves. Every
// value comes from a real source or is explicitly reported as missing.

import { geocodeArea } from "./geocode";
import { searchClimbsInBbox, fetchClimbTags, type ClimbHit } from "./overpass";
import { deriveClimbProfile, type DerivedClimbProfile } from "./profile";
import { enrichDescription, type ClimbDescription } from "./enrich";

export type ClimbSearchResult = {
  area: { label: string; lat: number; lon: number } | null;
  climbs: ClimbHit[];
};

export type ClimbDetail = {
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  elevationM: number | null;
  kind: "pass" | "peak";
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

export async function searchClimbs(opts: {
  q: string;
  name?: string | null;
  limit?: number;
}): Promise<ClimbSearchResult> {
  const area = await geocodeArea(opts.q).catch(() => {
    throw new ClimbSourceError("geocode_unreachable", "unreachable");
  });
  if (!area) {
    throw new ClimbSourceError("area_not_found", "area_not_found");
  }
  const climbs = await searchClimbsInBbox({
    south: area.south,
    west: area.west,
    north: area.north,
    east: area.east,
    nameFilter: opts.name ?? null,
    limit: opts.limit,
  }).catch(() => {
    throw new ClimbSourceError("overpass_unreachable", "unreachable");
  });
  return {
    area: { label: area.label, lat: area.lat, lon: area.lon },
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
  const kind: "pass" | "peak" =
    tags.mountain_pass === "yes" || tags.mountain_pass === "1"
      ? "pass"
      : "peak";
  const elevationM = parseEle(tags.ele);

  // Description + derived profile are independent; run them in parallel and let
  // each degrade honestly on its own.
  const [description, profile] = await Promise.all([
    enrichDescription(tags).catch(() => null),
    deriveClimbProfile({ lat, lon, elevationM }).catch(() => null),
  ]);

  let profileUnavailableReason: string | null = null;
  if (!profile) {
    profileUnavailableReason =
      "Er kon geen betrouwbaar klimprofiel worden afgeleid — alleen hoogte en locatie zijn bekend.";
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
