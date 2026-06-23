// Weather assessment engine — turns a real forecast into honest, deterministic
// Dutch guidance for (a) training and (b) nutrition/hydration. Pure functions,
// no I/O, no AI: every line is a transparent rule over Open-Meteo numbers.
//
// Hard rules: Dutch only, never the word "AI", never fabricate. When the
// forecast lacks a value we simply don't make a claim about it.

import type { DayForecast } from "./open-meteo";

export type WeatherSeverity = "ok" | "caution" | "severe";

export type WeatherSummary = {
  label: string; // Dutch sky description, e.g. "Lichte sneeuw"
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
  suggestion: string | null;
};

export type NutritionAdvisory = {
  severity: WeatherSeverity;
  hydrationNote: string | null;
  fuelNote: string | null;
};

// Minimal day descriptor the assessment needs (decoupled from the plan engine).
export type WeatherDayInput = {
  isRest: boolean;
  trainingType: string | null; // "duur" | "herstel" | "tempo" | "interval" | "wedstrijd" | null
  estDurationMin: number | null;
  outdoor: boolean; // routeNeeded / typically-outdoor session
};

// WMO weather codes → short Dutch label. Codes per Open-Meteo / WMO spec.
const WMO_NL: Record<number, string> = {
  0: "Helder",
  1: "Overwegend helder",
  2: "Half bewolkt",
  3: "Bewolkt",
  45: "Mist",
  48: "Aanvriezende mist",
  51: "Lichte motregen",
  53: "Motregen",
  55: "Dichte motregen",
  56: "Aanvriezende motregen",
  57: "Dichte aanvriezende motregen",
  61: "Lichte regen",
  63: "Regen",
  65: "Zware regen",
  66: "Aanvriezende regen",
  67: "Zware aanvriezende regen",
  71: "Lichte sneeuw",
  73: "Sneeuw",
  75: "Zware sneeuw",
  77: "Sneeuwkorrels",
  80: "Lichte buien",
  81: "Buien",
  82: "Zware buien",
  85: "Lichte sneeuwbuien",
  86: "Zware sneeuwbuien",
  95: "Onweer",
  96: "Onweer met hagel",
  99: "Zwaar onweer met hagel",
};

export function weatherSummary(fc: DayForecast): WeatherSummary {
  const label =
    fc.weatherCode != null && WMO_NL[fc.weatherCode]
      ? WMO_NL[fc.weatherCode]!
      : "Onbekend";
  return {
    label,
    tempMinC: fc.tempMinC,
    tempMaxC: fc.tempMaxC,
    apparentMinC: fc.apparentMinC,
    apparentMaxC: fc.apparentMaxC,
    precipMm: fc.precipMm,
    snowfallCm: fc.snowfallCm,
    windMaxKmh: fc.windMaxKmh,
    precipProbMaxPct: fc.precipProbMaxPct,
  };
}

const isLongish = (d: WeatherDayInput): boolean =>
  (d.estDurationMin ?? 0) >= 120 || d.trainingType === "duur";

// ── Training advisory ────────────────────────────────────────────────────────
// Returns null when the day is rest, indoor-only, or has no usable forecast.
export function assessTraining(
  d: WeatherDayInput,
  fc: DayForecast,
): WeatherAdvisory | null {
  if (d.isRest || d.trainingType === null) return null;
  if (!d.outdoor) return null;

  const feel = fc.apparentMinC ?? fc.tempMinC;
  const feelMax = fc.apparentMaxC ?? fc.tempMaxC;
  const snow = fc.snowfallCm ?? 0;
  const rain = fc.precipMm ?? 0;
  const wind = fc.windMaxKmh ?? 0;
  const gust = fc.windGustKmh ?? 0;
  const code = fc.weatherCode ?? -1;

  const icy = feel != null && feel <= 1 && (snow > 0 || rain > 0);
  const freezing = feel != null && feel <= -8;
  const thunder = code >= 95;
  const heavySnow = snow >= 3;
  const heavyRain = rain >= 12;
  const heavyWind = wind >= 50 || gust >= 75;
  const heat = feelMax != null && feelMax >= 30;

  // SEVERE — outdoor riding is unsafe or clearly counterproductive.
  if (thunder) {
    return {
      severity: "severe",
      headline: "Onweer voorspeld",
      detail:
        "Bij onweer is buiten fietsen onveilig. Verplaats deze training naar binnen of een ander moment.",
      suggestion: "Doe de sessie op de rollerbank/indoor of verschuif een dag.",
    };
  }
  if (icy || heavySnow) {
    return {
      severity: "severe",
      headline: snow > 0 ? "Sneeuw en gladheid" : "Kans op ijzel",
      detail:
        "Glad wegdek maakt buiten rijden riskant, zeker voor een gestructureerde of lange sessie.",
      suggestion: "Train binnen of kies een rustige hersteldag buiten als het opklaart.",
    };
  }
  if (freezing && (d.trainingType === "interval" || isLongish(d))) {
    return {
      severity: "severe",
      headline: "Streng koud",
      detail: `Gevoelstemperatuur rond ${Math.round(feel!)}°C. Een ${isLongish(d) ? "lange duurrit" : "harde intervalsessie"} buiten is dan zwaar en risicovol voor de luchtwegen.`,
      suggestion:
        isLongish(d)
          ? "Verkort de rit fors of zet 'm binnen — of verplaats de duur naar een mildere dag."
          : "Doe de intervallen binnen waar je kunt opwarmen.",
    };
  }

  // CAUTION — rideable, but adjust expectations/kit.
  if (heavyWind) {
    return {
      severity: "caution",
      headline: "Harde wind",
      detail: `Wind tot ${Math.round(Math.max(wind, gust))} km/u. Op tempo/intervallen kun je je vermogen niet stabiel sturen; let op zijwind.`,
      suggestion: "Plan op vermogen/gevoel i.p.v. snelheid, of kies een luwe route.",
    };
  }
  if (heavyRain) {
    return {
      severity: "caution",
      headline: "Veel regen",
      detail: `Verwachte neerslag ~${Math.round(rain)} mm. Langere ritten worden koud en remwegen langer.`,
      suggestion: isLongish(d)
        ? "Overweeg binnen of een kortere lus dicht bij huis."
        : "Kleed je waterdicht en houd het veilig in bochten en afdalingen.",
    };
  }
  if (freezing) {
    return {
      severity: "caution",
      headline: "Koud",
      detail: `Gevoelstemperatuur rond ${Math.round(feel!)}°C. Goede winterkleding en opwarmen zijn belangrijk.`,
      suggestion: "Dek handen, voeten en luchtwegen goed af; bouw rustig op.",
    };
  }
  if (heat && isLongish(d)) {
    return {
      severity: "caution",
      headline: "Warm",
      detail: `Tot ~${Math.round(feelMax!)}°C. Een lange inspanning in de hitte vraagt om extra koeling en vocht.`,
      suggestion: "Rijd vroeg of laat op de dag en plan extra drinkmomenten.",
    };
  }

  return { severity: "ok", headline: "Goed weer", detail: "Geen bijzonderheden voor deze training.", suggestion: null };
}

// ── Race-day advisory ────────────────────────────────────────────────────────
// On a race day Sparki looks at the forecast for the *race location* (not home)
// and flags conditions that change race prep: heat (hydration/pacing), cold,
// heavy rain (grip/clothing), strong wind (echelons/pacing), or unsafe storms.
export function assessRace(fc: DayForecast): WeatherAdvisory {
  const feelMin = fc.apparentMinC ?? fc.tempMinC;
  const feelMax = fc.apparentMaxC ?? fc.tempMaxC;
  const rain = fc.precipMm ?? 0;
  const wind = fc.windMaxKmh ?? 0;
  const gust = fc.windGustKmh ?? 0;
  const snow = fc.snowfallCm ?? 0;
  const code = fc.weatherCode ?? -1;

  if (code >= 95) {
    return {
      severity: "severe",
      headline: "Onweer op wedstrijddag",
      detail: "Er is onweer voorspeld op de wedstrijdlocatie. Houd rekening met uitstel of afgelasting en volg de organisatie.",
      suggestion: "Check de communicatie van de organisatie en bereid een plan B voor.",
    };
  }
  if (snow > 0 || (feelMin != null && feelMin <= 0 && rain > 0)) {
    return {
      severity: "severe",
      headline: "Sneeuw of gladheid op wedstrijddag",
      detail: "Glad wegdek op de wedstrijdlocatie verhoogt het valrisico sterk.",
      suggestion: "Kies banden/druk op grip en wees extra voorzichtig in bochten en afdalingen.",
    };
  }
  if (feelMax != null && feelMax >= 30) {
    return {
      severity: "caution",
      headline: "Warme wedstrijddag",
      detail: `Tot ~${Math.round(feelMax)}°C op de wedstrijdlocatie. Hitte vraagt om een hydratatie- en koelplan en een realistisch tempo in de opening.`,
      suggestion: "Drink ruim vooraf, plan extra bidons/elektrolyten en koel waar mogelijk.",
    };
  }
  if (wind >= 45 || gust >= 70) {
    return {
      severity: "caution",
      headline: "Veel wind op wedstrijddag",
      detail: `Wind tot ${Math.round(Math.max(wind, gust))} km/u. Verwacht waaiers en posities vechten in de wind.`,
      suggestion: "Zit vooraan bij wind, anticipeer op waaiers en spaar krachten uit de wind.",
    };
  }
  if (rain >= 8) {
    return {
      severity: "caution",
      headline: "Natte wedstrijddag",
      detail: `Verwachte neerslag ~${Math.round(rain)} mm op de wedstrijdlocatie. Bochten en afdalingen worden glad.`,
      suggestion: "Kies passende banden/druk, rem eerder en houd marge in technische delen.",
    };
  }
  if (feelMin != null && feelMin <= -3) {
    return {
      severity: "caution",
      headline: "Koude wedstrijddag",
      detail: `Gevoelstemperatuur rond ${Math.round(feelMin)}°C. Een goede warming-up en de juiste kleding zijn belangrijk.`,
      suggestion: "Warm goed op, kleed je in lagen en houd je kern warm tot de start.",
    };
  }
  return {
    severity: "ok",
    headline: "Gunstige verwachting",
    detail: "Geen bijzondere weersrisico's voor de wedstrijddag op dit moment.",
    suggestion: null,
  };
}

// ── Nutrition / hydration advisory ───────────────────────────────────────────
// Weather shifts fuelling needs: heat → more fluids + sodium; cold long rides →
// more (and warmer) carbohydrate; wet/cold → don't under-drink despite the cold.
export function assessNutrition(
  d: WeatherDayInput,
  fc: DayForecast,
): NutritionAdvisory | null {
  if (d.isRest || d.trainingType === null || !d.outdoor) return null;

  const feelMax = fc.apparentMaxC ?? fc.tempMaxC;
  const feelMin = fc.apparentMinC ?? fc.tempMinC;
  const longish = isLongish(d);

  let severity: WeatherSeverity = "ok";
  let hydrationNote: string | null = null;
  let fuelNote: string | null = null;

  // Heat — fluid + electrolytes dominate.
  if (feelMax != null && feelMax >= 30) {
    severity = longish ? "severe" : "caution";
    hydrationNote = `Bij ~${Math.round(feelMax)}°C verlies je veel vocht en zout. Mik op 500–750 ml per uur en voeg elektrolyten/zout toe.`;
    fuelNote = "Kies makkelijk verteerbare koolhydraten; vermijd zware, vette voeding vlak voor de rit.";
  } else if (feelMax != null && feelMax >= 25) {
    severity = "caution";
    hydrationNote = `Warm (~${Math.round(feelMax)}°C): drink met regelmaat en neem extra bidon mee.`;
  }

  // Cold long rides — carbohydrate need rises and you drink too little.
  if (feelMin != null && feelMin <= 2 && longish) {
    if (severity === "ok") severity = "caution";
    fuelNote = "In de kou verbrand je meer; neem ruim koolhydraten mee en eet op tijd, ook als je geen honger voelt.";
    if (!hydrationNote)
      hydrationNote = "Je drinkt in de kou snel te weinig — neem (lauwwarme) drank mee en drink met vaste tussenpozen.";
  }

  if (!hydrationNote && !fuelNote) return null;
  return { severity, hydrationNote, fuelNote };
}
