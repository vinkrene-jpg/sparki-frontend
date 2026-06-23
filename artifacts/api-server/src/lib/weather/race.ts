// Race-day weather — looks up the forecast at the *race location* (not the
// athlete's home) for the race date. The race location is stored as free text,
// so we geocode it via the routing provider, then fetch Open-Meteo for that
// coordinate. Honest about limits: forecasts only exist ~16 days ahead, and a
// location we can't geocode yields no weather (never a fabricated guess).

import { getRoutingProvider } from "../routing";
import { getForecastByDate } from "./open-meteo";
import { assessRace, weatherSummary, type WeatherSummary, type WeatherAdvisory } from "./assess";

export type RaceWeather = {
  available: boolean;
  // Why weather isn't available, for honest UI copy.
  reason: "ok" | "too_far" | "no_location" | "geocode_failed" | "no_forecast";
  locationLabel: string | null;
  weather: WeatherSummary | null;
  advisory: WeatherAdvisory | null;
};

// Open-Meteo covers today + 15 days = 16 daily entries (indices 0..15).
const HORIZON_DAYS = 16;
const MAX_AWAY = HORIZON_DAYS - 1;

// Geocoding a place name is stable, so cache it to avoid re-geocoding the same
// race location on every plan read. Stored result may be null (unresolvable).
type GeoHit = { at: number; geo: { lat: number; lon: number; label: string } | null };
const GEO_CACHE = new Map<string, GeoHit>();
const GEO_TTL_MS = 24 * 60 * 60_000; // a place doesn't move

function daysFromToday(dateStr: string): number {
  const today = new Date();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const d = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.round((d - t) / 86_400_000);
}

async function geocodeCached(loc: string) {
  const key = loc.toLowerCase();
  const hit = GEO_CACHE.get(key);
  if (hit && Date.now() - hit.at < GEO_TTL_MS) return hit.geo;
  let geo: GeoHit["geo"] = null;
  try {
    const r = await getRoutingProvider().geocode(loc);
    if (r) geo = { lat: r.lat, lon: r.lon, label: r.label };
  } catch {
    geo = null;
  }
  GEO_CACHE.set(key, { at: Date.now(), geo });
  return geo;
}

export async function getRaceWeather(
  location: string | null | undefined,
  raceDate: string,
): Promise<RaceWeather> {
  const base: RaceWeather = {
    available: false,
    reason: "ok",
    locationLabel: null,
    weather: null,
    advisory: null,
  };

  const loc = (location ?? "").trim();
  if (!loc) return { ...base, reason: "no_location" };

  const away = daysFromToday(raceDate);
  if (away < 0 || away > MAX_AWAY) return { ...base, reason: "too_far" };

  const geo = await geocodeCached(loc);
  if (!geo) return { ...base, reason: "geocode_failed" };

  const byDate = await getForecastByDate(geo.lat, geo.lon, HORIZON_DAYS);
  const fc = byDate.get(raceDate);
  if (!fc) return { ...base, reason: "no_forecast", locationLabel: geo.label };

  return {
    available: true,
    reason: "ok",
    locationLabel: geo.label,
    weather: weatherSummary(fc),
    advisory: assessRace(fc),
  };
}
