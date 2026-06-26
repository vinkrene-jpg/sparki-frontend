// Read-only contract for the home-weather endpoint (GET /api/weather/home).
// Mirrors the api-server's HomeWeather shape; the backend is the source of truth
// and never fabricates a forecast — gaps are honest (no_home / no_forecast).

export type WeatherSeverity = "ok" | "caution" | "severe";

export type WeatherSummary = {
  label: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  apparentMinC: number | null;
  apparentMaxC: number | null;
  precipMm: number | null;
  snowfallCm: number | null;
  windMaxKmh: number | null;
  precipProbMaxPct: number | null;
};

export type WeatherAdvisory = {
  severity: WeatherSeverity;
  headline: string;
  detail: string;
  suggestion?: string;
};

export type HomeOutlookDay = {
  date: string;
  summary: WeatherSummary;
};

export type HomeWeatherReason = "ok" | "no_home" | "no_forecast";

export type HomeWeather = {
  available: boolean;
  reason: HomeWeatherReason;
  locationLabel: string | null;
  today: WeatherSummary | null;
  todayForecast: unknown | null;
  advisory: WeatherAdvisory | null;
  outlook: HomeOutlookDay[];
};
