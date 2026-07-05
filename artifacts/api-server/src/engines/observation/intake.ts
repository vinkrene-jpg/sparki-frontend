// Signal intake layer.
//
// Pulls every real signal Sparki can weigh for one athlete and reports each
// channel as present / insufficient / missing — with a plain-Dutch reason for
// every gap. Missing data is first-class: it is recorded honestly, never guessed.
// The numeric side (load, readiness, risk, trends) is computed here once so the
// observation rules weigh consistent figures.

import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  nutritionHydrationLogsTable,
  racesTable,
  workoutFeedbackTable,
  plannedWorkoutsTable,
} from "@workspace/db";
import { computeLoad, computeRiskSignal } from "../../lib/recovery-load";
import { computeReadiness } from "../../lib/sharing";
import { getHomeWeather, formatHomeWeatherText } from "../../lib/weather/home";
import { loadProfileFacts } from "./profile-consistency";
import type {
  IntakeSignal,
  IntakeMetrics,
  SignalIntake,
  SignalKind,
  TrendInfo,
  WeatherIntake,
} from "./types";

const WINDOW_DAYS = 28;
const TREND_MIN_POINTS = 3;

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0]!;
}

function daysUntil(date: string, today: string): number {
  return Math.round(
    (new Date(date).getTime() - new Date(today).getTime()) / 86_400_000,
  );
}

// Trend over a series given oldest→newest. Returns null below the minimum number
// of real points, so a single reading never becomes a "trend".
function trend(valuesNewestFirst: Array<number | null>): TrendInfo | null {
  const vals = valuesNewestFirst
    .filter((v): v is number => v != null)
    .reverse(); // oldest → newest
  if (vals.length < TREND_MIN_POINTS) return null;
  const first = vals[0]!;
  const last = vals[vals.length - 1]!;
  const delta = last - first;
  const rel = first !== 0 ? Math.abs(delta) / Math.abs(first) : Math.abs(delta);
  const direction: TrendInfo["direction"] =
    rel < 0.04 ? "stable" : delta > 0 ? "rising" : "falling";
  return { direction, first, last, delta, days: vals.length };
}

function avg(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => x != null);
  if (v.length === 0) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

/** Gather every real signal for an athlete into a structured, honest intake. */
export async function gatherSignals(clerkId: string): Promise<SignalIntake> {
  const today = todayStr();
  const windowStart = isoDaysAgo(WINDOW_DAYS);

  const [
    [user],
    [athlete],
    sessions,
    metrics,
    ftp,
    nutrition,
    upcomingRaces,
    plannedIds,
    profileFacts,
  ] = await Promise.all([
    db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, windowStart),
        ),
      )
      .orderBy(desc(trainingSessionsTable.sessionDate)),
    db
      .select()
      .from(athleteDailyMetricsTable)
      .where(
        and(
          eq(athleteDailyMetricsTable.clerkId, clerkId),
          gte(athleteDailyMetricsTable.metricDate, windowStart),
        ),
      )
      .orderBy(desc(athleteDailyMetricsTable.metricDate)),
    db
      .select()
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, clerkId))
      .orderBy(desc(ftpHistoryTable.measuredAt))
      .limit(8),
    db
      .select()
      .from(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
          gte(nutritionHydrationLogsTable.logDate, windowStart),
        ),
      ),
    db
      .select()
      .from(racesTable)
      .where(
        and(eq(racesTable.clerkId, clerkId), gte(racesTable.raceDate, today)),
      )
      .orderBy(racesTable.raceDate),
    db
      .select({ id: plannedWorkoutsTable.id })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, clerkId)),
    // Profile claims vs proven riding (own 120-day window; honest nulls).
    loadProfileFacts(clerkId),
  ]);

  // Feedback over the athlete's planned workouts (join via owned workout ids).
  let feedbackRows: { feedbackType: string }[] = [];
  if (plannedIds.length > 0) {
    feedbackRows = await db
      .select({ feedbackType: workoutFeedbackTable.feedbackType })
      .from(workoutFeedbackTable)
      .where(eq(workoutFeedbackTable.clerkId, clerkId));
  }

  // ── Numeric metrics ─────────────────────────────────────────────────────────
  const tssSessions = sessions
    .filter((s) => s.tss != null)
    .map((s) => ({ sessionDate: s.sessionDate, tss: s.tss }));
  const load = computeLoad(tssSessions);
  const latestMetric = metrics[0] ?? null;
  const readiness = computeReadiness(latestMetric);
  const healthStatus = athlete?.healthStatus ?? "ok";
  const risk = computeRiskSignal({ load, readiness, healthStatus });

  const hrv = trend(metrics.map((m) => m.hrv));
  const restingHr = trend(metrics.map((m) => m.restingHR));
  const sleepVals = metrics.map((m) =>
    m.sleepHours != null ? Number(m.sleepHours) : null,
  );
  const feelVals = metrics.map((m) => m.feelScore);
  const fatigueVals = metrics.map((m) => m.fatigueScore);

  const ftpVals = ftp.map((f) => f.ftpWatts);
  const ftpTrend = trend(ftpVals);

  const feedback = {
    total: feedbackRows.length,
    done: feedbackRows.filter((f) => f.feedbackType === "done").length,
    missed: feedbackRows.filter((f) => f.feedbackType === "missed").length,
    tooHard: feedbackRows.filter((f) => f.feedbackType === "too_hard").length,
    tooLight: feedbackRows.filter((f) => f.feedbackType === "too_light").length,
    pain: feedbackRows.filter((f) => f.feedbackType === "pain").length,
    tired: feedbackRows.filter((f) => f.feedbackType === "tired").length,
  };

  const nextAny = upcomingRaces[0]
    ? {
        name: upcomingRaces[0].name,
        date: upcomingRaces[0].raceDate,
        daysUntil: daysUntil(upcomingRaces[0].raceDate, today),
      }
    : null;
  const aRace = upcomingRaces.find((r) => r.priority === "A");
  const nextA = aRace
    ? {
        name: aRace.name,
        date: aRace.raceDate,
        daysUntil: daysUntil(aRace.raceDate, today),
      }
    : null;

  const sessionsPerWeek =
    sessions.length > 0
      ? Math.round((sessions.length / WINDOW_DAYS) * 7 * 10) / 10
      : null;

  // Today's real home-location weather (best-effort, honest gaps). Done after
  // the DB reads since it needs the athlete's saved coordinates; never blocks or
  // fabricates — an upstream miss just yields a "missing" weather signal.
  let weather: WeatherIntake | null = null;
  try {
    const hw = await getHomeWeather(
      athlete?.homeLat,
      athlete?.homeLon,
      athlete?.homeLabel,
    );
    weather = {
      available: hw.available,
      reason: hw.reason,
      locationLabel: hw.locationLabel,
      summaryText: formatHomeWeatherText(hw.today),
      severity: hw.advisory?.severity ?? null,
      todayForecast: hw.todayForecast,
    };
  } catch {
    weather = null;
  }

  const metricsOut: IntakeMetrics = {
    load,
    loadSessions: tssSessions.length,
    readiness,
    risk,
    hrv,
    restingHr,
    sleep: {
      latest: sleepVals[0] ?? null,
      avg: avg(sleepVals),
      days: sleepVals.filter((v) => v != null).length,
    },
    feel: {
      latest: feelVals[0] ?? null,
      avg: avg(feelVals),
      days: feelVals.filter((v) => v != null).length,
    },
    fatigue: {
      latest: fatigueVals[0] ?? null,
      avg: avg(fatigueVals),
      days: fatigueVals.filter((v) => v != null).length,
    },
    ftp: { trend: ftpTrend, latest: ftpVals[0] ?? null },
    feedback,
    races: { nextA, nextAny, count: upcomingRaces.length },
    nutrition: { logs: nutrition.length },
    sessionsPerWeek,
    healthStatus,
    profile: profileFacts,
    weather,
  };

  // ── Per-channel signal status (honest gaps) ─────────────────────────────────
  const signals = buildSignals(metricsOut);
  const missing = signals
    .filter((s) => s.status === "missing")
    .map((s) => s.kind);

  return {
    clerkId,
    today,
    athleteName: user?.displayName ?? "Renner",
    signals,
    metrics: metricsOut,
    missing,
  };
}

// Translate the numeric metrics into the present/insufficient/missing report.
// Pure over the metrics so it can be unit-tested without a database.
export function buildSignals(m: IntakeMetrics): IntakeSignal[] {
  const out: IntakeSignal[] = [];

  // Training load — needs a few sessions to mean anything.
  if (m.loadSessions >= 3) {
    out.push({
      kind: "training_load",
      status: "present",
      label: "Trainingsbelasting",
      value: `vormbalans ${m.load.tsb}, basis ${m.load.ctl}`,
      dataPoints: m.loadSessions,
    });
  } else if (m.loadSessions >= 1) {
    out.push({
      kind: "training_load",
      status: "insufficient",
      label: "Trainingsbelasting",
      value: `${m.loadSessions} rit(ten) met belastingscore`,
      reason: "te weinig ritten om je belasting betrouwbaar te wegen",
      dataPoints: m.loadSessions,
    });
  } else {
    out.push({
      kind: "training_load",
      status: "missing",
      label: "Trainingsbelasting",
      value: null,
      reason: "nog geen ritten met een belastingscore vastgelegd",
      dataPoints: 0,
    });
  }

  // Readiness (today's check-in).
  if (m.readiness.label !== "unknown") {
    out.push({
      kind: "readiness",
      status: "present",
      label: "Gereedheid (check-in)",
      value: `${m.readiness.label}${m.readiness.score != null ? ` (${m.readiness.score}/100)` : ""}`,
      dataPoints: m.readiness.basis.length || 1,
    });
  } else {
    out.push({
      kind: "readiness",
      status: "missing",
      label: "Gereedheid (check-in)",
      value: null,
      reason: "nog geen check-in van vandaag (gevoel, vermoeidheid, slaap)",
      dataPoints: 0,
    });
  }

  out.push(trendSignal("hrv_trend", "HRV-trend", m.hrv, "HRV", "ms"));
  out.push(
    trendSignal(
      "resting_hr_trend",
      "Rusthartslag-trend",
      m.restingHr,
      "rusthartslag",
      "bpm",
    ),
  );

  // Sleep.
  if (m.sleep.days >= 1) {
    out.push({
      kind: "sleep",
      status: m.sleep.days >= TREND_MIN_POINTS ? "present" : "insufficient",
      label: "Slaap",
      value: `laatst ${m.sleep.latest ?? "?"} u, gemiddeld ${m.sleep.avg ?? "?"} u`,
      ...(m.sleep.days < TREND_MIN_POINTS && {
        reason: "te weinig nachten om een slaaptrend te zien",
      }),
      dataPoints: m.sleep.days,
    });
  } else {
    out.push({
      kind: "sleep",
      status: "missing",
      label: "Slaap",
      value: null,
      reason: "geen slaap vastgelegd",
      dataPoints: 0,
    });
  }

  // Subjective feel / fatigue.
  const subjDays = Math.max(m.feel.days, m.fatigue.days);
  if (subjDays >= 1) {
    out.push({
      kind: "subjective_feel",
      status: "present",
      label: "Eigen gevoel",
      value: [
        m.feel.latest != null && `gevoel ${m.feel.latest}/10`,
        m.fatigue.latest != null && `vermoeidheid ${m.fatigue.latest}/10`,
      ]
        .filter(Boolean)
        .join(", "),
      dataPoints: subjDays,
    });
  } else {
    out.push({
      kind: "subjective_feel",
      status: "missing",
      label: "Eigen gevoel",
      value: null,
      reason: "geen gevoel of vermoeidheid ingevuld",
      dataPoints: 0,
    });
  }

  // Power development (FTP history).
  if (m.ftp.trend) {
    out.push({
      kind: "power_dev",
      status: "present",
      label: "Vermogensontwikkeling (FTP)",
      value: `${m.ftp.trend.first}W → ${m.ftp.trend.last}W over ${m.ftp.trend.days} metingen`,
      dataPoints: m.ftp.trend.days,
    });
  } else if (m.ftp.latest != null) {
    out.push({
      kind: "power_dev",
      status: "insufficient",
      label: "Vermogensontwikkeling (FTP)",
      value: `${m.ftp.latest}W (één meting)`,
      reason: "te weinig FTP-metingen om ontwikkeling te zien",
      dataPoints: 1,
    });
  } else {
    out.push({
      kind: "power_dev",
      status: "missing",
      label: "Vermogensontwikkeling (FTP)",
      value: null,
      reason: "geen FTP-meting vastgelegd",
      dataPoints: 0,
    });
  }

  // Workout feedback.
  if (m.feedback.total >= 1) {
    out.push({
      kind: "feedback",
      status: "present",
      label: "Reacties op trainingen",
      value: `${m.feedback.total} reactie(s)`,
      dataPoints: m.feedback.total,
    });
  } else {
    out.push({
      kind: "feedback",
      status: "missing",
      label: "Reacties op trainingen",
      value: null,
      reason: "nog geen reacties op geplande trainingen",
      dataPoints: 0,
    });
  }

  // Health is a declared fact, always known.
  out.push({
    kind: "health",
    status: "present",
    label: "Gezondheid",
    value: m.healthStatus,
    dataPoints: 1,
  });

  // Race calendar.
  if (m.races.count >= 1) {
    out.push({
      kind: "race_calendar",
      status: "present",
      label: "Wedstrijdkalender",
      value: `${m.races.count} aankomende wedstrijd(en)`,
      dataPoints: m.races.count,
    });
  } else {
    out.push({
      kind: "race_calendar",
      status: "missing",
      label: "Wedstrijdkalender",
      value: null,
      reason: "geen aankomende wedstrijden ingepland",
      dataPoints: 0,
    });
  }

  // Nutrition.
  if (m.nutrition.logs >= 1) {
    out.push({
      kind: "nutrition",
      status: m.nutrition.logs >= 3 ? "present" : "insufficient",
      label: "Voeding & hydratatie",
      value: `${m.nutrition.logs} log(s)`,
      ...(m.nutrition.logs < 3 && {
        reason: "te weinig logs om een voedingspatroon te zien",
      }),
      dataPoints: m.nutrition.logs,
    });
  } else {
    out.push({
      kind: "nutrition",
      status: "missing",
      label: "Voeding & hydratatie",
      value: null,
      reason: "geen voeding of hydratatie vastgelegd",
      dataPoints: 0,
    });
  }

  // Weather — real, from the athlete's saved home location. Honest gaps: no
  // saved location, or today outside the forecast horizon, both stay "missing"
  // rather than a fabricated reading.
  const w = m.weather;
  if (w && w.available && w.summaryText) {
    out.push({
      kind: "weather",
      status: "present",
      label: "Weer",
      value: w.locationLabel
        ? `${w.summaryText} (${w.locationLabel})`
        : w.summaryText,
      dataPoints: 1,
    });
  } else {
    out.push({
      kind: "weather",
      status: "missing",
      label: "Weer",
      value: null,
      reason:
        w?.reason === "no_forecast"
          ? "geen weersverwachting beschikbaar voor vandaag"
          : "geen thuislocatie ingesteld; Sparki kan het weer niet ophalen",
      dataPoints: 0,
    });
  }

  return out;
}

function trendSignal(
  kind: SignalKind,
  label: string,
  t: TrendInfo | null,
  noun: string,
  unit: string,
): IntakeSignal {
  if (t) {
    const dir =
      t.direction === "rising"
        ? "stijgend"
        : t.direction === "falling"
          ? "dalend"
          : "stabiel";
    return {
      kind,
      status: "present",
      label,
      value: `${dir}: ${t.first}${unit} → ${t.last}${unit} (${t.days} dagen)`,
      dataPoints: t.days,
    };
  }
  return {
    kind,
    status: "missing",
    label,
    value: null,
    reason: `te weinig ${noun}-metingen voor een trend`,
    dataPoints: 0,
  };
}
