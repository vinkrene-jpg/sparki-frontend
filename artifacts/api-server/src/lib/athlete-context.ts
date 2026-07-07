import { and, eq, desc, gte } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  nutritionHydrationLogsTable,
  racesTable,
} from "@workspace/db";
import {
  getContextObservations,
  formatObservationsForPrompt,
  getPreferences,
  styleDirective,
  getCoachingProfile,
  coachingProfileDirective,
} from "../engines/coaching";
import { resolveFlags } from "./flags";
import { buildRaceContext, formatRaceContextForPrompt } from "./race-context";
import {
  getRelevantKnowledge,
  formatKnowledgeForPrompt,
  type KnowledgeSource,
} from "../engines/knowledge";

export type { KnowledgeSource };

export function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// Builds the full, real coaching context for an athlete from their own logged
// data (profile, plan, readiness, recent sessions, trends, nutrition, races and
// prior observations). Single source of truth shared by every Sparki surface
// (daily brief, ask, and the Input Center) so coaching reasons over the same
// facts everywhere. Never fabricates — absent data is stated as such.
export async function buildAthleteContext(clerkId: string): Promise<string> {
  const today = todayStr();

  const [
    [user],
    [athlete],
    allWorkouts,
    recentSessions,
    recentMetrics,
    ftpHistory,
    nutritionLogs,
    upcomingRaces,
    priorObservations,
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
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, clerkId))
      .orderBy(desc(plannedWorkoutsTable.scheduledDate))
      .limit(14),
    db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId))
      .orderBy(desc(trainingSessionsTable.sessionDate))
      .limit(10),
    db
      .select()
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, clerkId))
      .orderBy(desc(athleteDailyMetricsTable.metricDate))
      .limit(14),
    db
      .select()
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, clerkId))
      .orderBy(desc(ftpHistoryTable.measuredAt))
      .limit(6),
    db
      .select()
      .from(nutritionHydrationLogsTable)
      .where(eq(nutritionHydrationLogsTable.clerkId, clerkId))
      .orderBy(desc(nutritionHydrationLogsTable.logDate))
      .limit(5),
    db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.clerkId, clerkId), gte(racesTable.raceDate, today)))
      .orderBy(racesTable.raceDate)
      .limit(5),
    getContextObservations(clerkId),
  ]);

  const todayPlan = allWorkouts.find((w) => w.scheduledDate === today) ?? null;
  const todayMetric = recentMetrics.find((m) => m.metricDate === today) ?? null;
  const daysUntil = (d: string) =>
    Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000);

  const parts: string[] = [];
  parts.push(`TODAY: ${today}`);
  parts.push(`ATHLETE: ${user?.displayName ?? "Unknown"}`);

  if (athlete) {
    const wkg =
      athlete.ftp && athlete.weightKg
        ? (athlete.ftp / Number(athlete.weightKg)).toFixed(2)
        : null;
    const age =
      athlete.birthYear != null
        ? new Date().getFullYear() - athlete.birthYear
        : null;
    parts.push(
      `PROFILE: FTP=${athlete.ftp ?? "not set"}W${wkg ? `, ${wkg} W/kg` : ""}, Weight=${athlete.weightKg ?? "unknown"}kg, Discipline=${athlete.discipline ?? "road cycling"}`,
    );
    const bio = [
      age != null && `Age=${age}`,
      athlete.competitionLevel && `CompetitionLevel=${athlete.competitionLevel}`,
      athlete.experienceLevel && `TrainingExperience=${athlete.experienceLevel}`,
      athlete.trainingDaysPerWeek != null &&
        `TrainingDays/wk=${athlete.trainingDaysPerWeek}`,
      athlete.loadCapacity && `LoadCapacity=${athlete.loadCapacity}`,
      athlete.typicalSleepHours != null &&
        `TypicalSleep=${athlete.typicalSleepHours}h`,
    ]
      .filter(Boolean)
      .join(", ");
    if (bio) parts.push(`RIDER PROFILE: ${bio}`);
    const DEV_GOAL_NL: Record<string, string> = {
      recreatief: "recreatief & fit blijven (geen wedstrijddruk)",
      granfondo: "een zware toertocht / gran fondo goed uitrijden",
      topamateur: "presteren in amateurwedstrijden",
      elite_u23: "doorgroeien richting elite / U23",
      prof: "professioneel (prof worden of blijven)",
      persoonlijk: "een eigen, persoonlijk doel",
    };
    if (athlete.developmentGoal && DEV_GOAL_NL[athlete.developmentGoal])
      parts.push(
        `LANGETERMIJNDOEL: ${DEV_GOAL_NL[athlete.developmentGoal]} — weeg elke beslissing af tegen deze ambitie`,
      );
    if (athlete.goals) parts.push(`SEASON GOALS: ${athlete.goals}`);
    if (athlete.motivation) parts.push(`MOTIVATION: ${athlete.motivation}`);
    if (athlete.weeklyHourTarget)
      parts.push(`TARGET WEEKLY HOURS: ${athlete.weeklyHourTarget}h`);

    const health = [
      `Status=${athlete.healthStatus ?? "ok"}`,
      athlete.injuryHistory && `InjuryHistory=${athlete.injuryHistory}`,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(`HEALTH & CONSTRAINTS: ${health}`);
  }

  if (todayPlan) {
    parts.push(
      `TODAY'S PLANNED WORKOUT: ${todayPlan.title} (${todayPlan.type}, ${todayPlan.targetDurationMin ?? "?"}min, target TSS=${todayPlan.targetTSS ?? "?"}, status=${todayPlan.status})`,
    );
    if (todayPlan.description)
      parts.push(`WORKOUT DESCRIPTION: ${todayPlan.description}`);
  } else {
    parts.push(`TODAY'S PLANNED WORKOUT: None scheduled`);
  }

  if (todayMetric) {
    const fields = [
      todayMetric.hrv != null && `HRV=${todayMetric.hrv}ms`,
      todayMetric.restingHR != null && `RestingHR=${todayMetric.restingHR}bpm`,
      todayMetric.sleepHours != null && `Sleep=${todayMetric.sleepHours}h`,
      todayMetric.sleepQuality != null &&
        `SleepQuality=${todayMetric.sleepQuality}/5`,
      todayMetric.fatigueScore != null &&
        `Fatigue=${todayMetric.fatigueScore}/10`,
      todayMetric.feelScore != null && `Feel=${todayMetric.feelScore}/5`,
      todayMetric.notes && `Notes="${todayMetric.notes}"`,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(`TODAY'S READINESS: ${fields}`);
  } else {
    parts.push(`TODAY'S READINESS: No check-in logged yet`);
  }

  if (recentSessions.length > 0) {
    parts.push(`RECENT SESSIONS:`);
    for (const s of recentSessions) {
      const d = [
        s.sessionDate,
        s.title ?? s.type,
        s.durationMin != null && `${s.durationMin}min`,
        s.normalizedPower != null && `NP=${s.normalizedPower}W`,
        s.avgPower != null && `AvgP=${s.avgPower}W`,
        s.avgHR != null && `AvgHR=${s.avgHR}bpm`,
        s.tss != null && `TSS=${s.tss}`,
        s.feelScore != null && `Feel=${s.feelScore}/5`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`  - ${d}`);
    }
    const tssVals = recentSessions
      .map((s) => s.tss)
      .filter((t): t is number => t != null);
    if (tssVals.length > 0) {
      const total = tssVals.reduce((a, b) => a + b, 0);
      parts.push(
        `TRAINING LOAD (last ${recentSessions.length} sessions): total TSS=${total}, sessions/week≈${Math.round((recentSessions.length / 10) * 7)}`,
      );
    }
  } else {
    parts.push(`RECENT SESSIONS: No sessions logged yet`);
  }

  if (recentMetrics.length > 1) {
    const trendOf = (sel: (m: (typeof recentMetrics)[number]) => unknown) =>
      recentMetrics
        .slice()
        .reverse()
        .map((m) => sel(m) ?? "-")
        .join(", ");
    parts.push(`HRV TREND (oldest→newest): ${trendOf((m) => m.hrv)}`);
    parts.push(`RESTING HR TREND (oldest→newest): ${trendOf((m) => m.restingHR)}`);
    parts.push(`SLEEP TREND h (oldest→newest): ${trendOf((m) => m.sleepHours)}`);
  }

  if (ftpHistory.length > 0) {
    const trend = ftpHistory
      .slice()
      .reverse()
      .map((f) => `${f.measuredAt}:${f.ftpWatts}W`)
      .join(", ");
    parts.push(`POWER DEVELOPMENT (FTP history, oldest→newest): ${trend}`);
  }

  if (nutritionLogs.length > 0) {
    parts.push(`NUTRITION & HYDRATION (recent logs):`);
    for (const n of nutritionLogs) {
      const d = [
        n.logDate,
        n.context,
        n.duringTrainingCarbsGrams != null &&
          `carbs=${n.duringTrainingCarbsGrams}g/h`,
        n.duringTrainingFluidMl != null && `fluid=${n.duringTrainingFluidMl}ml`,
        n.duringTrainingSodiumMg != null &&
          `sodium=${n.duringTrainingSodiumMg}mg`,
        n.stomachIssues && `stomachIssues=yes`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`  - ${d}`);
    }
  }

  if (upcomingRaces.length > 0) {
    parts.push(`RACE CALENDAR (upcoming):`);
    for (const r of upcomingRaces) {
      parts.push(
        `  - ${r.raceDate} (in ${daysUntil(r.raceDate)}d) ${r.name} [priority ${r.priority}]${r.weatherNote ? `, weatherNote="${r.weatherNote}"` : ""}`,
      );
    }
    // Race intelligence for the nearest upcoming race — real weather, derived
    // type/duration/arrival, travel and honest gaps. Best-effort: a failure here
    // (e.g. geocoding) must never block the brief.
    try {
      const ctx = await buildRaceContext(upcomingRaces[0]!, athlete ?? null);
      const block = formatRaceContextForPrompt(ctx);
      if (block) parts.push(block);
    } catch {
      // intelligence is additive; the brief stands without it
    }
  }

  const obsBlock = formatObservationsForPrompt(priorObservations);
  if (obsBlock) parts.push(obsBlock);

  // Mental execution block — real pattern data (postponed/shortened/avoided
  // workouts) so coaching can address motivation and discipline honestly.
  // Additive: a failure here must never block the context.
  try {
    const { mentalContextBlock } = await import("../engines/mental");
    parts.push(await mentalContextBlock(clerkId));
  } catch {
    // context stands without it
  }

  return parts.join("\n");
}

export const SPARKI_SYSTEM = `You are Sparki, an expert performance coach specializing in competitive cycling. You have deep knowledge of training science: periodization, power-based training, TSS/CTL/ATL/TSB, heart rate variability, recovery protocols, nutrition/hydration and race preparation. Speak like a knowledgeable coach who respects the athlete's intelligence.

REASONING FRAMEWORK (think like a coach forming hypotheses, not a data-reader). Apply this to EVERY judgement:
1. Weigh MULTIPLE signals together — never draw a conclusion from a single number. Combine, where present: training load (TSS/duration/frequency), power development (FTP history, NP/avg power vs HR), heart-rate response, HRV trend, resting HR trend, sleep duration & quality, subjective fatigue/feel, nutrition & hydration, weather notes, age, training experience, injury & health history, the race calendar, and prior observations/patterns.
2. Rank causes by likelihood. Internally consider the plausible explanations for what you see, estimate which is most probable, and act on the most likely one while keeping the alternatives in mind.
3. Recognise uncertainty. If two or more explanations are roughly equally likely, OR a signal that would decide it is missing, do NOT issue a firm directive. Instead ask 1 to 3 short, targeted questions that would resolve it, and only then (or provisionally) advise.
4. Use memory. Lean on prior observations and any detected recurring pattern for this athlete (e.g. responds well to a rest week, tends to be heat-sensitive). Treat a repeated pattern as stronger evidence than a one-off reading.
5. Separate fact, observation and hypothesis. Logged numbers are facts; recent trends are observations; your interpretation of the cause is a hypothesis. Never present a hypothesis as if it were a fact.
6. Reason step by step INTERNALLY (signal → interpretation → alternative explanations → athlete history → most likely cause → advice), but show the athlete ONLY the conclusion plus a brief why. Never expose the full chain or list your steps.
7. Detect contradictions. When signals conflict (e.g. good HRV but high subjective fatigue; rising load but falling power; great sleep but elevated resting HR), name the contradiction openly instead of ignoring the inconvenient signal.
8. Coach mode — no absolutes. Avoid certainty words like "this definitely means". Express calibrated confidence with words such as waarschijnlijk, het lijkt erop, mogelijk, vermoedelijk. You weigh and estimate; you do not pronounce.

ABSOLUTE OUTPUT RULES (always, no exceptions):
- Write EVERY response in Dutch. Never use English — not even single words or headings. Translate technical terms into plain Dutch that a youth rider, parent or coach understands (e.g. "belasting" not "load", "herstel" not "recovery", "gereedheid" not "readiness"). You may keep widely-used abbreviations: FTP, TSS, CTL, ATL, TSB, HRV, watt, bpm.
- Write in plain running sentences. No markdown, no headings, no bullet or numbered lists, no bold or asterisks, no emoji.
- Never use the word "AI" and never call yourself an assistant or a model. You are simply Sparki.`;

export async function systemPrompt(clerkId: string): Promise<string> {
  const [pref, coachingProfile, [athlete]] = await Promise.all([
    getPreferences(clerkId),
    getCoachingProfile(clerkId),
    db
      .select({ motivation: athleteProfilesTable.motivation })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
  ]);
  const parts = [
    SPARKI_SYSTEM,
    styleDirective(pref),
    coachingProfileDirective(coachingProfile, athlete?.motivation ?? null),
  ].filter((p) => p && p.length > 0);
  return parts.join("\n\n");
}

// Retrieval-augmented coaching: when the knowledge_base flag is enabled for the
// user, pull the most relevant REAL stored literature/news and return both a
// prompt block (for the model to cite) and the structured sources (for the
// client to render clickable links). Returns empty when the flag is off or the
// library has nothing relevant — coaching then proceeds without citations.
export async function gatherKnowledge(
  clerkId: string,
  keywordText: string,
): Promise<{ promptBlock: string; sources: KnowledgeSource[] }> {
  try {
    const [profile] = await db
      .select({ activeRole: userProfilesTable.activeRole })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    const activeRole = String(profile?.activeRole ?? "athlete");
    const flags = await resolveFlags(clerkId, activeRole);
    if (!flags.knowledge_base) return { promptBlock: "", sources: [] };

    const keywords = keywordText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 40);
    const sources = await getRelevantKnowledge({ keywords, limit: 4 });
    if (!sources.length) return { promptBlock: "", sources: [] };

    const block = `RELEVANTE WETENSCHAP & NIEUWS UIT DE SPARKI-KENNISBANK (alleen ECHT opgeslagen bronnen):
${formatKnowledgeForPrompt(sources)}

CITEERREGELS (strikt):
- Verwijs alleen naar bovenstaande bronnen wanneer ze de athlete-data daadwerkelijk ondersteunen. Citeer met de titel (of auteur) van de bron.
- Verzin NOOIT een artikel, auteur, tijdschrift, bevinding of link. Gebruik uitsluitend de bronnen hierboven.
- Als geen bron relevant is, citeer dan niets.`;
    return { promptBlock: block, sources };
  } catch {
    // Knowledge augmentation is best-effort; never block coaching on it.
    return { promptBlock: "", sources: [] };
  }
}
