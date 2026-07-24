// Sparki Foundation — Data Engine.
//
// One central place where the deterministic computations come together for a
// foundation run. It does NOT re-implement any math: it delegates to the
// existing single sources of truth (computeLoadSeries, computeRiskSignal,
// computeReadiness, computeZones) and assembles one reproducible snapshot.
// Honest gaps: channels without data land in `ontbrekend`, never invented.

import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  racesTable,
} from "@workspace/db";
import {
  computeLoadSeries,
  computeRiskSignal,
} from "../../lib/recovery-load";
import { computeReadiness } from "../../lib/sharing";
import { computeZones } from "../profile";
import type { DataEngine, DataSnapshot } from "./contracts";
import { FOUNDATION_CONFIG } from "./config";
import { engineLogger } from "./logging";

const log = engineLogger("data");

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0]!;
}

export function createDataEngine(): DataEngine {
  return {
    async collect(clerkId: string): Promise<DataSnapshot> {
      const cfg = FOUNDATION_CONFIG.data;
      const windowDays = Number(cfg.parameters["sessieVensterDagen"] ?? 90);
      const since = isoDaysAgo(windowDays);
      const today = new Date().toISOString().split("T")[0]!;

      const [profileRows, sessions, metrics, races, planned] =
        await Promise.all([
          db
            .select()
            .from(athleteProfilesTable)
            .where(eq(athleteProfilesTable.clerkId, clerkId))
            .limit(1),
          db
            .select({
              id: trainingSessionsTable.id,
              sessionDate: trainingSessionsTable.sessionDate,
              type: trainingSessionsTable.type,
              source: trainingSessionsTable.source,
              durationMin: trainingSessionsTable.durationMin,
              tss: trainingSessionsTable.tss,
            })
            .from(trainingSessionsTable)
            .where(
              and(
                eq(trainingSessionsTable.clerkId, clerkId),
                gte(trainingSessionsTable.sessionDate, since),
              ),
            )
            .orderBy(desc(trainingSessionsTable.sessionDate)),
          db
            .select()
            .from(athleteDailyMetricsTable)
            .where(
              and(
                eq(athleteDailyMetricsTable.clerkId, clerkId),
                gte(athleteDailyMetricsTable.metricDate, isoDaysAgo(42)),
              ),
            )
            .orderBy(desc(athleteDailyMetricsTable.metricDate)),
          db
            .select({
              id: racesTable.id,
              name: racesTable.name,
              raceDate: racesTable.raceDate,
              priority: racesTable.priority,
            })
            .from(racesTable)
            .where(
              and(eq(racesTable.clerkId, clerkId), gte(racesTable.raceDate, today)),
            )
            .orderBy(racesTable.raceDate),
          db
            .select({
              id: plannedWorkoutsTable.id,
              date: plannedWorkoutsTable.scheduledDate,
              targetTSS: plannedWorkoutsTable.targetTSS,
            })
            .from(plannedWorkoutsTable)
            .where(
              and(
                eq(plannedWorkoutsTable.clerkId, clerkId),
                gte(plannedWorkoutsTable.scheduledDate, today),
              ),
            )
            .orderBy(plannedWorkoutsTable.scheduledDate),
        ]);

      const profile = profileRows[0] ?? null;
      const ftp = profile?.ftp ?? null;
      const hasSessions = sessions.length > 0;
      const belasting = hasSessions ? computeLoadSeries(sessions) : null;
      const latestMetric = metrics[0] ?? null;
      const paraatheid = latestMetric ? computeReadiness(latestMetric) : null;
      const risico =
        belasting && paraatheid
          ? computeRiskSignal({
              load: belasting,
              readiness: paraatheid,
              healthStatus: profile?.healthStatus ?? "ok",
            })
          : null;

      const ontbrekend: string[] = [];
      if (!profile) ontbrekend.push("sportersprofiel");
      if (ftp == null) ontbrekend.push("ftp");
      if (profile?.weightKg == null) ontbrekend.push("gewicht");
      if (!hasSessions) ontbrekend.push("trainingssessies");
      if (metrics.length === 0) ontbrekend.push("dagmetingen (hrv/slaap/gevoel)");
      if (races.length === 0) ontbrekend.push("wedstrijdplanning");
      if (planned.length === 0) ontbrekend.push("geplande trainingen");

      log.info(
        {
          clerkId,
          sessies: sessions.length,
          metingen: metrics.length,
          ontbrekend: ontbrekend.length,
        },
        "foundation.data.collect",
      );

      return {
        clerkId,
        peildatum: today,
        profiel: {
          ftp,
          ftpEstimated: profile?.ftpEstimated ?? false,
          gewichtKg: profile?.weightKg != null ? Number(profile.weightKg) : null,
          zones:
            ftp != null
              ? computeZones(ftp).map((z) => ({
                  zone: String(z.zone),
                  minWatts: z.min,
                  maxWatts: z.max ?? null,
                }))
              : null,
        },
        sessies: sessions,
        belasting,
        risico,
        paraatheid,
        dagmetingen: metrics.map((m) => ({
          metricDate: m.metricDate,
          hrv: m.hrv,
          sleepHours: m.sleepHours != null ? Number(m.sleepHours) : null,
          sleepQuality: m.sleepQuality,
        })),
        wedstrijden: races,
        geplandeTrainingen: planned,
        ontbrekend,
        berekening: { versie: cfg.versie, parameters: cfg.parameters },
      };
    },
  };
}
