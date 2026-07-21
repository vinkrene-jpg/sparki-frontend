// Region/area geocoding for the Klimmenverkenner via OpenStreetMap Nominatim
// (public, key-less, the natural companion to Overpass). Resolves a free-text
// place/area query to a real centre + bounding box. The bbox is clamped to a
// sane span so a huge region ("Alpen") doesn't spawn an Overpass query that
// times out — results are then honestly framed as "rond <plaats>".

import { fetchJson } from "./http";

export type GeoArea = {
  label: string;
  lat: number;
  lon: number;
  south: number;
  west: number;
  north: number;
  east: number;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string];
};

// Max half-span of the search box, in degrees. ~0.35° lat ≈ 39 km; longitude
// span is a bit wider to cover typical riding radii without huge queries.
const MAX_HALF_LAT = 0.35;
const MAX_HALF_LON = 0.5;

export async function geocodeArea(query: string): Promise<GeoArea | null> {
  const q = query.trim();
  if (!q) return null;
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=" +
    encodeURIComponent(q);
  const results = await fetchJson<NominatimResult[]>(url, 12000);
  const top = results?.[0];
  if (!top) return null;

  const lat = Number(top.lat);
  const lon = Number(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Nominatim boundingbox order is [south, north, west, east].
  const bbSouth = Number(top.boundingbox[0]);
  const bbNorth = Number(top.boundingbox[1]);
  const bbWest = Number(top.boundingbox[2]);
  const bbEast = Number(top.boundingbox[3]);

  const halfLat = Math.min(
    MAX_HALF_LAT,
    Number.isFinite(bbNorth) && Number.isFinite(bbSouth)
      ? Math.max((bbNorth - bbSouth) / 2, 0.05)
      : MAX_HALF_LAT,
  );
  const halfLon = Math.min(
    MAX_HALF_LON,
    Number.isFinite(bbEast) && Number.isFinite(bbWest)
      ? Math.max((bbEast - bbWest) / 2, 0.05)
      : MAX_HALF_LON,
  );

  return {
    label: top.display_name,
    lat,
    lon,
    south: lat - halfLat,
    north: lat + halfLat,
    west: lon - halfLon,
    east: lon + halfLon,
  };
}
