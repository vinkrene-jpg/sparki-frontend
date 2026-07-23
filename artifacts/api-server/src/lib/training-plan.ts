// Autonomous training-plan engine (task #17). Sparki coaches an athlete who has
// NO human coach by building a real, persisted, validated training plan from the
// athlete's own profile, recovery signals, and upcoming races.
//
// Honesty rules (hard project constraint):
//  - Every NUMBER (volume, durations, intensity distribution, rest) is produced
//    by the deterministic guardrail engine below — never by the AI.
//  - The AI only writes prose (session titles/descriptions + plan summary), and
//    there is always a deterministic fallback if the AI is unavailable.
//  - Routes are real ORS routes (see plan-routes.ts) or honestly absent.
//  - When the athlete has an accepted coach, this engine is advisory-only and
//    NEVER writes planned_workouts (the commit path is gated in the route layer).

import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  userProfilesTable,
  athleteDailyMetricsTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  racesTable,
  trainingPlansTable,
  planDaysTable,
  coachAthleteLinksTable,
  routesTable,
} from "@workspace/db";
import { aiMessage } from "./ai/gateway";
import { computeReadiness } from "./sharing";
import { computeLoad, computeRiskSignal, type Load, type RiskSignal } from "./recovery-load";
import {
  disciplineToBike,
  generateAndSavePlanRoute,
  attachRouteToWorkout,
  estimateDistanceKm,
} from "./plan-routes";
// Weather guard (additive, delimited): the only weather coupling in the engine.
import { getForecastByDate } from "./weather/open-meteo";
import { assessTraining, type WeatherSeverity } from "./weather/assess";

const HORIZON_DAYS = 21; // concrete 7-day week + ~2 provisional preview weeks
const COMMIT_DAYS = 7; // first week is committed (also written as planned_workouts)

// JS getUTCDay(): 0=Sun .. 6=Sat → our weekday keys.
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db_ = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db_ - da) / 86_400_000);
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export type PlanInputs = {
  clerkId: string;
  displayName: string | null;
  experienceLevel: string | null;
  availableDays: string[];
  weeklyHourTarget: number | null;
  loadCapacity: string | null;
  injuryHistory: string | null;
  trainingPreferences: string | null;
  discipline: string | null;
  ftp: number | null;
  goals: string | null;
  healthStatus: string;
  home: { lat: number; lon: number; label: string | null } | null;
  readiness: ReturnType<typeof computeReadiness>;
  // Load model (CTL/ATL/TSB) + the composite risk signal from the Recovery &
  // Load engine, derived from real TSS history. Drives week-volume adaptation.
  load: Load;
  risk: RiskSignal;
  recentSessionCount: number;
  nextRace: {
    name: string;
    raceDate: string;
    priority: string;
    daysAway: number;
  } | null;
  phase: "base" | "build" | "peak" | "taper";
  racesByDate: Map<string, { name: string; priority: string }>;
  // Per-date weather severity for a representative long outdoor ride, over the
  // committed week only (empty when no home coords / forecast). Used solely by
  // the additive weather guard in buildSkeleton — never fabricated.
  weatherByDate: Map<string, WeatherSeverity>;
};

export type InputCompleteness = {
  ready: boolean;
  missing: string[];
};

export function checkCompleteness(i: PlanInputs): InputCompleteness {
  const missing: string[] = [];
  if (!i.weeklyHourTarget || i.weeklyHourTarget <= 0)
    missing.push("weeklyHourTarget");
  if (!i.availableDays || i.availableDays.length === 0)
    missing.push("availableDays");
  if (!i.experienceLevel) missing.push("experienceLevel");
  return { ready: missing.length === 0, missing };
}

function derivePhase(daysAway: number | null): PlanInputs["phase"] {
  if (daysAway == null) return "base";
  if (daysAway <= 10) return "taper";
  if (daysAway <= 28) return "peak";
  if (daysAway <= 70) return "build";
  return "base";
}

export async function gatherInputs(clerkId: string): Promise<PlanInputs> {
  const today = todayStr();
  const [
    [user],
    [athlete],
    [latestMetric],
    recentSessions,
    loadSessions,
    upcomingRaces,
  ] = await Promise.all([
    db
      .select({ displayName: userProfilesTable.displayName })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, clerkId))
      .orderBy(desc(athleteDailyMetricsTable.metricDate))
      .limit(1),
    db
      .select({ sessionDate: trainingSessionsTable.sessionDate })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, addDaysStr(today, -14)),
        ),
      ),
    db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, addDaysStr(today, -90)),
        ),
      ),
    db
      .select({
        name: racesTable.name,
        raceDate: racesTable.raceDate,
        priority: racesTable.priority,
      })
      .from(racesTable)
      .where(
        and(
          eq(racesTable.clerkId, clerkId),
          gte(racesTable.raceDate, today),
          // Geannuleerde wedstrijden sturen het plan niet meer.
          ne(racesTable.status, "geannuleerd"),
        ),
      )
      .orderBy(racesTable.raceDate),
  ]);

  const home =
    athlete?.homeLat != null && athlete?.homeLon != null
      ? {
          lat: Number(athlete.homeLat),
          lon: Number(athlete.homeLon),
          label: athlete.homeLabel ?? null,
        }
      : null;

  // Prefer the next priority-A race for phasing; otherwise the soonest race.
  const aRace = upcomingRaces.find((r) => r.priority === "A");
  const next = aRace ?? upcomingRaces[0] ?? null;
  const daysAway = next ? daysBetween(today, next.raceDate) : null;

  const racesByDate = new Map<string, { name: string; priority: string }>();
  for (const r of upcomingRaces) {
    if (daysBetween(today, r.raceDate) <= HORIZON_DAYS) {
      racesByDate.set(r.raceDate, { name: r.name, priority: r.priority });
    }
  }

  // Weather guard input (best-effort): severity of a representative long outdoor
  // ride per committed-week date. Never blocks plan generation — empty on failure.
  const weatherByDate = new Map<string, WeatherSeverity>();
  if (home) {
    try {
      const fc = await getForecastByDate(home.lat, home.lon, COMMIT_DAYS);
      for (const [date, day] of fc) {
        const advisory = assessTraining(
          { isRest: false, trainingType: "duur", estDurationMin: 150, outdoor: true },
          day,
        );
        weatherByDate.set(date, advisory?.severity ?? "ok");
      }
    } catch {
      // Honest degradation: no weather → guard simply doesn't fire.
    }
  }

  // Recovery & Load: real load model from 90-day TSS history + composite risk
  // signal (form, acute:chronic spike, readiness, health). Drives adaptation.
  const readiness = computeReadiness(latestMetric ?? null);
  const healthStatus = athlete?.healthStatus ?? "ok";
  const load = computeLoad(loadSessions);
  const risk = computeRiskSignal({ load, readiness, healthStatus });

  // Actieve doelen (incl. horizon + voortgang) sturen de planning mee. Additive:
  // when the athlete has no goal picture this stays exactly athlete.goals.
  let goalsText = athlete?.goals ?? null;
  try {
    const { goalsContextLine } = await import("./goals");
    const line = await goalsContextLine(clerkId);
    if (line) goalsText = goalsText ? `${goalsText} · Doelen: ${line}` : `Doelen: ${line}`;
  } catch {
    // Honest degradation: goals block missing → plan uses profile goals only.
  }

  return {
    clerkId,
    displayName: user?.displayName ?? null,
    experienceLevel: athlete?.experienceLevel ?? null,
    availableDays: athlete?.availableDays ?? [],
    weeklyHourTarget: athlete?.weeklyHourTarget ?? null,
    loadCapacity: athlete?.loadCapacity ?? null,
    injuryHistory: athlete?.injuryHistory ?? null,
    trainingPreferences: athlete?.trainingPreferences ?? null,
    discipline: athlete?.discipline ?? null,
    ftp: athlete?.ftp ?? null,
    goals: goalsText,
    healthStatus,
    home,
    readiness,
    load,
    risk,
    recentSessionCount: recentSessions.length,
    nextRace: next
      ? {
          name: next.name,
          raceDate: next.raceDate,
          priority: next.priority,
          daysAway: daysAway!,
        }
      : null,
    phase: derivePhase(daysAway),
    racesByDate,
    weatherByDate,
  };
}

// ── Deterministic skeleton ───────────────────────────────────────────────────

type DayKind =
  | "rest"
  | "duur"
  | "long"
  | "herstel"
  | "tempo"
  | "interval"
  | "wedstrijd";

// Concrete training types a planned workout can carry (rest days map to null).
type TrainingType = "duur" | "herstel" | "tempo" | "interval" | "wedstrijd";

export type DaySkeleton = {
  offset: number;
  date: string;
  weekIndex: number;
  kind: DayKind;
  isRest: boolean;
  focus: string;
  trainingType: TrainingType | null;
  intensityLabel: string;
  estDurationMin: number | null;
  routeNeeded: boolean;
  rationale: string;
};

const FOCUS: Record<DayKind, string> = {
  rest: "Rust",
  duur: "Duurtraining",
  long: "Lange duurrit",
  herstel: "Herstelrit",
  tempo: "Tempotraining",
  interval: "Intervaltraining",
  wedstrijd: "Wedstrijd",
};

const INTENSITY: Record<DayKind, string> = {
  rest: "Geen training",
  duur: "Zone 2 · duurvermogen",
  long: "Zone 2 · lange duur",
  herstel: "Zone 1 · actief herstel",
  tempo: "Zone 3 · tempo",
  interval: "Zone 4–5 · intervallen",
  wedstrijd: "Wedstrijdinspanning",
};

// Route generator training type for each kind (null = no route).
const KIND_TRAINING: Record<DayKind, TrainingType | null> = {
  rest: null,
  duur: "duur",
  long: "duur",
  herstel: "herstel",
  tempo: "tempo",
  interval: "interval",
  wedstrijd: "wedstrijd",
};

// Only steady outdoor rides get a generated route. Intervals are structured
// (often indoor / on a known stretch), recovery is a short easy spin, and race
// day is the race itself — none of those get an auto-generated route.
const KIND_ROUTE_NEEDED: Record<DayKind, boolean> = {
  rest: false,
  duur: true,
  long: true,
  herstel: false,
  tempo: true,
  interval: false,
  wedstrijd: false,
};

// Relative volume weight per kind, used to split the weekly minute budget.
const KIND_WEIGHT: Record<DayKind, number> = {
  rest: 0,
  duur: 1.2,
  long: 2.2,
  herstel: 0.6,
  tempo: 1.1,
  interval: 1.0,
  wedstrijd: 0,
};

type ExperienceTier = "beginner" | "intermediate" | "advanced" | "elite";

function experienceTier(experience: string | null): ExperienceTier {
  if (experience === "beginner") return "beginner";
  if (experience === "advanced") return "advanced";
  if (experience === "elite") return "elite";
  return "intermediate";
}

// Coaching-realistic ceilings per single session, so a weekly-hour target (which
// for many riders is only an ESTIMATE) can never be crammed into a few days as an
// absurd session — e.g. 13 u/week ÷ 3 dagen used to push the long ride against a
// hard 360-min (6 u) cap. A real coach never prescribes a 6-hour ride to an
// intermediate. These caps scale with experience; minutes that don't fit are
// simply not scheduled — honest realism beats a mathematically-tidy weekly total.
const SESSION_CAP_MIN: Record<DayKind, Record<ExperienceTier, number>> = {
  rest: { beginner: 0, intermediate: 0, advanced: 0, elite: 0 },
  long: { beginner: 120, intermediate: 180, advanced: 240, elite: 300 },
  duur: { beginner: 90, intermediate: 120, advanced: 150, elite: 180 },
  tempo: { beginner: 75, intermediate: 90, advanced: 105, elite: 120 },
  interval: { beginner: 60, intermediate: 75, advanced: 90, elite: 105 },
  herstel: { beginner: 45, intermediate: 60, advanced: 60, elite: 75 },
  // Race duration is the race itself; the skeleton never invents it here.
  wedstrijd: { beginner: 360, intermediate: 360, advanced: 360, elite: 360 },
};

function sessionCapMin(kind: DayKind, experience: string | null): number {
  return SESSION_CAP_MIN[kind][experienceTier(experience)];
}

function qualityDaysFor(experience: string | null, phase: PlanInputs["phase"]) {
  let q = experience === "beginner" ? 1 : experience === "elite" ? 3 : 2;
  if (phase === "taper") q = Math.max(1, q - 1);
  if (phase === "base") q = Math.min(q, experience === "beginner" ? 1 : 2);
  return q;
}

function spacedIndices(n: number, q: number): number[] {
  if (q <= 0 || n <= 0) return [];
  const out: number[] = [];
  const used = new Set<number>();
  for (let k = 1; k <= q; k++) {
    let idx = Math.round((k * n) / (q + 1));
    if (idx >= n) idx = n - 1;
    if (idx < 0) idx = 0;
    while (used.has(idx) && idx < n - 1) idx++;
    while (used.has(idx) && idx > 0) idx--;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(idx);
    }
  }
  return out;
}

function weekFactor(
  weekIndex: number,
  i: PlanInputs,
): { factor: number; note: string | null } {
  let factor = 1.0;
  let note: string | null = null;
  if (i.phase === "base") factor = 0.95;
  if (i.phase === "taper") {
    factor = 0.6;
    note = "tapervolume verlaagd richting je wedstrijd";
  }
  // Provisional far week eases off slightly (built-in deload rhythm).
  if (weekIndex === 2 && (i.phase === "build" || i.phase === "peak")) {
    factor = Math.min(factor, 0.8);
    note = "lichtere week ingepland voor herstel en supercompensatie";
  }
  // Recovery & Load signal: ease off when the composite risk is elevated. High
  // risk pulls the committed week down hard and trims the provisional weeks; a
  // moderate signal nudges only the committed week. The note is plain Dutch.
  if (i.risk.level === "high") {
    if (weekIndex === 0) {
      factor = Math.min(factor, 0.6);
      note = "rustiger gestart: je belasting en herstel geven een verhoogd risico";
    } else {
      factor *= 0.9;
    }
  } else if (i.risk.level === "moderate" && weekIndex === 0) {
    factor = Math.min(factor, 0.8);
    note = note ?? "iets rustiger gestart om je belasting in balans te houden";
  }
  if (i.loadCapacity === "low") factor *= 0.9;
  if (i.loadCapacity === "high") factor *= 1.05;
  return { factor, note };
}

// Build the full deterministic horizon. All numbers come from here.
export function buildSkeleton(i: PlanInputs, startDate: string): DaySkeleton[] {
  const days: DaySkeleton[] = [];

  // Health gate: no training pressure while sick/injured — calm recovery only.
  const blockTraining = i.healthStatus === "sick" || i.healthStatus === "injured";

  // First pass: assign a kind per date.
  type Pre = { offset: number; date: string; weekIndex: number; kind: DayKind };
  const pre: Pre[] = [];
  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const date = addDaysStr(startDate, offset);
    const weekIndex = Math.floor(offset / 7);
    pre.push({ offset, date, weekIndex, kind: "rest" });
  }

  if (!blockTraining) {
    for (let w = 0; w < 3; w++) {
      const weekDays = pre.filter((p) => p.weekIndex === w);
      // Race days within this week are fixed first.
      for (const p of weekDays) {
        const race = i.racesByDate.get(p.date);
        if (race) p.kind = "wedstrijd";
      }
      // Day before an A-race becomes an opener (light), not a hard day.
      for (const p of weekDays) {
        const nextRace = i.racesByDate.get(addDaysStr(p.date, 1));
        if (nextRace && nextRace.priority === "A" && p.kind === "rest") {
          p.kind = "herstel";
        }
      }

      // Available training days that aren't already a race/opener.
      const avail = weekDays.filter(
        (p) =>
          i.availableDays.includes(DOW[new Date(`${p.date}T00:00:00Z`).getUTCDay()]!) &&
          p.kind === "rest",
      );
      const n = avail.length;
      if (n === 0) continue;

      const q = Math.min(qualityDaysFor(i.experienceLevel, i.phase), Math.max(0, n - 1));
      const qIdx = new Set(spacedIndices(n, q));

      // Long ride: prefer a weekend day that isn't a quality day.
      const longCandidates = avail
        .map((p, idx) => ({ p, idx }))
        .filter((x) => !qIdx.has(x.idx));
      let longIdx = -1;
      for (const c of longCandidates) {
        const dow = DOW[new Date(`${c.p.date}T00:00:00Z`).getUTCDay()]!;
        if (dow === "sat" || dow === "sun") longIdx = c.idx;
      }
      if (longIdx < 0 && longCandidates.length > 0)
        longIdx = longCandidates[longCandidates.length - 1]!.idx;

      let qualitySeen = 0;
      avail.forEach((p, idx) => {
        if (qIdx.has(idx)) {
          // Alternate hard sessions: interval, tempo, interval, ...
          p.kind = qualitySeen % 2 === 0 ? "interval" : "tempo";
          qualitySeen++;
        } else if (idx === longIdx) {
          p.kind = "long";
        } else {
          p.kind = "duur";
        }
      });

      // ── Weather guard (additive) ───────────────────────────────────────────
      // Committed week only, real forecast only: if the long ride lands on a
      // clearly-severe day (storm/heat/ice), move it to a non-severe endurance
      // day when one exists. If no safe day exists we leave it as-is — the
      // per-day advisory in the view will warn honestly rather than hide it.
      if (w === 0 && longIdx >= 0 && i.weatherByDate.size > 0) {
        const longDay = avail[longIdx]!;
        if (i.weatherByDate.get(longDay.date) === "severe") {
          let altIdx = -1;
          avail.forEach((p, idx) => {
            if (altIdx >= 0 || idx === longIdx) return;
            if (qIdx.has(idx) || p.kind !== "duur") return;
            if (i.weatherByDate.get(p.date) !== "severe") altIdx = idx;
          });
          if (altIdx >= 0) {
            avail[altIdx]!.kind = "long";
            longDay.kind = "duur";
          }
        }
      }

      // Insert one recovery spin right after a hard day when volume allows it.
      if (n >= 5) {
        for (let k = 1; k < avail.length; k++) {
          const prev = avail[k - 1]!;
          const cur = avail[k]!;
          if (
            (prev.kind === "interval" || prev.kind === "tempo") &&
            cur.kind === "duur"
          ) {
            cur.kind = "herstel";
            break;
          }
        }
      }
    }
  }

  // Second pass: assign durations from the weekly minute budget, then build rows.
  for (let w = 0; w < 3; w++) {
    const weekPre = pre.filter((p) => p.weekIndex === w);
    const { factor, note } = weekFactor(w, i);
    const weeklyMin = Math.round((i.weeklyHourTarget ?? 0) * 60 * factor);
    const weightSum = weekPre.reduce((s, p) => s + KIND_WEIGHT[p.kind], 0);

    for (const p of weekPre) {
      const kind = p.kind;
      const isRest = kind === "rest";
      let dur: number | null = null;
      if (!isRest && kind !== "wedstrijd" && weightSum > 0) {
        const raw = (weeklyMin * KIND_WEIGHT[kind]) / weightSum;
        const cap = sessionCapMin(kind, i.experienceLevel);
        dur = Math.max(30, Math.min(cap, Math.round(raw / 5) * 5));
      }
      if (kind === "herstel" && dur != null) dur = Math.min(dur, 60);

      const rationale = dayRationale(kind, i, note, w);
      days.push({
        offset: p.offset,
        date: p.date,
        weekIndex: w,
        kind,
        isRest,
        focus:
          kind === "wedstrijd"
            ? (i.racesByDate.get(p.date)?.name ?? FOCUS.wedstrijd)
            : FOCUS[kind],
        trainingType: KIND_TRAINING[kind],
        intensityLabel: INTENSITY[kind],
        estDurationMin: dur,
        routeNeeded: KIND_ROUTE_NEEDED[kind] && !blockTraining,
        rationale,
      });
    }
  }

  return days.sort((a, b) => a.offset - b.offset);
}

function dayRationale(
  kind: DayKind,
  i: PlanInputs,
  weekNote: string | null,
  weekIndex: number,
): string {
  if (i.healthStatus === "sick")
    return "Volledige rust: je hebt jezelf ziek gemeld, dus geen trainingsprikkel.";
  if (i.healthStatus === "injured")
    return "Volledige rust: je hebt een blessure gemeld. Eerst herstellen voor training.";
  switch (kind) {
    case "rest":
      return "Geplande rustdag — herstel is waar je sterker van wordt.";
    case "long":
      return `Langste rit van de week voor je duurvermogen${weekNote ? `; ${weekNote}` : ""}.`;
    case "duur":
      return `Rustige duurprikkel in zone 2, de basis van je conditie${weekNote ? `; ${weekNote}` : ""}.`;
    case "herstel":
      return "Kort en heel rustig — actief herstel om de benen los te maken.";
    case "tempo":
      return "Tempoblok in zone 3 om je duurvermogen aan te scherpen.";
    case "interval":
      return "Intensieve intervallen voor je topsnelheid en VO2max.";
    case "wedstrijd": {
      const r = i.nextRace;
      return r ? `Wedstrijddag: ${r.name}.` : "Wedstrijddag.";
    }
  }
}

// ── AI prose (titles + descriptions + summary), with deterministic fallback ──

type AiContent = {
  summary: string;
  titles: Map<number, string>;
  descriptions: Map<number, string>;
};

function templateSummary(i: PlanInputs, skeleton: DaySkeleton[]): string {
  const trainingDays = skeleton.filter(
    (d) => !d.isRest && d.weekIndex === 0,
  ).length;
  const hrs = i.weeklyHourTarget ?? 0;
  const phaseNl =
    i.phase === "taper"
      ? "taperfase richting je wedstrijd"
      : i.phase === "peak"
        ? "scherpstelfase"
        : i.phase === "build"
          ? "opbouwfase"
          : "basisfase";
  const raceLine = i.nextRace
    ? ` Je volgende wedstrijd (${i.nextRace.name}) is over ${i.nextRace.daysAway} dagen, dus we zitten in de ${phaseNl}.`
    : ` Er staat geen wedstrijd gepland, dus we werken aan algemene conditie in de ${phaseNl}.`;
  const healthLine =
    i.healthStatus !== "ok"
      ? " Omdat je je niet fit hebt gemeld, staat er voorlopig geen training — eerst herstellen."
      : "";
  return `Dit schema is gebaseerd op jouw profiel: ${trainingDays} trainingsdagen deze week binnen ~${hrs} uur, polariserend opgebouwd (veel rustig, gedoseerd intensief).${raceLine}${healthLine} De eerste 7 dagen liggen vast; de twee weken daarna zijn een voorlopige vooruitblik die meebeweegt met je herstel.`;
}

function templateDescription(d: DaySkeleton): string {
  if (d.isRest) return "Rustdag. Geen gestructureerde training.";
  const dur = d.estDurationMin ? `${d.estDurationMin} min` : "";
  switch (d.kind) {
    case "long":
      return `Lange, gelijkmatige rit (${dur}) in zone 2. Houd het tempo onder je drempel en blijf comfortabel kunnen praten.`;
    case "duur":
      return `Rustige duurrit (${dur}) in zone 2. Constant tempo, lage hartslag, opbouw van je aerobe basis.`;
    case "herstel":
      return `Kort herstelritje (${dur}) in zone 1. Heel licht trappen om af te voeren, geen druk op de pedalen.`;
    case "tempo":
      return `Tempotraining (${dur}): na inrijden 2–3 blokken in zone 3 met rustige tussenstukken.`;
    case "interval":
      return `Intervaltraining (${dur}): goed inrijden, daarna intensieve herhalingen in zone 4–5 met volledige rust ertussen, dan uitrijden.`;
    case "wedstrijd":
      return "Wedstrijddag — focus op je race-uitvoering en voeding.";
    default:
      return "";
  }
}

function buildFallbackContent(
  i: PlanInputs,
  skeleton: DaySkeleton[],
): AiContent {
  const titles = new Map<number, string>();
  const descriptions = new Map<number, string>();
  for (const d of skeleton) {
    titles.set(d.offset, d.focus);
    descriptions.set(d.offset, templateDescription(d));
  }
  return { summary: templateSummary(i, skeleton), titles, descriptions };
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// AI enriches prose ONLY. Numbers/types are never read back from the model — we
// keep the deterministic skeleton and merge in titles/descriptions/summary.
async function buildAiContent(
  i: PlanInputs,
  skeleton: DaySkeleton[],
): Promise<AiContent> {
  const fallback = buildFallbackContent(i, skeleton);
  const trainingDays = skeleton.filter((d) => !d.isRest);
  if (trainingDays.length === 0) return fallback;

  const facts = {
    athlete: {
      experience: i.experienceLevel,
      discipline: i.discipline,
      ftp: i.ftp,
      weeklyHours: i.weeklyHourTarget,
      loadCapacity: i.loadCapacity,
      goals: i.goals,
      injuryHistory: i.injuryHistory,
      preferences: i.trainingPreferences,
      healthStatus: i.healthStatus,
      readiness: i.readiness.label,
      phase: i.phase,
      nextRace: i.nextRace,
    },
    days: skeleton.map((d) => ({
      offset: d.offset,
      date: d.date,
      focus: d.focus,
      kind: d.kind,
      intensity: d.intensityLabel,
      durationMin: d.estDurationMin,
      isRest: d.isRest,
    })),
  };

  try {
    const message = await aiMessage("plan_proposals", null, {
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system:
        "Je bent Sparki, een Nederlandstalige wielercoach. Je krijgt een DETERMINISTISCH trainingsschema (dagen, types, duur, intensiteit) dat AL vaststaat. Verander NOOIT de getallen, types of duur. Schrijf alleen heldere, motiverende prozateksten. Verzin geen feiten, beloftes of getallen die niet gegeven zijn. Antwoord UITSLUITEND met JSON in dit formaat: {\"summary\": string, \"days\": [{\"offset\": number, \"title\": string, \"description\": string}]}. Geef voor elke niet-rustdag een korte titel (max 6 woorden) en een concrete beschrijving (1-2 zinnen). Geen markdown.",
      messages: [
        {
          role: "user",
          content: `Schema en atleetgegevens (JSON):\n${JSON.stringify(facts)}\n\nSchrijf de samenvatting en per niet-rustdag titel + beschrijving.`,
        },
      ],
    });
    const block = message.content[0];
    if (!block || block.type !== "text") return fallback;
    const parsed = extractJson(block.text) as
      | { summary?: unknown; days?: unknown }
      | null;
    if (!parsed) return fallback;

    const titles = new Map(fallback.titles);
    const descriptions = new Map(fallback.descriptions);
    if (Array.isArray(parsed.days)) {
      for (const raw of parsed.days) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        const offset = Number(o.offset);
        if (!Number.isInteger(offset)) continue;
        const skel = skeleton.find((d) => d.offset === offset);
        if (!skel || skel.isRest) continue; // never let AI fill rest days
        if (typeof o.title === "string" && o.title.trim())
          titles.set(offset, o.title.trim().slice(0, 80));
        if (typeof o.description === "string" && o.description.trim())
          descriptions.set(offset, o.description.trim().slice(0, 600));
      }
    }
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim().slice(0, 1200)
        : fallback.summary;
    return { summary, titles, descriptions };
  } catch {
    return fallback;
  }
}

// ── Persistence + route coupling ─────────────────────────────────────────────

// Map our day kind to the planned_workouts.type vocabulary.
function workoutType(kind: DayKind): string {
  switch (kind) {
    case "interval":
      return "interval";
    case "tempo":
      return "tempo";
    case "herstel":
      return "recovery";
    case "wedstrijd":
      return "race";
    case "rest":
      return "rest";
    default:
      return "ride";
  }
}

export type GenerateResult = {
  planId: number;
  routesGenerated: number;
  routesAttempted: number;
};

// Generate, validate, and persist an autonomous plan. mode "autonomous" writes
// committed planned_workouts and generates routes; mode "advisory" persists the
// plan for display only and never touches planned_workouts (used when coached).
export async function generatePlan(
  clerkId: string,
  mode: "autonomous" | "advisory",
): Promise<GenerateResult> {
  const inputs = await gatherInputs(clerkId);
  const start = todayStr();
  const skeleton = buildSkeleton(inputs, start);
  const aiContent = await buildAiContent(inputs, skeleton);

  const horizonEnd = addDaysStr(start, HORIZON_DAYS - 1);
  const inputSnapshot = {
    experienceLevel: inputs.experienceLevel,
    availableDays: inputs.availableDays,
    weeklyHourTarget: inputs.weeklyHourTarget,
    loadCapacity: inputs.loadCapacity,
    discipline: inputs.discipline,
    phase: inputs.phase,
    healthStatus: inputs.healthStatus,
    readiness: inputs.readiness.label,
    nextRace: inputs.nextRace,
    homeLabel: inputs.home?.label ?? null,
    hasHome: inputs.home != null,
  };

  // Track committed route-needed sessions to generate routes for after commit.
  const routeJobs: Array<{
    plannedWorkoutId: number;
    trainingType: TrainingType;
    durationMin: number;
    date: string;
  }> = [];

  const planId = await db.transaction(async (tx) => {
    // Archive prior active plans and remove their still-planned future sessions
    // so a regenerate cleanly replaces rather than duplicates.
    await tx
      .update(trainingPlansTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(trainingPlansTable.clerkId, clerkId),
          eq(trainingPlansTable.status, "active"),
        ),
      );
    await tx
      .delete(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          isNotNull(plannedWorkoutsTable.planId),
          eq(plannedWorkoutsTable.status, "planned"),
          gte(plannedWorkoutsTable.scheduledDate, start),
        ),
      );

    const [plan] = await tx
      .insert(trainingPlansTable)
      .values({
        clerkId,
        status: "active",
        mode,
        weekStartDate: start,
        horizonEndDate: horizonEnd,
        weeklyHourTarget: inputs.weeklyHourTarget,
        inputSnapshot,
        summary: aiContent.summary,
        adaptationState: { adaptationCount: 0, lastAdaptedAt: null, notes: [] },
      })
      .returning({ id: trainingPlansTable.id });

    const newPlanId = plan!.id;

    for (const d of skeleton) {
      const committed =
        mode === "autonomous" && d.offset < COMMIT_DAYS && !d.isRest;
      let plannedWorkoutId: number | null = null;

      if (committed) {
        const [pw] = await tx
          .insert(plannedWorkoutsTable)
          .values({
            clerkId,
            scheduledDate: d.date,
            type: workoutType(d.kind),
            title: aiContent.titles.get(d.offset) ?? d.focus,
            description: aiContent.descriptions.get(d.offset) ?? null,
            targetDurationMin: d.estDurationMin,
            status: "planned",
            source: "sparki",
            planId: newPlanId,
          })
          .returning({ id: plannedWorkoutsTable.id });
        plannedWorkoutId = pw!.id;
        if (
          d.routeNeeded &&
          d.trainingType &&
          d.estDurationMin &&
          inputs.home
        ) {
          routeJobs.push({
            plannedWorkoutId,
            trainingType: d.trainingType,
            durationMin: d.estDurationMin,
            date: d.date,
          });
        }
      }

      await tx.insert(planDaysTable).values({
        planId: newPlanId,
        clerkId,
        dayDate: d.date,
        weekIndex: d.weekIndex,
        focus: d.focus,
        trainingType: d.trainingType,
        intensityLabel: d.intensityLabel,
        estDurationMin: d.estDurationMin,
        isRest: d.isRest,
        routeNeeded: d.routeNeeded,
        rationale: aiContent.descriptions.get(d.offset) ?? d.rationale,
        committed,
        plannedWorkoutId,
      });
    }

    return newPlanId;
  });

  // Route coupling happens AFTER commit (ORS is a slow external call; we must
  // not hold a DB transaction open across the network). Each failure degrades
  // honestly to "no route" — never a fabricated one.
  let routesGenerated = 0;
  if (mode === "autonomous" && inputs.home) {
    const bike = disciplineToBike(inputs.discipline);
    for (const job of routeJobs) {
      const targetKm = estimateDistanceKm(bike, job.durationMin);
      const seed = hashSeed(`${clerkId}:${job.date}:${planId}`);
      const route = await generateAndSavePlanRoute({
        clerkId,
        start: { lat: inputs.home.lat, lon: inputs.home.lon },
        bike,
        training: job.trainingType,
        targetKm: Math.max(10, targetKm),
        seed,
        name: `${FOCUS[trainingToKind(job.trainingType)]} — ${job.date}`,
      });
      if (route) {
        await attachRouteToWorkout(clerkId, job.plannedWorkoutId, route.routeId);
        routesGenerated++;
      }
    }
  }

  return {
    planId,
    routesGenerated,
    routesAttempted: routeJobs.length,
  };
}

function trainingToKind(t: TrainingType): DayKind {
  switch (t) {
    case "duur":
      return "duur";
    case "herstel":
      return "herstel";
    case "tempo":
      return "tempo";
    case "interval":
      return "interval";
    case "wedstrijd":
      return "wedstrijd";
    default:
      return "duur";
  }
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 1_000_000;
  }
  return Math.abs(h);
}

// ── Plan view (read model) ───────────────────────────────────────────────────

// Assemble the full plan view: every plan day enriched with its committed
// workout status and any attached real route. Shared by the athlete's own
// training-plan route and the coach's read-only advisory view.
// Resolve the single "current" plan: the newest active plan, or — when none is
// active — the newest paused plan. This is the ONE resolution rule shared by
// the plan view and all lifecycle writes (pause/resume/delete) so they can
// never act on a different plan than the one shown.
export async function resolveCurrentPlan(clerkId: string) {
  const candidates = await db
    .select()
    .from(trainingPlansTable)
    .where(
      and(
        eq(trainingPlansTable.clerkId, clerkId),
        inArray(trainingPlansTable.status, ["active", "paused"]),
      ),
    )
    .orderBy(desc(trainingPlansTable.id));
  return (
    candidates.find((p) => p.status === "active") ?? candidates[0] ?? null
  );
}

export async function loadPlanView(clerkId: string) {
  // Show the current plan (active preferred, else newest paused) so the
  // athlete can see its state and resume/delete it (honest lifecycle view).
  const plan = await resolveCurrentPlan(clerkId);
  if (!plan) return null;

  const days = await db
    .select()
    .from(planDaysTable)
    .where(eq(planDaysTable.planId, plan.id))
    .orderBy(asc(planDaysTable.dayDate));

  const workouts = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.planId, plan.id));
  const workoutById = new Map(workouts.map((w) => [w.id, w]));

  const routeIds = workouts
    .map((w) => w.routeId)
    .filter((id): id is number => id != null);
  const routeById = new Map<
    number,
    {
      id: number;
      name: string;
      distanceKm: number | null;
      elevationGainM: number | null;
      startName: string | null;
    }
  >();
  if (routeIds.length > 0) {
    const routes = await db
      .select({
        id: routesTable.id,
        name: routesTable.name,
        distanceKm: routesTable.distanceKm,
        elevationGainM: routesTable.elevationGainM,
      })
      .from(routesTable)
      .where(inArray(routesTable.id, routeIds));
    for (const r of routes) routeById.set(r.id, { ...r, startName: null });
  }

  const enriched = days.map((d) => {
    const w = d.plannedWorkoutId ? workoutById.get(d.plannedWorkoutId) : null;
    const route = w?.routeId ? (routeById.get(w.routeId) ?? null) : null;
    return {
      id: d.id,
      dayDate: d.dayDate,
      weekIndex: d.weekIndex,
      focus: d.focus,
      trainingType: d.trainingType,
      intensityLabel: d.intensityLabel,
      estDurationMin: d.estDurationMin,
      isRest: d.isRest,
      routeNeeded: d.routeNeeded,
      rationale: d.rationale,
      adaptationReason: d.adaptationReason,
      committed: d.committed,
      workout: w
        ? { id: w.id, title: w.title, type: w.type, status: w.status }
        : null,
      route,
    };
  });

  const snapshot = (plan.inputSnapshot ?? null) as {
    nextRace?: { name?: string; raceDate?: string } | null;
    phase?: string;
  } | null;
  const snapRace = snapshot?.nextRace ?? null;

  return {
    plan: {
      id: plan.id,
      // Honest metadata: who/what created this plan and what it was built for.
      name:
        plan.mode === "advisory"
          ? "Sparki-adviesplan (3 weken)"
          : "Sparki-basisplan (3 weken)",
      maker: "Sparki (automatische planner)",
      source: plan.mode === "advisory" ? "advies" : "autonoom",
      createdAt: plan.createdAt,
      goal: snapRace?.name
        ? `Toewerken naar ${snapRace.name}${snapRace.raceDate ? ` (${snapRace.raceDate})` : ""}`
        : "Geen wedstrijddoel vastgelegd — algemene opbouw",
      mode: plan.mode,
      status: plan.status,
      summary: plan.summary,
      weekStartDate: plan.weekStartDate,
      horizonEndDate: plan.horizonEndDate,
      weeklyHourTarget: plan.weeklyHourTarget,
      generatedAt: plan.generatedAt,
      adaptationState: plan.adaptationState,
      inputSnapshot: plan.inputSnapshot,
    },
    days: enriched,
  };
}

// ── Adaptation ───────────────────────────────────────────────────────────────

export type AdaptResult = { adapted: boolean; changes: number; note: string };

// Re-evaluate the PROVISIONAL (non-committed) days against the athlete's CURRENT
// recovery/health, keeping committed sessions stable. Honest: each changed day
// records why it changed.
export async function adaptPlan(clerkId: string): Promise<AdaptResult> {
  const [plan] = await db
    .select()
    .from(trainingPlansTable)
    .where(
      and(
        eq(trainingPlansTable.clerkId, clerkId),
        eq(trainingPlansTable.status, "active"),
      ),
    )
    .limit(1);
  if (!plan) return { adapted: false, changes: 0, note: "Geen actief schema." };

  const inputs = await gatherInputs(clerkId);
  // Rebuild the skeleton on the SAME anchor date so dates line up with stored
  // plan_days; only provisional days will be rewritten.
  const skeleton = buildSkeleton(inputs, plan.weekStartDate);
  const byDate = new Map(skeleton.map((d) => [d.date, d]));

  const provisional = await db
    .select()
    .from(planDaysTable)
    .where(
      and(
        eq(planDaysTable.planId, plan.id),
        eq(planDaysTable.committed, false),
        gte(planDaysTable.dayDate, todayStr()),
      ),
    );

  let changes = 0;
  for (const day of provisional) {
    const fresh = byDate.get(day.dayDate);
    if (!fresh) continue;
    const changed =
      fresh.focus !== day.focus ||
      fresh.intensityLabel !== day.intensityLabel ||
      fresh.estDurationMin !== day.estDurationMin ||
      fresh.isRest !== day.isRest;
    if (!changed) continue;

    const reason = adaptationReasonFor(inputs, day.intensityLabel, fresh);
    await db
      .update(planDaysTable)
      .set({
        focus: fresh.focus,
        trainingType: fresh.trainingType,
        intensityLabel: fresh.intensityLabel,
        estDurationMin: fresh.estDurationMin,
        isRest: fresh.isRest,
        routeNeeded: fresh.routeNeeded,
        rationale: fresh.rationale,
        adaptationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(planDaysTable.id, day.id));
    changes++;
  }

  const prevState = (plan.adaptationState ?? {}) as {
    adaptationCount?: number;
    notes?: string[];
  };
  const note =
    changes > 0
      ? `${changes} voorlopige dag(en) aangepast aan je huidige herstel.`
      : "Geen aanpassingen nodig — je voorlopige weken passen nog bij je herstel.";
  await db
    .update(trainingPlansTable)
    .set({
      adaptationState: {
        adaptationCount: (prevState.adaptationCount ?? 0) + (changes > 0 ? 1 : 0),
        lastAdaptedAt: new Date().toISOString(),
        notes: [...(prevState.notes ?? []), note].slice(-10),
      },
      updatedAt: new Date(),
    })
    .where(eq(trainingPlansTable.id, plan.id));

  return { adapted: changes > 0, changes, note };
}

function adaptationReasonFor(
  i: PlanInputs,
  prevIntensity: string | null,
  fresh: DaySkeleton,
): string {
  if (i.healthStatus === "sick" || i.healthStatus === "injured")
    return "Aangepast naar rust omdat je je niet fit hebt gemeld.";
  if (i.readiness.label === "tired" && fresh.isRest)
    return "Rust ingepland omdat je herstel laag is.";
  if (i.readiness.label === "tired")
    return "Intensiteit/volume verlaagd omdat je herstel laag is.";
  if (i.phase === "taper")
    return "Volume verlaagd voor de tapering richting je wedstrijd.";
  return `Bijgewerkt op basis van je actuele gegevens (was: ${prevIntensity}).`;
}

// ── Autonomous refresh (task #21) ────────────────────────────────────────────
// The plan adapts on its own: input changes (recovery/health/race) re-run the
// lightweight provisional adaptation, and as the committed week elapses the next
// provisional week is promoted to a fresh committed week (with routes).

async function hasAcceptedCoach(athleteClerkId: string): Promise<boolean> {
  const [row] = await db
    .select({ coachClerkId: coachAthleteLinksTable.coachClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.athleteClerkId, athleteClerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
      ),
    )
    .limit(1);
  return !!row;
}

export type RollForwardResult = { rolled: boolean; reason: string };

// Promote the calendar forward as time passes. When the committed 7-day week has
// fully elapsed (today is at/after weekStartDate + COMMIT_DAYS), regenerate the
// plan anchored at today — this turns what was the next provisional week into a
// fresh committed week (with real routes) without any manual regeneration. Past,
// completed sessions are preserved by generatePlan (it only clears future
// still-"planned" workouts). No-op while inputs are incomplete or no plan exists.
export async function maybeRollForward(
  clerkId: string,
): Promise<RollForwardResult> {
  const [plan] = await db
    .select({
      id: trainingPlansTable.id,
      weekStartDate: trainingPlansTable.weekStartDate,
    })
    .from(trainingPlansTable)
    .where(
      and(
        eq(trainingPlansTable.clerkId, clerkId),
        eq(trainingPlansTable.status, "active"),
      ),
    )
    .limit(1);
  if (!plan) return { rolled: false, reason: "no-plan" };

  const elapsed = daysBetween(plan.weekStartDate, todayStr());
  if (elapsed < COMMIT_DAYS)
    return { rolled: false, reason: "committed-week-active" };

  const inputs = await gatherInputs(clerkId);
  const completeness = checkCompleteness(inputs);
  if (!completeness.ready) return { rolled: false, reason: "incomplete-inputs" };

  const mode = (await hasAcceptedCoach(clerkId)) ? "advisory" : "autonomous";
  await generatePlan(clerkId, mode);
  return { rolled: true, reason: "rolled-forward" };
}

export type AutoRefreshResult = {
  rolled: boolean;
  adapted: boolean;
  changes: number;
  error?: string;
};

// Best-effort autonomous refresh hook for input-change endpoints (daily metric,
// session log, health status, races). Runs the fast, DB-only provisional
// adaptation so the plan reflects the new signal immediately. Never throws — a
// failure here must not break the originating write. The heavier time-based
// roll-forward (which can call the model + routing) stays on the plan read path.
export async function autoAdaptPlan(
  clerkId: string,
): Promise<AutoRefreshResult> {
  try {
    const r = await adaptPlan(clerkId);
    return { rolled: false, adapted: r.adapted, changes: r.changes };
  } catch (err) {
    return {
      rolled: false,
      adapted: false,
      changes: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
