// Race insight — the "intelligent werkblad" engine behind the race worksheet.
//
// Doctrine: Sparki gathers and derives everything it honestly can BEFORE asking
// the athlete to type anything. For a (prospective or saved) race it derives:
//   • the race-day weather at the race location (real forecast or honest gap),
//   • the straight-line distance from the athlete's home to the venue,
//   • a discipline-appropriate logistics proposal (standard coaching norms,
//     explicitly a *voorstel* the athlete confirms — never personal data faked),
//   • the athlete's home as the default departure location.
// Nothing here invents live data: weather/geocode come from real providers and
// fall back to honest "available:false" reasons; travel time by car is NOT
// computed because the routing provider only supports cycling/foot profiles, so
// we never fabricate a reistijd — that stays a genuine gap for the athlete.

import { getRaceWeather, type RaceWeather } from "./weather/race";
import { getRoutingProvider } from "./routing";

export type LogisticsSuggestion = {
  arrivalBufferMin: number;
  registrationMin: number;
  warmupMin: number;
  callUpMin: number;
  breakfastBeforeDepartureMin: number;
  // Plain-Dutch reason these norms fit this discipline.
  rationale: string;
};

export type RaceTravel = {
  available: boolean;
  reason: "ok" | "no_home" | "no_location" | "geocode_failed";
  fromLabel: string | null;
  toLabel: string | null;
  // Great-circle distance between two real coordinates (km). Honest context —
  // road distance/time is longer; we label it "hemelsbreed" in the UI.
  straightLineKm: number | null;
};

export type RaceInsight = {
  weather: RaceWeather;
  travel: RaceTravel;
  // The athlete's home, suggested as the default departure location.
  departureSuggestion: string | null;
  logistics: LogisticsSuggestion;
};

type AthleteLike = {
  homeLat: string | null;
  homeLon: string | null;
  homeLabel: string | null;
} | null;

// Standard, explainable preparation norms per race type. These are proposals the
// athlete reviews — not personal data and not fabricated measurements.
function logisticsFor(discipline: string | null | undefined): LogisticsSuggestion {
  const d = (discipline ?? "").toLowerCase();
  if (/crit|kermis|baan|track|veld|\bcx\b|cross/.test(d)) {
    return {
      arrivalBufferMin: 90,
      registrationMin: 20,
      warmupMin: 30,
      callUpMin: 15,
      breakfastBeforeDepartureMin: 180,
      rationale:
        "Korte, explosieve wedstrijd met call-up: ruim op tijd aanwezig, grondige warming-up en ontbijt ruim voor vertrek.",
    };
  }
  if (/tt|tijdrit|time.?trial|chrono/.test(d)) {
    return {
      arrivalBufferMin: 75,
      registrationMin: 20,
      warmupMin: 30,
      callUpMin: 5,
      breakfastBeforeDepartureMin: 180,
      rationale:
        "Tijdrit: lange, specifieke warming-up en een korte call-up vlak voor je starttijd.",
    };
  }
  if (/mtb|mountain|gravel|atb/.test(d)) {
    return {
      arrivalBufferMin: 75,
      registrationMin: 20,
      warmupMin: 20,
      callUpMin: 10,
      breakfastBeforeDepartureMin: 150,
      rationale:
        "Off-road: tijd voor materiaalcheck en het startvak, met een beknopte warming-up.",
    };
  }
  if (/fondo|toer|sportief|sportive|granfondo|gran.fondo/.test(d)) {
    return {
      arrivalBufferMin: 60,
      registrationMin: 20,
      warmupMin: 10,
      callUpMin: 0,
      breakfastBeforeDepartureMin: 150,
      rationale:
        "Toertocht of gran fondo: rustige start met beperkte warming-up — je rijdt jezelf op gang.",
    };
  }
  return {
    arrivalBufferMin: 75,
    registrationMin: 20,
    warmupMin: 15,
    callUpMin: 10,
    breakfastBeforeDepartureMin: 180,
    rationale:
      "Wegwedstrijd: op tijd voor inschrijving, een korte warming-up en call-up vlak voor de start.",
  };
}

function toNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function buildTravel(
  location: string | null | undefined,
  athlete: AthleteLike,
): Promise<RaceTravel> {
  const base: RaceTravel = {
    available: false,
    reason: "ok",
    fromLabel: null,
    toLabel: null,
    straightLineKm: null,
  };

  const homeLat = toNum(athlete?.homeLat);
  const homeLon = toNum(athlete?.homeLon);
  if (homeLat == null || homeLon == null) return { ...base, reason: "no_home" };

  const loc = (location ?? "").trim();
  if (!loc) return { ...base, reason: "no_location", fromLabel: athlete?.homeLabel ?? null };

  let geo: { lat: number; lon: number; label: string } | null = null;
  try {
    geo = await getRoutingProvider().geocode(loc);
  } catch {
    geo = null;
  }
  if (!geo) {
    return { ...base, reason: "geocode_failed", fromLabel: athlete?.homeLabel ?? null };
  }

  return {
    available: true,
    reason: "ok",
    fromLabel: athlete?.homeLabel ?? null,
    toLabel: geo.label,
    straightLineKm: Math.round(haversineKm(homeLat, homeLon, geo.lat, geo.lon)),
  };
}

export async function buildRaceInsight(
  input: { location: string | null; raceDate: string; discipline: string | null },
  athlete: AthleteLike,
): Promise<RaceInsight> {
  const [weather, travel] = await Promise.all([
    getRaceWeather(input.location, input.raceDate),
    buildTravel(input.location, athlete),
  ]);
  return {
    weather,
    travel,
    departureSuggestion: athlete?.homeLabel ?? null,
    logistics: logisticsFor(input.discipline),
  };
}
