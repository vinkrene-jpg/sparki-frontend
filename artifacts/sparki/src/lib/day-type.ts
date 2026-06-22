// Day-type engine — SPARKI_MASTER_BLUEPRINT.md §4.
//
// The intelligence layer that decides what *today* is. Every day resolves to
// exactly one DayType, picked by a strict priority hierarchy. Each type maps to
// a briefing config (eyebrow / title / why / one primary action) used by the
// homepage so it answers "wat is vandaag & waarom" instead of being a dashboard.
//
// Core days (Coach / Sparki / Recovery / Rest / General) are detectable from
// existing data and are live now. The higher-priority types (Emergency, Race*)
// are part of the hierarchy but stay dormant until their data sources exist
// (health status on athlete_profiles, races/events table) — they never trigger
// on invented data.

export type DayType =
  | "emergency"
  | "race_day"
  | "day_before_race"
  | "race_week"
  | "coach_training"
  | "sparki_training"
  | "recovery"
  | "rest"
  | "general";

export type DayTypeContext = {
  todayWorkout: {
    type: string;
    source?: string | null;
    title?: string | null;
  } | null;
  hasProfile: boolean;
  // Reserved for later phases — absent today, so the matching day types stay
  // dormant. Wiring these up is the entry point for the Emergency and Race
  // homepages without touching the core-day logic below.
  healthStatus?: "ok" | "sick" | "injured" | null;
  race?: { isToday: boolean; isDayBefore: boolean; isThisWeek: boolean } | null;
};

function isRecoveryWorkout(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("recovery") || t.includes("herstel");
}

/**
 * Resolve the day type from context using the blueprint §4 hierarchy
 * (high → low). The first matching rule wins.
 */
export function detectDayType(ctx: DayTypeContext): DayType {
  // 1. Emergency / health (dormant until health status exists)
  if (ctx.healthStatus === "sick" || ctx.healthStatus === "injured") {
    return "emergency";
  }
  // 2–4. Race window (dormant until a races/events source exists)
  if (ctx.race?.isToday) return "race_day";
  if (ctx.race?.isDayBefore) return "day_before_race";
  if (ctx.race?.isThisWeek) return "race_week";

  // 5–7. Training days (blueprint §4 order: coach → sparki → recovery).
  // Coach plans win over Sparki plans (grondregel 4). SparkiTraining covers the
  // intense/normal sessions; a recovery-type workout that isn't coach-planned
  // resolves to Recovery so it gets the "keep it easy" briefing.
  const w = ctx.todayWorkout;
  if (w && w.source === "coach") return "coach_training";
  if (w && !isRecoveryWorkout(w.type)) return "sparki_training";
  if (w) return "recovery";

  // 8–9. No workout planned → rest; no profile at all → general fallback.
  if (ctx.hasProfile) return "rest";
  return "general";
}

export type DayTypeTone =
  | "train"
  | "coach"
  | "recovery"
  | "rest"
  | "race"
  | "alert"
  | "neutral";

export type DayTypeBriefingConfig = {
  eyebrow: string;
  title: string;
  why: string;
  primary: { label: string; href: string } | null;
  tone: DayTypeTone;
};

/**
 * Props every day-type homepage component receives from the DayHome dispatcher.
 * The dispatcher resolves the day type and its briefing once, then renders the
 * registered component — so each homepage only presents, never detects.
 */
export type DayHomeComponentProps = {
  dayType: DayType;
  briefing: DayTypeBriefingConfig;
};

/**
 * Registry mapping each DayType to a briefing builder. Static copy lives here;
 * the dynamic part (today's workout title) is filled from context. New day-type
 * homepages register their briefing here.
 */
export const dayTypeRegistry: Record<
  DayType,
  (ctx: DayTypeContext) => DayTypeBriefingConfig
> = {
  emergency: () => ({
    eyebrow: "HERSTEL VEREIST",
    title: "Gezondheid eerst",
    why: "Sparki heeft een gezondheidssignaal opgepikt. Training is vandaag geblokkeerd tot je hersteld bent.",
    primary: { label: "Bekijk herstel", href: "/you" },
    tone: "alert",
  }),
  race_day: () => ({
    eyebrow: "WEDSTRIJDDAG",
    title: "Race Day",
    why: "Vandaag is het wedstrijddag. Focus op warming-up, voeding en je racestrategie.",
    primary: { label: "Naar race", href: "/train" },
    tone: "race",
  }),
  day_before_race: () => ({
    eyebrow: "DAG VÓÓR RACE",
    title: "Klaarmaken voor morgen",
    why: "Taperen, materiaal checken en vroeg rusten. Morgen telt.",
    primary: { label: "Voorbereiding", href: "/train" },
    tone: "race",
  }),
  race_week: () => ({
    eyebrow: "RACE WEEK",
    title: "Aftellen naar je doel",
    why: "Bouw belasting af en bewaak je vorm richting je doelwedstrijd.",
    primary: { label: "Bekijk plan", href: "/train" },
    tone: "race",
  }),
  coach_training: (ctx) => ({
    eyebrow: "COACH-TRAINING",
    title: ctx.todayWorkout?.title || "Coach-training",
    why: "Je coach heeft deze training voor vandaag ingepland. Volg het plan.",
    primary: { label: "Bekijk training", href: "/train" },
    tone: "coach",
  }),
  sparki_training: (ctx) => ({
    eyebrow: "SPARKI-TRAINING",
    title: ctx.todayWorkout?.title || "Training van vandaag",
    why: "Sparki heeft deze sessie afgestemd op je vorm en herstel.",
    primary: { label: "Start training", href: "/train" },
    tone: "train",
  }),
  recovery: (ctx) => ({
    eyebrow: "HERSTELDAG",
    title: ctx.todayWorkout?.title || "Actief herstel",
    why: "Lichte inspanning om je herstel te versnellen — houd het rustig.",
    primary: { label: "Bekijk sessie", href: "/train" },
    tone: "recovery",
  }),
  rest: () => ({
    eyebrow: "RUSTDAG",
    title: "Volledige rust",
    why: "Geen training gepland. Geef je lichaam tijd om te herstellen en te adapteren.",
    primary: { label: "Log check-in", href: "/you" },
    tone: "rest",
  }),
  general: () => ({
    eyebrow: "VANDAAG",
    title: "Geen plan vandaag",
    why: "Geen training of wedstrijd gepland. Bekijk je vorm en plan je volgende stap.",
    primary: { label: "Plan training", href: "/train" },
    tone: "neutral",
  }),
};

export function getDayTypeBriefing(
  dayType: DayType,
  ctx: DayTypeContext,
): DayTypeBriefingConfig {
  return dayTypeRegistry[dayType](ctx);
}
