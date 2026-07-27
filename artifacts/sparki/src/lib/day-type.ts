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

import type { RacePhase } from "@/lib/race-types";

export type DayType =
  | "emergency"
  | "race_day"
  | "day_before_race"
  | "race_week"
  | "travel_day"
  | "post_race"
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
  // Athlete-set health status — drives the Emergency homepage. Race fields below
  // stay reserved for a later phase (no races/events source yet), keeping those
  // day types dormant without touching the core-day logic.
  healthStatus?: "ok" | "sick" | "injured" | null;
  // Resolved race context (typed provider layer) — the nearest relevant race and
  // its race-week phase. Null when no race is in a live window. Drives the race
  // homepages; sits just below Emergency in the priority hierarchy.
  race?: { phase: RacePhase; daysUntil: number; name: string } | null;
};

function isRecoveryWorkout(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("recovery") || t.includes("herstel");
}

// Ook gebruikt door de commerciële schil (knoptekst bij een geplande rustdag) —
// één rustdag-definitie voor heel Vandaag, geen tweede regel ernaast.
export function isRestWorkout(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("rest") || t.includes("rust") || t.includes("off");
}

/** Map a resolved race-week phase to its homepage day type. */
function raceDayType(phase: RacePhase): DayType {
  switch (phase) {
    case "race_day":
      return "race_day";
    case "day_before":
      return "day_before_race";
    case "race_week_build":
    case "race_week_taper":
      return "race_week";
    case "travel":
      return "travel_day";
    case "post_race":
      return "post_race";
  }
}

/**
 * Resolve the day type from context using the blueprint §4 hierarchy
 * (high → low). The first matching rule wins.
 */
export function detectDayType(ctx: DayTypeContext): DayType {
  // 1. Emergency / health — athlete-set sick/injury blocks training.
  if (ctx.healthStatus === "sick" || ctx.healthStatus === "injured") {
    return "emergency";
  }
  // 2–4. Race window — the resolved race context (typed provider) maps its
  //       phase to a race homepage. Sits just below Emergency.
  if (ctx.race) return raceDayType(ctx.race.phase);

  const w = ctx.todayWorkout;
  if (w) {
    // An explicitly planned rest day is "Rest" — it is not training, so it wins
    // over the coach/sparki branches regardless of who planned it (§4 #8).
    if (isRestWorkout(w.type)) return "rest";
    // 5. Coach plans lead (grondregel 4) — including coach-planned recovery
    //    sessions, per §4 #7 ("a recovery workout NOT planned by the coach").
    if (w.source === "coach") return "coach_training";
    // 7. A non-coach recovery workout → Recovery ("keep it easy" briefing).
    if (isRecoveryWorkout(w.type)) return "recovery";
    // 6. Everything else is a normal/intense Sparki session.
    return "sparki_training";
  }

  // 9. No workout at all → General / no-training fallback (rich briefing).
  //    Rest (#8) is reserved for explicitly planned rest days above.
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
  race_day: (ctx) => ({
    eyebrow: "WEDSTRIJDDAG",
    title: ctx.race?.name || "Race Day",
    why: "Vandaag is het zover. Volg je timings, check je materiaal en focus op je race.",
    // No briefing action — the single primary action is START RACE MODE on the
    // race-day homepage (grondregel 5: one primary action).
    primary: null,
    tone: "race",
  }),
  day_before_race: (ctx) => ({
    eyebrow: "DAG VÓÓR RACE",
    title: ctx.race ? `Morgen: ${ctx.race.name}` : "Klaarmaken voor morgen",
    why: "Taperen, materiaal checken en vroeg rusten. Loop je checklist na en bereid je logistiek voor.",
    primary: { label: "Open checklist", href: "#prep-checklist" },
    tone: "race",
  }),
  race_week: (ctx) => {
    const taper = (ctx.race?.daysUntil ?? 7) <= 3;
    return {
      eyebrow: "RACE WEEK",
      title: ctx.race
        ? `Nog ${ctx.race.daysUntil} ${ctx.race.daysUntil === 1 ? "dag" : "dagen"} tot ${ctx.race.name}`
        : "Aftellen naar je doel",
      why: taper
        ? "Taperfase: bouw belasting af en kom fris aan de start. Scherp, niet moe."
        : "Opbouw richting je doelwedstrijd. Kwaliteit boven volume, bewaak je vorm.",
      primary: { label: "Bekijk race", href: "/races" },
      tone: "race",
    };
  },
  travel_day: (ctx) => ({
    eyebrow: "REISDAG",
    title: ctx.race ? `Op weg naar ${ctx.race.name}` : "Reisdag",
    why: "Vandaag reizen. Houd je benen los, eet en drink goed, en check je bagage.",
    primary: { label: "Reisplan", href: "/races" },
    tone: "race",
  }),
  post_race: (ctx) => ({
    eyebrow: "NA DE RACE",
    title: ctx.race ? `${ctx.race.name} — terugblik` : "Herstel & analyse",
    why: "Geef je lichaam rust en leg je race vast. Reflecteren maakt je sneller.",
    primary: { label: "Log je race", href: "/you" },
    tone: "recovery",
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
