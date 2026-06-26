// Home weather — looks up the forecast at the athlete's *saved home location*
// (not a race) for everyday training context. Unlike a race location (free text
// that must be geocoded), the home location is stored as real coordinates
// (homeLat/homeLon), so no geocoding is needed. Honest about its limits: no home
// location at all, or today falling outside the ~16-day forecast horizon, both
// yield no weather (never a fabricated guess).

import { getForecast, type DayForecast } from "./open-meteo";
import {
  assessTraining,
  weatherSummary,
  type WeatherAdvisory,
  type WeatherDayInput,
  type WeatherSummary,
} from "./assess";

export type HomeWeatherReason = "ok" | "no_home" | "no_forecast";

export type HomeOutlookDay = {
  date: string;
  summary: WeatherSummary;
};

export type HomeWeather = {
  available: boolean;
  // Why weather isn't available, for honest UI copy.
  reason: HomeWeatherReason;
  locationLabel: string | null;
  /** Today's conditions at home (null when unavailable). */
  today: WeatherSummary | null;
  /** Raw today forecast, kept so engines can assess per-session. */
  todayForecast: DayForecast | null;
  /** Sparki's read on an outdoor *intensive* ride today (severity ok/caution/severe). */
  advisory: WeatherAdvisory | null;
  /** A short look ahead (the next couple of days), honest empty when absent. */
  outlook: HomeOutlookDay[];
};

const OUTLOOK_DAYS = 3; // today + next two days

// A representative intensive outdoor session, used to read how today's weather
// would affect a quality ride from home: hard intervals inside a ~2h ride
// (warm-up + quality blocks + cool-down). This is a real assessment of a
// plausible session, not a fabricated forecast. The 120-min duration keeps the
// heat/cold reads consistent with the daily-advice engine, which steps an
// outdoor intensive day back at the same thresholds.
const INTENSIVE_OUTDOOR: WeatherDayInput = {
  isRest: false,
  trainingType: "interval",
  estDurationMin: 120,
  outdoor: true,
};

function toCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Real home-location weather for everyday (non-race) coaching. Returns honest
 * gaps: no_home when there is no saved location, no_forecast when the upstream
 * gave us nothing usable. Never fabricates a forecast.
 */
export async function getHomeWeather(
  homeLat: unknown,
  homeLon: unknown,
  homeLabel: string | null | undefined,
): Promise<HomeWeather> {
  const base: HomeWeather = {
    available: false,
    reason: "ok",
    locationLabel: null,
    today: null,
    todayForecast: null,
    advisory: null,
    outlook: [],
  };

  const lat = toCoord(homeLat);
  const lon = toCoord(homeLon);
  const label = (homeLabel ?? "").trim() || null;
  if (lat == null || lon == null) return { ...base, reason: "no_home" };

  const days = await getForecast(lat, lon, OUTLOOK_DAYS);
  const today = days[0];
  if (!today) {
    return { ...base, reason: "no_forecast", locationLabel: label };
  }

  return {
    available: true,
    reason: "ok",
    locationLabel: label,
    today: weatherSummary(today),
    todayForecast: today,
    advisory: assessTraining(INTENSIVE_OUTDOOR, today),
    // The first day is "today"; the rest is the short look-ahead.
    outlook: days.slice(1).map((d) => ({ date: d.date, summary: weatherSummary(d) })),
  };
}

/**
 * One plain-Dutch line summarising today's home conditions, e.g.
 * "Regen, 8–14°C, wind tot 35 km/u". Only includes values the forecast
 * actually returned (honest — never invents a number). Returns null when there
 * is nothing concrete to say.
 */
export function formatHomeWeatherText(s: WeatherSummary | null): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.label && s.label !== "Onbekend") parts.push(s.label);
  const tMin = s.tempMinC;
  const tMax = s.tempMaxC;
  if (tMin != null && tMax != null) {
    parts.push(`${Math.round(tMin)}–${Math.round(tMax)}°C`);
  } else if (tMax != null) {
    parts.push(`tot ${Math.round(tMax)}°C`);
  } else if (tMin != null) {
    parts.push(`vanaf ${Math.round(tMin)}°C`);
  }
  if (s.windMaxKmh != null && s.windMaxKmh >= 20) {
    parts.push(`wind tot ${Math.round(s.windMaxKmh)} km/u`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}
