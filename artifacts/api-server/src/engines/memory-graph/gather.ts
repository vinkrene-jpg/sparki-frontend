import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  racesTable,
  workoutFeedbackTable,
  plannedWorkoutsTable,
  aiObservationsTable,
  type TrainingSession,
  type AthleteDailyMetric,
  type Race,
  type AiObservation,
} from "@workspace/db";

// A coach/athlete workout feedback note, anchored to the workout's scheduled
// date when available, otherwise to when the feedback was given.
export type FeedbackSignal = {
  feedbackType: string;
  note: string | null;
  date: string;
};

// All the real, per-athlete signals the correlation rules reason over. Nothing
// is fabricated — empty arrays simply mean Sparki has nothing to connect yet.
export type SignalBundle = {
  windowDays: number;
  sessions: TrainingSession[];
  metrics: AthleteDailyMetric[];
  races: Race[];
  feedback: FeedbackSignal[];
  priorObservations: AiObservation[];
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function gatherSignals(
  clerkId: string,
  windowDays = 45,
): Promise<SignalBundle> {
  const cutoff = isoDaysAgo(windowDays);

  const [sessions, metrics, races, feedbackRows, priorObservations] =
    await Promise.all([
      db
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, clerkId),
            gte(trainingSessionsTable.sessionDate, cutoff),
          ),
        )
        .orderBy(trainingSessionsTable.sessionDate),
      db
        .select()
        .from(athleteDailyMetricsTable)
        .where(
          and(
            eq(athleteDailyMetricsTable.clerkId, clerkId),
            gte(athleteDailyMetricsTable.metricDate, cutoff),
          ),
        )
        .orderBy(athleteDailyMetricsTable.metricDate),
      db
        .select()
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, clerkId),
            gte(racesTable.raceDate, cutoff),
          ),
        )
        .orderBy(racesTable.raceDate),
      db
        .select({
          feedbackType: workoutFeedbackTable.feedbackType,
          note: workoutFeedbackTable.note,
          createdAt: workoutFeedbackTable.createdAt,
          scheduledDate: plannedWorkoutsTable.scheduledDate,
        })
        .from(workoutFeedbackTable)
        .leftJoin(
          plannedWorkoutsTable,
          eq(workoutFeedbackTable.workoutId, plannedWorkoutsTable.id),
        )
        .where(
          and(
            eq(workoutFeedbackTable.clerkId, clerkId),
            gte(workoutFeedbackTable.createdAt, new Date(`${cutoff}T00:00:00Z`)),
          ),
        )
        .orderBy(workoutFeedbackTable.createdAt),
      db
        .select()
        .from(aiObservationsTable)
        .where(eq(aiObservationsTable.clerkId, clerkId))
        .orderBy(desc(aiObservationsTable.createdAt))
        .limit(50),
    ]);

  const feedback: FeedbackSignal[] = feedbackRows.map((r) => ({
    feedbackType: r.feedbackType,
    note: r.note,
    date:
      (r.scheduledDate as string | null) ??
      new Date(r.createdAt).toISOString().slice(0, 10),
  }));

  return { windowDays, sessions, metrics, races, feedback, priorObservations };
}
