// Race Intelligence — the central, source-agnostic race-context engine.
//
// This is NOT a "smart races page": it is one generic intelligence layer that, for
// a given race, gathers and combines every REAL signal Sparki can reach (the race
// record, the athlete profile, the live weather forecast, the home→venue distance,
// a linked route/GPX, the derived race type and estimated duration), then models
// each piece as a typed field carrying its status:
//   • "found"   — taken straight from a real source (race record / forecast / route)
//   • "derived" — computed by transparent arithmetic, with an explanation and a
//                 bounded confidence (never 1.0)
//   • "missing" — genuinely unavailable, with a plain-Dutch reason and ONE targeted
//                 question routing the athlete to the right input
//
// The field model is deliberately bron-agnostisch so Routes / Health / Strava /
// Garmin / Agenda can later feed the exact same shape. Nothing here is fabricated:
// when a value cannot be found or derived, it stays a gap. The term "AI" never
// appears in any user-facing string — everything is framed as Sparki.

import { and, eq } from "drizzle-orm";
import { db, routesTable, type Race, type AthleteProfile } from "@workspace/db";
import { getRaceWeather, type RaceWeather } from "./weather/race";
import type { WeatherSummary } from "./weather/assess";
import {
  buildRaceInsight,
  type RaceTravel,
  type LogisticsSuggestion,
} from "./race-insight";
import {
  buildRaceFuel,
  buildRaceIntel,
  daysUntil,
  type RaceIntel,
  type ReportSection,
  type ReportItem,
} from "./race-intel";

// ── Field model (source-agnostic) ────────────────────────────────────────────
export type RaceFieldStatus = "found" | "derived" | "missing";

export type RaceContextField = {
  /** Stable, source-agnostic key (e.g. "weer", "reisafstand"). */
  key: string;
  label: string;
  status: RaceFieldStatus;
  /** Human-readable Dutch value, or null when missing. */
  value: string | null;
  /** Herkomst — where the value came from ("wedstrijd", "Open-Meteo", "afgeleid"). */
  origin: string;
  /** Why/how it was derived, or the plain-Dutch reason it is missing. */
  explanation?: string;
  /** Derived fields only — calibrated confidence, always < 1.0. */
  confidence?: number;
  /** Missing fields only — one targeted question / next step. */
  question?: string;
};

export type RaceContextGap = {
  key: string;
  label: string;
  reason: string;
  question: string;
};

export type RaceContextDomain =
  | "training"
  | "voeding"
  | "materiaal"
  | "routes"
  | "herstel"
  | "coach"
  | "race";

export type RaceContextPhase = "ver" | "aankomend" | "vandaag" | "voorbij";

export type RaceContext = {
  raceId: number;
  raceName: string;
  raceDate: string;
  daysUntil: number;
  phase: RaceContextPhase;
  priority: string;
  fields: RaceContextField[];
  gaps: RaceContextGap[];
  guidance: Record<RaceContextDomain, string[]>;
};

// ── Real sources the pure composer consumes ──────────────────────────────────
export type RaceContextSources = {
  weather: RaceWeather;
  travel: RaceTravel;
  logistics: LogisticsSuggestion;
  /** True when a saved route/GPX is linked to this race's planned workout. */
  routeLinked: boolean;
  today?: Date;
};

// ── Race-type derivation (pure, reusable for auto-enrich on create) ───────────
const RACE_TYPE_PATTERNS: { re: RegExp; type: string }[] = [
  { re: /crit|kermis/, type: "criterium" },
  { re: /tijdrit|\btt\b|chrono|time.?trial/, type: "tijdrit" },
  { re: /veld|\bcx\b|cyclo|cross/, type: "veldrit" },
  { re: /mtb|mountain|\batb\b/, type: "mountainbike" },
  { re: /gravel/, type: "gravelrace" },
  { re: /baan|track|piste/, type: "baanwedstrijd" },
  { re: /fondo|toer|sportief|sportive/, type: "toertocht" },
  { re: /weg|road|lijn/, type: "wegwedstrijd" },
];

function matchRaceType(text: string | null | undefined): string | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  for (const p of RACE_TYPE_PATTERNS) if (p.re.test(t)) return p.type;
  return null;
}

// Best-effort race type from the discipline first, then the race name. Returns
// null when nothing matches — never guesses a default. Used both for the context
// field and to auto-fill races.raceType on create.
export function deriveRaceTypeValue(race: {
  discipline?: string | null;
  name?: string | null;
}): string | null {
  return matchRaceType(race.discipline) ?? matchRaceType(race.name);
}

// ── Small formatters ─────────────────────────────────────────────────────────
function subtractMinutes(hhmm: string, mins: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  let total = parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10) - mins;
  while (total < 0) total += 24 * 60;
  const h = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function hoursLabel(min: number): string {
  const h = Math.round((min / 60) * 10) / 10;
  return `~${h} uur`;
}

function weatherValue(w: WeatherSummary): string {
  const parts: string[] = [w.label];
  if (w.tempMinC != null && w.tempMaxC != null)
    parts.push(`${Math.round(w.tempMinC)}–${Math.round(w.tempMaxC)}°C`);
  else if (w.tempMaxC != null) parts.push(`${Math.round(w.tempMaxC)}°C`);
  if (w.windMaxKmh != null) parts.push(`wind tot ${Math.round(w.windMaxKmh)} km/u`);
  if (w.precipProbMaxPct != null)
    parts.push(`${Math.round(w.precipProbMaxPct)}% kans op neerslag`);
  return parts.join(", ");
}

const WEATHER_REASON: Record<string, { reason: string; question: string }> = {
  too_far: {
    reason: "De wedstrijd valt buiten de 16-daagse voorspelhorizon.",
    question: "Het weer wordt automatisch opgehaald zodra de dag binnen 16 dagen ligt.",
  },
  no_location: {
    reason: "De locatie van de wedstrijd ontbreekt.",
    question: "Vul de locatie in, dan wordt het weer opgehaald.",
  },
  geocode_failed: {
    reason: "Deze locatie is niet op de kaart gevonden.",
    question: "Controleer de plaatsnaam van de locatie.",
  },
  no_forecast: {
    reason: "Er is nog geen voorspelling voor deze dag en plek.",
    question: "Probeer het opnieuw als de dag dichterbij is.",
  },
};

const TRAVEL_REASON: Record<string, { reason: string; question: string }> = {
  no_home: {
    reason: "Je thuislocatie staat niet in je profiel.",
    question: "Vul je thuislocatie in je profiel in, dan wordt de reisafstand berekend.",
  },
  no_location: {
    reason: "De locatie van de wedstrijd ontbreekt.",
    question: "Vul de locatie van de wedstrijd in.",
  },
  geocode_failed: {
    reason: "Deze locatie is niet op de kaart gevonden.",
    question: "Controleer de plaatsnaam van de locatie.",
  },
};

function phaseOf(d: number): RaceContextPhase {
  if (d < 0) return "voorbij";
  if (d === 0) return "vandaag";
  if (d <= 10) return "aankomend";
  return "ver";
}

// ── Pure composer ────────────────────────────────────────────────────────────
// Builds the full race context from a race + the athlete + already-fetched real
// sources. No I/O here, so it is fully deterministic and unit-testable.
export function composeRaceContext(
  race: Race,
  _athlete: AthleteProfile | null,
  sources: RaceContextSources,
): RaceContext {
  const today = sources.today ?? new Date();
  const d = daysUntil(race.raceDate, today);
  const { weather, travel, logistics, routeLinked } = sources;
  const fuel = buildRaceFuel(race);

  const fields: RaceContextField[] = [];
  const F = (f: RaceContextField) => fields.push(f);

  // Core facts straight from the race record.
  F({ key: "naam", label: "Wedstrijd", status: "found", value: race.name, origin: "wedstrijd" });
  F({ key: "datum", label: "Datum", status: "found", value: race.raceDate, origin: "wedstrijd" });
  F({
    key: "prioriteit",
    label: "Prioriteit",
    status: "found",
    value: race.priority,
    origin: "wedstrijd",
  });

  if (race.location && race.location.trim()) {
    F({ key: "locatie", label: "Locatie", status: "found", value: race.location, origin: "wedstrijd" });
  } else {
    F({
      key: "locatie",
      label: "Locatie",
      status: "missing",
      value: null,
      origin: "wedstrijd",
      explanation: "De startlocatie is nog niet ingevuld.",
      question: "Vul de locatie in — dan worden het weer en de reisafstand opgehaald.",
    });
  }

  // Distance / elevation / course (found-or-honest-gap).
  if (race.distanceKm != null) {
    F({ key: "afstand", label: "Afstand", status: "found", value: `${race.distanceKm} km`, origin: "wedstrijd" });
  } else {
    F({
      key: "afstand",
      label: "Afstand",
      status: "missing",
      value: null,
      origin: "wedstrijd",
      explanation: "De afstand is nog niet bekend.",
      question: "Vul de afstand in (of stuur de technische gids) voor een duur- en voedingsschema.",
    });
  }
  if (race.elevationM != null) {
    F({ key: "hoogtemeters", label: "Hoogtemeters", status: "found", value: `${race.elevationM} m`, origin: "wedstrijd" });
  } else {
    F({
      key: "hoogtemeters",
      label: "Hoogtemeters",
      status: "missing",
      value: null,
      origin: "wedstrijd",
      explanation: "De hoogtemeters zijn nog niet bekend.",
      question: "Voeg de hoogtemeters toe via de technische gids voor een scherper koersbeeld.",
    });
  }

  // Race type — found on the record, else derived, else honest gap.
  if (race.raceType && race.raceType.trim()) {
    F({ key: "type", label: "Wedstrijdtype", status: "found", value: race.raceType, origin: "wedstrijd" });
  } else {
    const fromDiscipline = matchRaceType(race.discipline);
    const derived = fromDiscipline ?? matchRaceType(race.name);
    if (derived) {
      F({
        key: "type",
        label: "Wedstrijdtype",
        status: "derived",
        value: derived,
        origin: "afgeleid",
        explanation: fromDiscipline
          ? `Afgeleid uit de discipline "${race.discipline}".`
          : `Afgeleid uit de naam van de wedstrijd.`,
        confidence: fromDiscipline ? 0.7 : 0.55,
      });
    } else {
      F({
        key: "type",
        label: "Wedstrijdtype",
        status: "missing",
        value: null,
        origin: "afgeleid",
        explanation: "Het type is niet uit de discipline of naam af te leiden.",
        question: "Kies het wedstrijdtype (weg, criterium, tijdrit, veld, mtb, gravel).",
      });
    }
  }

  // Estimated duration — derived from distance × discipline pace.
  if (fuel.durationKnown && fuel.estimatedDurationMin != null) {
    F({
      key: "duur",
      label: "Geschatte duur",
      status: "derived",
      value: hoursLabel(fuel.estimatedDurationMin),
      origin: "afgeleid",
      explanation:
        "De duur is geschat uit de afstand en een gemiddeld wedstrijdtempo; pas aan op je eigen tempo.",
      confidence: 0.6,
    });
  } else {
    F({
      key: "duur",
      label: "Geschatte duur",
      status: "missing",
      value: null,
      origin: "afgeleid",
      explanation: "Zonder afstand is de duur niet te schatten.",
      question: "Vul de afstand in, dan worden de duur en de voeding geschat.",
    });
  }

  // Weather — found from a real forecast, else honest gap with the precise reason.
  if (weather.available && weather.weather) {
    F({
      key: "weer",
      label: "Weer op locatie",
      status: "found",
      value: weatherValue(weather.weather),
      origin: "Open-Meteo (voorspelling)",
      explanation: weather.locationLabel
        ? `Voorspelling voor ${weather.locationLabel} op de wedstrijddag.`
        : "Voorspelling voor de wedstrijddag.",
    });
  } else {
    const r = WEATHER_REASON[weather.reason] ?? WEATHER_REASON.no_forecast!;
    F({
      key: "weer",
      label: "Weer op locatie",
      status: "missing",
      value: null,
      origin: "Open-Meteo (voorspelling)",
      explanation: r.reason,
      question: r.question,
    });
  }

  // Travel — straight-line distance is exact math but not road distance, so it is
  // a derived value with a clear caveat (never a fabricated reistijd).
  if (travel.available && travel.straightLineKm != null) {
    F({
      key: "reisafstand",
      label: "Reisafstand (hemelsbreed)",
      status: "derived",
      value: `~${travel.straightLineKm} km hemelsbreed`,
      origin: "afgeleid (thuis→locatie)",
      explanation:
        "Hemelsbrede afstand van je thuislocatie naar de start; over de weg is het meer.",
      confidence: 0.8,
    });
  } else {
    const r = TRAVEL_REASON[travel.reason] ?? TRAVEL_REASON.no_location!;
    F({
      key: "reisafstand",
      label: "Reisafstand (hemelsbreed)",
      status: "missing",
      value: null,
      origin: "afgeleid (thuis→locatie)",
      explanation: r.reason,
      question: r.question,
    });
  }

  // Recommended arrival — derived from start time minus the discipline arrival buffer.
  if (race.startTime && subtractMinutes(race.startTime, logistics.arrivalBufferMin)) {
    const arrival = subtractMinutes(race.startTime, logistics.arrivalBufferMin)!;
    F({
      key: "aankomst",
      label: "Aanbevolen aankomsttijd",
      status: "derived",
      value: `${arrival} (±${logistics.arrivalBufferMin} min voor de start)`,
      origin: "afgeleid",
      explanation: logistics.rationale,
      confidence: 0.7,
    });
  } else {
    F({
      key: "aankomst",
      label: "Aanbevolen aankomsttijd",
      status: "missing",
      value: null,
      origin: "afgeleid",
      explanation: "Zonder starttijd is er geen aankomsttijd af te leiden.",
      question: "Vul de starttijd in voor een aanbevolen aankomsttijd.",
    });
  }

  // Departure from home — Sparki cannot compute road travel time, so this is
  // always an honest gap (never a fabricated vertrektijd).
  F({
    key: "vertrektijd",
    label: "Vertrektijd van huis",
    status: "missing",
    value: null,
    origin: "afgeleid",
    explanation: "Reistijd over de weg is niet automatisch te berekenen.",
    question: "Vul je geschatte reistijd in voor een vertrektijd van huis.",
  });

  // Linked route / GPX — found when one is attached, else route the athlete to it.
  if (routeLinked) {
    F({
      key: "route",
      label: "Verkenning / GPX",
      status: "found",
      value: "Gekoppelde route met GPX aanwezig",
      origin: "Routes",
    });
  } else {
    F({
      key: "route",
      label: "Verkenning / GPX",
      status: "missing",
      value: null,
      origin: "Routes",
      explanation: "Er is nog geen route/GPX aan deze wedstrijd gekoppeld.",
      question: "Plan of koppel een verkenningsroute (met GPX) zodat je het parcours kent.",
    });
  }

  // Things with no reachable, permitted source — kept as honest gaps, never faked.
  F({
    key: "uitslagen_eerder",
    label: "Uitslagen eerdere edities",
    status: "missing",
    value: null,
    origin: "geen bereikbare bron",
    explanation: "Hier is geen bereikbare, toegestane bron voor.",
    question: "Ken je een eerdere uitslag? Zet die in je notities, dan wordt die meegewogen.",
  });
  F({
    key: "deelnemerslijst",
    label: "Deelnemerslijst",
    status: "missing",
    value: null,
    origin: "geen bereikbare bron",
    explanation: "Een openbare deelnemerslijst is niet beschikbaar.",
    question: "Weet je tegen wie je rijdt? Noteer het bij je wedstrijdnotities.",
  });

  const gaps: RaceContextGap[] = fields
    .filter((f) => f.status === "missing")
    .map((f) => ({
      key: f.key,
      label: f.label,
      reason: f.explanation ?? "",
      question: f.question ?? "",
    }));

  const guidance = buildGuidance(race, d, fuel, weather, routeLinked);

  return {
    raceId: race.id,
    raceName: race.name,
    raceDate: race.raceDate,
    daysUntil: d,
    phase: phaseOf(d),
    priority: race.priority,
    fields,
    gaps,
    guidance,
  };
}

// ── Per-domain guidance (deterministic, honest, Dutch) ───────────────────────
// Only emits a line when the underlying data supports it — no filler.
function buildGuidance(
  race: Race,
  d: number,
  fuel: ReturnType<typeof buildRaceFuel>,
  weather: RaceWeather,
  routeLinked: boolean,
): Record<RaceContextDomain, string[]> {
  const g: Record<RaceContextDomain, string[]> = {
    training: [],
    voeding: [],
    materiaal: [],
    routes: [],
    herstel: [],
    coach: [],
    race: [],
  };
  const w = weather.available ? weather.weather : null;
  const isA = race.priority === "A";

  // Training (taper / last hard day).
  if (d === 0) g.training.push("Vandaag is het wedstrijddag — volg je warming-up en pacing.");
  else if (d >= 1 && d <= 3)
    g.training.push(
      "Houd de laatste dagen rustig; je laatste scherpe prikkel hoort ongeveer 3 dagen voor de start.",
    );
  else if (d >= 4 && d <= 10)
    g.training.push(`Nog ${d} dagen: nu mag de laatste kwaliteit erin, daarna bouw je af.`);
  if (isA && d >= 0) g.training.push("Dit is een A-doel — bouw bewust toe naar deze dag.");

  // Voeding (from the fuel engine + weather).
  if (fuel.durationKnown) {
    const totals = fuel.totalCarbsG
      ? ` (±${fuel.totalCarbsG.min}–${fuel.totalCarbsG.max} g totaal)`
      : "";
    g.voeding.push(
      `Mik op ${fuel.carbsPerHourG.min}–${fuel.carbsPerHourG.max} g koolhydraten per uur${totals} en ${fuel.fluidPerHourMl.min}–${fuel.fluidPerHourMl.max} ml drinken per uur.`,
    );
  } else {
    g.voeding.push("Vul de afstand in voor een koolhydraat- en drinkschema op maat.");
  }
  if (w?.tempMaxC != null && w.tempMaxC >= 25)
    g.voeding.push("Warm verwacht: drink extra en denk aan zout en elektrolyten.");
  g.voeding.push("Test je wedstrijdvoeding eerst in training — niets nieuws op de dag zelf.");

  // Materiaal (weather-driven, honest).
  if (w) {
    const rain = (w.precipMm ?? 0) >= 2 || (w.precipProbMaxPct ?? 0) >= 60;
    const wind = (w.windMaxKmh ?? 0) >= 40;
    const cold = w.tempMinC != null && w.tempMinC <= 5;
    const hot = w.tempMaxC != null && w.tempMaxC >= 25;
    if (rain)
      g.materiaal.push(
        "Kans op regen: kies grip-banden, iets lagere bandenspanning en neem regenkleding mee.",
      );
    if (wind)
      g.materiaal.push("Harde wind verwacht: let op zijwind/waaiers en kies je velgkeuze bewust.");
    if (cold) g.materiaal.push("Koud: leg armstukken, handschoenen en een onderhemd klaar.");
    if (hot) g.materiaal.push("Warm: lichte kleding en extra bidons.");
    if (!rain && !wind && !cold && !hot)
      g.materiaal.push("Rustig weer verwacht: standaard materiaalcheck volstaat.");
  }
  g.materiaal.push("Controleer fiets, banden en ketting ruim op tijd.");

  // Routes (verkenning / technische delen).
  if (routeLinked)
    g.routes.push(
      "Een verkenningsroute met GPX is gekoppeld — rijd 'm vooraf of bestudeer de lastige punten.",
    );
  else g.routes.push("Plan of koppel een verkenningsroute (met GPX) zodat je het parcours kent.");
  if (race.technicalSections)
    g.routes.push(`Let op de technische delen: ${race.technicalSections}.`);

  // Herstel & slaap (aanloop).
  if (d >= 1 && d <= 3)
    g.herstel.push(
      "Bouw je slaap nu op; de nachten vóór de wedstrijd tellen zwaarder dan de laatste nacht.",
    );
  g.herstel.push("Plan een rustige dag of korte uitloop direct na de wedstrijd.");

  // Coach (pacing / tactiek / mentaal).
  if (fuel.durationKnown && fuel.estimatedDurationMin != null && fuel.estimatedDurationMin > 150)
    g.coach.push("Pacing: start gecontroleerd, het is een lange wedstrijd — spaar voor de finale.");
  if (w && (w.windMaxKmh ?? 0) >= 40)
    g.coach.push("Tactisch: in de wind vallen waaiers — zit vooraan op de kritieke stroken.");
  if (isA) g.coach.push("Mentaal: focus op je eigen plan en de eerste belangrijke fase.");

  // Race summary line.
  const known = countKnown(race);
  g.race.push(
    `Alles wat bekend is over ${race.name} wordt gecombineerd; ontbrekende gegevens staan als openstaande vraag.`,
  );
  void known;

  // Drop empty domains' filler-free arrays as-is (callers handle empty).
  return g;
}

function countKnown(race: Race): number {
  let n = 0;
  if (race.location) n++;
  if (race.distanceKm != null) n++;
  if (race.elevationM != null) n++;
  if (race.startTime) n++;
  return n;
}

// ── Prompt block for the coach briefing / daily analysis ─────────────────────
// Internal context (not shown verbatim to the athlete). Compact, Dutch, honest.
export function formatRaceContextForPrompt(ctx: RaceContext): string {
  const lines: string[] = [];
  lines.push(
    `RACE-INTELLIGENTIE (eerstvolgende wedstrijd, over ${ctx.daysUntil}d, prioriteit ${ctx.priority}):`,
  );
  for (const f of ctx.fields) {
    if (f.status === "missing") continue;
    const tag = f.status === "derived" ? "afgeleid" : "gevonden";
    lines.push(`  - ${f.label}: ${f.value} [${tag}, bron: ${f.origin}]`);
  }
  if (ctx.gaps.length > 0) {
    lines.push(`  Nog niet gevonden: ${ctx.gaps.map((g) => g.label).join(", ")}.`);
  }
  const domainLabels: [RaceContextDomain, string][] = [
    ["training", "Training"],
    ["voeding", "Voeding"],
    ["materiaal", "Materiaal"],
    ["routes", "Routes"],
    ["herstel", "Herstel & slaap"],
    ["coach", "Tactiek & mentaal"],
  ];
  for (const [key, label] of domainLabels) {
    const items = ctx.guidance[key];
    if (items.length > 0) lines.push(`  ${label}: ${items.join(" ")}`);
  }
  return lines.join("\n");
}

// ── Async builders (wire the real sources) ───────────────────────────────────
async function hasLinkedRoute(race: Race): Promise<boolean> {
  if (race.plannedWorkoutId == null) return false;
  try {
    const [row] = await db
      .select({ id: routesTable.id })
      .from(routesTable)
      .where(
        and(
          eq(routesTable.clerkId, race.clerkId),
          eq(routesTable.linkedPlannedWorkoutId, race.plannedWorkoutId),
        ),
      )
      .limit(1);
    return !!row;
  } catch {
    return false;
  }
}

// Full race context with real weather, travel and route linkage resolved.
export async function buildRaceContext(
  race: Race,
  athlete: AthleteProfile | null,
): Promise<RaceContext> {
  const [insight, routeLinked] = await Promise.all([
    buildRaceInsight(
      { location: race.location, raceDate: race.raceDate, discipline: race.discipline },
      athlete,
    ),
    hasLinkedRoute(race),
  ]);
  return composeRaceContext(race, athlete, {
    weather: insight.weather,
    travel: insight.travel,
    logistics: insight.logistics,
    routeLinked,
  });
}

// ── Distribution: enrich the existing race-day report with real signals ──────
// The Race surface renders report.sections + dataGaps generically, so appending
// real weather/travel/route sections (and reconciling the weather gap) surfaces
// the engine's knowledge there without any frontend change.
function itemOf(label: string, value: string | null): ReportItem {
  return { label, value, known: value != null };
}

export async function buildRaceIntelEnriched(
  race: Race,
  athlete: AthleteProfile | null,
): Promise<RaceIntel & { context: RaceContext }> {
  const ctx = await buildRaceContext(race, athlete);
  const intel = buildRaceIntel(race, athlete);

  const field = (key: string) => ctx.fields.find((f) => f.key === key) ?? null;
  const weer = field("weer");
  const reis = field("reisafstand");
  const aankomst = field("aankomst");
  const route = field("route");

  const extra: ReportSection[] = [];

  extra.push({
    id: "weer",
    title: "Weer op locatie",
    summary:
      weer?.status === "found"
        ? `Voorspelling: ${weer.value}.`
        : weer?.explanation ?? "Weer nog niet beschikbaar.",
    items: [itemOf("Verwachting", weer?.status === "found" ? weer.value : null)],
  });

  extra.push({
    id: "reis",
    title: "Reis & aankomst",
    summary:
      reis?.status === "derived"
        ? "Hemelsbrede afstand en een aanbevolen aankomsttijd; vul je reistijd in voor een vertrektijd."
        : reis?.explanation ?? "Reisgegevens nog niet beschikbaar.",
    items: [
      itemOf("Afstand (hemelsbreed)", reis?.status === "derived" ? reis.value : null),
      itemOf("Aanbevolen aankomst", aankomst?.status === "derived" ? aankomst.value : null),
      itemOf("Vertrek van huis", null),
    ],
  });

  extra.push({
    id: "route",
    title: "Verkenning & route",
    summary:
      route?.status === "found"
        ? "Een verkenningsroute met GPX is gekoppeld."
        : "Nog geen route/GPX gekoppeld — plan een verkenning.",
    items: [itemOf("Route / GPX", route?.status === "found" ? route.value : null)],
  });

  // When real weather is now known, it is no longer an honest gap.
  const dataGaps =
    weer?.status === "found"
      ? intel.report.dataGaps.filter((g) => g !== "weersinschatting")
      : intel.report.dataGaps;

  return {
    ...intel,
    report: {
      ...intel.report,
      sections: [...intel.report.sections, ...extra],
      dataGaps,
    },
    context: ctx,
  };
}
