// Real-signal aggregator for Sparki's curiosity open-loops and the honest
// ("Sparki, eerlijk?") observation. Every value here is read from real rows —
// training sessions, daily metrics, shared memories, the athlete's self-claim
// and account age. Nothing is fabricated; engines downstream only ever speak
// when these signals say there is genuine evidence to point at.

import { and, count, desc, eq } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  athleteProfilesTable,
  personalContextMemoriesTable,
  userProfilesTable,
} from "@workspace/db";

export type SelfType =
  | "diesel"
  | "sprinter"
  | "alleskunner"
  | "geen_idee"
  | "ik_zie_wel";

export type InsightSignals = {
  /** Total real training sessions on record. */
  totalSessions: number;
  /** Sessions in the most recent 14-day window vs the prior 14-day window. */
  last14Count: number;
  prev14Count: number;
  /** Mean TSS of the most-recent block vs the earlier block (null when absent). */
  recentAvgTss: number | null;
  baselineAvgTss: number | null;
  /** Mean ride duration (minutes) across sessions that recorded one. */
  avgDurationMin: number | null;
  /** Distinct session types seen recently (ride/interval/…) — a variety signal. */
  distinctTypes: number;
  /** Daily wellbeing metrics logged. */
  metricsCount: number;
  /** Enabled personal context memories the athlete shared with Sparki. */
  memoriesCount: number;
  /** The athlete's onboarding self-claim, or null if never made. */
  selfType: SelfType | null;
  /** True while FTP is still a quick-start estimate (a real missing data point). */
  ftpEstimated: boolean;
  /** True when no weight has been recorded yet. */
  weightMissing: boolean;
  /** Whole days since the account was created. */
  daysKnown: number;
};

function dayDiff(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function computeInsightSignals(
  clerkId: string,
): Promise<InsightSignals> {
  // Bounded recent slice — enough to split into recent/baseline blocks and read
  // variety, without loading an athlete's entire history into memory.
  const recent = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      type: trainingSessionsTable.type,
      tss: trainingSessionsTable.tss,
      durationMin: trainingSessionsTable.durationMin,
    })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId))
    .orderBy(desc(trainingSessionsTable.sessionDate))
    .limit(40);

  const [total] = await db
    .select({ c: count() })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId));

  const [metrics] = await db
    .select({ c: count() })
    .from(athleteDailyMetricsTable)
    .where(eq(athleteDailyMetricsTable.clerkId, clerkId));

  const [memories] = await db
    .select({ c: count() })
    .from(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.clerkId, clerkId),
        eq(personalContextMemoriesTable.enabled, true),
      ),
    );

  const [profile] = await db
    .select({
      selfType: athleteProfilesTable.selfType,
      ftpEstimated: athleteProfilesTable.ftpEstimated,
      weightKg: athleteProfilesTable.weightKg,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));

  const [user] = await db
    .select({ createdAt: userProfilesTable.createdAt })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));

  const now = new Date();
  let last14Count = 0;
  let prev14Count = 0;
  for (const r of recent) {
    if (!r.sessionDate) continue;
    const d = dayDiff(new Date(r.sessionDate), now);
    if (d >= 0 && d < 14) last14Count++;
    else if (d >= 14 && d < 28) prev14Count++;
  }

  // Recent-vs-baseline TSS split over the bounded slice (already newest-first).
  const withTss = recent.filter((r) => r.tss != null) as { tss: number }[];
  const half = Math.ceil(withTss.length / 2);
  const recentAvgTss = mean(withTss.slice(0, half).map((r) => r.tss));
  const baselineAvgTss = mean(withTss.slice(half).map((r) => r.tss));

  const durations = recent
    .filter((r) => r.durationMin != null)
    .map((r) => r.durationMin as number);
  const avgDurationMin = mean(durations);

  const distinctTypes = new Set(recent.map((r) => r.type).filter(Boolean)).size;

  const selfType = (profile?.selfType ?? null) as SelfType | null;

  return {
    totalSessions: total?.c ?? 0,
    last14Count,
    prev14Count,
    recentAvgTss,
    baselineAvgTss,
    avgDurationMin,
    distinctTypes,
    metricsCount: metrics?.c ?? 0,
    memoriesCount: memories?.c ?? 0,
    selfType,
    ftpEstimated: profile?.ftpEstimated ?? false,
    weightMissing: profile?.weightKg == null,
    daysKnown: user?.createdAt ? Math.max(0, dayDiff(new Date(user.createdAt), now)) : 0,
  };
}
