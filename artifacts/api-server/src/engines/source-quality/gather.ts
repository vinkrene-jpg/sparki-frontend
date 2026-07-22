// DB gathering for the source-quality register. Reads only real rows; every
// absence flows through as an honest gap in the assessment.

import { and, desc, eq, gte, or } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  nutritionHydrationLogsTable,
  racesTable,
  workoutFeedbackTable,
  garageBikesTable,
  garageSensorsTable,
  connectorConnectionsTable,
  coachAthleteLinksTable,
} from "@workspace/db";
import type { SourceQualityInput } from "./types";

const WINDOW_DAYS = 28;

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0]!;
}

export async function gatherSourceInput(
  clerkId: string,
): Promise<SourceQualityInput> {
  const today = new Date().toISOString().split("T")[0]!;
  const windowStart = isoDaysAgo(WINDOW_DAYS);

  const [
    [athlete],
    sessions,
    metrics,
    nutrition,
    ftp,
    races,
    feedback,
    bikes,
    sensors,
    connectors,
    coachLinks,
  ] = await Promise.all([
    db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        avgPower: trainingSessionsTable.avgPower,
        normalizedPower: trainingSessionsTable.normalizedPower,
        avgHR: trainingSessionsTable.avgHR,
        avgCadence: trainingSessionsTable.avgCadence,
        tss: trainingSessionsTable.tss,
        source: trainingSessionsTable.source,
      })
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
      .select({ logDate: nutritionHydrationLogsTable.logDate })
      .from(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
          gte(nutritionHydrationLogsTable.logDate, windowStart),
        ),
      ),
    db
      .select({ measuredAt: ftpHistoryTable.measuredAt })
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, clerkId))
      .orderBy(desc(ftpHistoryTable.measuredAt))
      .limit(8),
    db
      .select({ id: racesTable.id })
      .from(racesTable)
      .where(
        and(eq(racesTable.clerkId, clerkId), gte(racesTable.raceDate, today)),
      ),
    db
      .select({ id: workoutFeedbackTable.id })
      .from(workoutFeedbackTable)
      .where(eq(workoutFeedbackTable.clerkId, clerkId)),
    db
      .select({ id: garageBikesTable.id })
      .from(garageBikesTable)
      .where(eq(garageBikesTable.clerkId, clerkId)),
    db
      .select({ kind: garageSensorsTable.kind })
      .from(garageSensorsTable)
      .where(eq(garageSensorsTable.clerkId, clerkId)),
    db
      .select({
        provider: connectorConnectionsTable.provider,
        status: connectorConnectionsTable.status,
      })
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.clerkId, clerkId)),
    db
      .select({ status: coachAthleteLinksTable.status })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.athleteClerkId, clerkId),
          or(
            eq(coachAthleteLinksTable.status, "active"),
            eq(coachAthleteLinksTable.status, "accepted"),
          ),
        ),
      ),
  ]);

  const kinds = new Set(sensors.map((s) => s.kind));

  return {
    today,
    profile: {
      exists: !!athlete,
      ftp: athlete?.ftp ?? null,
      ftpEstimated: athlete?.ftpEstimated ?? false,
      weightKg: athlete?.weightKg != null ? Number(athlete.weightKg) : null,
      birthDate: athlete?.birthDate ?? null,
      weeklyHours: athlete?.weeklyHourTarget ?? null,
      sport: athlete?.sport ?? null,
      developmentGoal: athlete?.developmentGoal ?? null,
      homeLat: athlete?.homeLat != null ? Number(athlete.homeLat) : null,
      homeLon: athlete?.homeLon != null ? Number(athlete.homeLon) : null,
      updatedAt: athlete?.updatedAt ? athlete.updatedAt.toISOString() : null,
    },
    sessions: sessions.map((s) => ({
      date: s.sessionDate,
      hasPower: s.avgPower != null || s.normalizedPower != null,
      hasHeartRate: s.avgHR != null,
      hasCadence: s.avgCadence != null,
      hasTss: s.tss != null,
      source: s.source,
    })),
    windowDays: WINDOW_DAYS,
    metrics: metrics.map((m) => ({
      date: m.metricDate,
      hrv: m.hrv,
      restingHR: m.restingHR,
      sleepHours: m.sleepHours != null ? Number(m.sleepHours) : null,
      feelScore: m.feelScore,
      fatigueScore: m.fatigueScore,
    })),
    nutritionLogDates: nutrition.map((n) => n.logDate),
    ftpMeasurements: ftp.map((f) => ({
      measuredAt:
        typeof (f.measuredAt as unknown) === "string"
          ? String(f.measuredAt)
          : new Date(f.measuredAt as unknown as string | Date).toISOString(),
    })),
    upcomingRaceCount: races.length,
    feedbackCount: feedback.length,
    sensors: {
      power: kinds.has("wattagemeter"),
      heartRate: kinds.has("hartslagmeter"),
      cadence: kinds.has("cadans_snelheid"),
    },
    connectors,
    garageBikeCount: bikes.length,
    hasActiveCoachLink: coachLinks.length > 0,
  };
}
