// Open-Meteo weather provider — the single, real source of forecast data for
// Sparki. Open-Meteo is free and needs no API key. Every number here is fetched
// live (never fabricated); on failure we return null/empty and callers degrade
// honestly (no weather shown, no silent fake forecast).
//
// Forecasts are volatile, so we do NOT persist them. A short in-memory cache
// keyed by rounded coordinate + horizon avoids hammering the API within a
// request burst while keeping the data fresh enough to be honest.

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

// Open-Meteo provides at most 16 days of daily forecast.
const MAX_FORECAST_DAYS = 16;

export type DayForecast = {
  date: string; // YYYY-MM-DD (local to the location's timezone)
  tempMinC: number | null;
  tempMaxC: number | null;
  apparentMinC: number | null; // "feels like" — what matters for cold/wind
  apparentMaxC: number | null;
  precipMm: number | null;
  rainMm: number | null;
  snowfallCm: number | null;
  precipProbMaxPct: number | null;
  windMaxKmh: number | null;
  windGustKmh: number | null;
  weatherCode: number | null; // WMO code
};

type OpenMeteoResponse = {
  daily?: {
    time?: string[];
    temperature_2m_min?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    apparent_temperature_min?: (number | null)[];
    apparent_temperature_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    rain_sum?: (number | null)[];
    snowfall_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    wind_gusts_10m_max?: (number | null)[];
    weather_code?: (number | null)[];
  };
  error?: boolean;
  reason?: string;
};

type CacheEntry = { at: number; data: DayForecast[] };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60_000; // 30 minutes — forecasts barely move within this window
// Weather is best-effort: never let a slow upstream stall a plan read.
const FETCH_TIMEOUT_MS = 4_000;

function cacheKey(lat: number, lon: number, days: number): string {
  // Round to ~1km so nearby requests share a cache slot.
  return `${lat.toFixed(2)},${lon.toFixed(2)}:${days}`;
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Fetch a real daily forecast for a coordinate. Returns up to `days` entries
 * starting today (location timezone). Returns [] on any failure — weather is
 * always optional and never blocks training/nutrition logic.
 */
export async function getForecast(
  lat: number,
  lon: number,
  days = MAX_FORECAST_DAYS,
): Promise<DayForecast[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const want = Math.min(Math.max(Math.trunc(days), 1), MAX_FORECAST_DAYS);

  const key = cacheKey(lat, lon, want);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = new URL(OPEN_METEO_BASE);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(want));
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_min",
      "temperature_2m_max",
      "apparent_temperature_min",
      "apparent_temperature_max",
      "precipitation_sum",
      "rain_sum",
      "snowfall_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "weather_code",
    ].join(","),
  );

  let json: OpenMeteoResponse;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return [];
    json = (await res.json()) as OpenMeteoResponse;
  } catch {
    return [];
  }
  if (json.error || !json.daily?.time) return [];

  const d = json.daily;
  const times = d.time ?? [];
  const out: DayForecast[] = times.map((date, i) => ({
    date,
    tempMinC: num(d.temperature_2m_min?.[i]),
    tempMaxC: num(d.temperature_2m_max?.[i]),
    apparentMinC: num(d.apparent_temperature_min?.[i]),
    apparentMaxC: num(d.apparent_temperature_max?.[i]),
    precipMm: num(d.precipitation_sum?.[i]),
    rainMm: num(d.rain_sum?.[i]),
    snowfallCm: num(d.snowfall_sum?.[i]),
    precipProbMaxPct: num(d.precipitation_probability_max?.[i]),
    windMaxKmh: num(d.wind_speed_10m_max?.[i]),
    windGustKmh: num(d.wind_gusts_10m_max?.[i]),
    weatherCode: num(d.weather_code?.[i]),
  }));

  CACHE.set(key, { at: Date.now(), data: out });
  return out;
}

// ── Hourly forecast (route-paspoort: weer op de vertrektijd) ────────────────

export type HourForecast = {
  time: string; // ISO local hour (location timezone), e.g. "2026-07-21T14:00"
  tempC: number | null;
  uvIndex: number | null;
  windKmh: number | null;
  windGustKmh: number | null;
  windDirDeg: number | null;
  precipProbPct: number | null;
};

type HourlyResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    uv_index?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    precipitation_probability?: (number | null)[];
  };
  error?: boolean;
};

const HOURLY_CACHE = new Map<string, { at: number; data: HourForecast[] }>();

/**
 * Real hourly forecast for a coordinate (up to `days` days, max 16). Same
 * honesty contract as getForecast: [] on failure, nothing fabricated.
 */
export async function getHourlyForecast(
  lat: number,
  lon: number,
  days = 7,
): Promise<HourForecast[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const want = Math.min(Math.max(Math.trunc(days), 1), MAX_FORECAST_DAYS);
  const key = `h:${lat.toFixed(2)},${lon.toFixed(2)}:${want}`;
  const hit = HOURLY_CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = new URL(OPEN_METEO_BASE);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(want));
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "uv_index",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "precipitation_probability",
    ].join(","),
  );

  let json: HourlyResponse;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return [];
    json = (await res.json()) as HourlyResponse;
  } catch {
    return [];
  }
  if (json.error || !json.hourly?.time) return [];

  const h = json.hourly;
  const out: HourForecast[] = (h.time ?? []).map((time, i) => ({
    time,
    tempC: num(h.temperature_2m?.[i]),
    uvIndex: num(h.uv_index?.[i]),
    windKmh: num(h.wind_speed_10m?.[i]),
    windGustKmh: num(h.wind_gusts_10m?.[i]),
    windDirDeg: num(h.wind_direction_10m?.[i]),
    precipProbPct: num(h.precipitation_probability?.[i]),
  }));

  HOURLY_CACHE.set(key, { at: Date.now(), data: out });
  return out;
}

/** Build a date→forecast lookup for quick per-day joins. */
export async function getForecastByDate(
  lat: number,
  lon: number,
  days = MAX_FORECAST_DAYS,
): Promise<Map<string, DayForecast>> {
  const list = await getForecast(lat, lon, days);
  return new Map(list.map((f) => [f.date, f]));
}
