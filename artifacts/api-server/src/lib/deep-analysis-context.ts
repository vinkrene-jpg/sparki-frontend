// AI_COACH_KOPPELING_EN_GEHEUGEN_01 — R2: de diepe analyse naar de coach.
//
// Per recente rit gaat mee wat er al ligt: zoneverdeling, herkende intervallen
// met de vergelijking tegen het geplande blok, hartslagdrift en
// vermogensverval. Op atleetniveau: de powercurve van dit blok tegen het
// vorige. ALLES komt uit de gedeelde @workspace/analysis-functies en de bij
// ingest opgeslagen power_bests — nooit een tweede implementatie.
//
// Grens (R2): samenvattend — geen ruwe reeksen naar het model, alleen de
// uitkomsten.

import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  activityImportsTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  type WorkoutStructure,
} from "@workspace/db";
import {
  powerZoneDistribution,
  hrDrift,
  powerFade,
  detectIntervals,
  compareIntervalsWithPlan,
  type SessionStreams,
  type PlannedBlock,
} from "@workspace/analysis";
import { powerBestPeriods, localDateStr } from "./analysis-periods";

type SessieKop = { id: number; sessionDate: string; title: string | null };

/**
 * Compact tekstblok met de diepe analyse van de laatste ritten mét streams
 * (max 3) en de powercurve-vergelijking dit blok vs vorig blok. Eerlijk: ritten
 * zonder streams of zonder vermogen worden overgeslagen, niet opgevuld.
 */
export async function buildDeepAnalysisBlock(
  clerkId: string,
  recentSessions: SessieKop[],
  ftp: number | null,
): Promise<string | null> {
  if (recentSessions.length === 0) return null;
  const ids = recentSessions.map((s) => s.id);

  const [imports, planned, bestRows] = await Promise.all([
    db
      .select({
        sessionId: activityImportsTable.linkedTrainingSessionId,
        streams: sql<unknown>`${activityImportsTable.parsedSummary} -> 'streams'`,
      })
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.clerkId, clerkId),
          inArray(activityImportsTable.linkedTrainingSessionId, ids),
        ),
      ),
    db
      .select({
        scheduledDate: plannedWorkoutsTable.scheduledDate,
        structure: plannedWorkoutsTable.structure,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          inArray(plannedWorkoutsTable.scheduledDate, recentSessions.map((s) => s.sessionDate)),
        ),
      ),
    db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        powerBests: trainingSessionsTable.powerBests,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId)),
  ]);

  const streamsBySession = new Map<number, SessionStreams>();
  for (const imp of imports) {
    if (imp.sessionId != null && imp.streams && typeof imp.streams === "object") {
      const s = imp.streams as SessionStreams;
      if (Array.isArray(s.t) && s.t.length > 1) streamsBySession.set(imp.sessionId, s);
    }
  }
  const blocksByDate = new Map<string, PlannedBlock[]>();
  for (const p of planned) {
    const structure = p.structure as WorkoutStructure | null;
    if (structure?.blocks?.length) {
      blocksByDate.set(
        p.scheduledDate,
        structure.blocks.map((b) => ({
          kind: b.kind,
          durationMin: b.durationMin,
          targetPctFtp: b.targetPctFtp,
          reps: b.reps ?? null,
        })),
      );
    }
  }

  const lines: string[] = [];

  let besproken = 0;
  for (const s of recentSessions) {
    if (besproken >= 3) break;
    const streams = streamsBySession.get(s.id);
    if (!streams) continue;
    besproken += 1;

    const onderdelen: string[] = [];
    const zones = ftp ? powerZoneDistribution(streams, ftp) : null;
    if (zones) {
      const top = zones
        .filter((z) => z.pct >= 10)
        .map((z) => `${z.zone}=${z.pct}%`)
        .join(" ");
      if (top) onderdelen.push(`zoneverdeling (tijd): ${top}`);
    }
    const drift = hrDrift(streams);
    if (drift) onderdelen.push(`hartslagdrift: ${drift.driftPct}% (${drift.verdict})`);
    const fade = powerFade(streams);
    if (fade) onderdelen.push(`vermogensverloop: ${fade.verdict} (${fade.fadePct}%)`);
    const vergelijking = compareIntervalsWithPlan(
      streams,
      blocksByDate.get(s.sessionDate) ?? null,
      ftp,
    );
    if (vergelijking) {
      onderdelen.push(`intervallen vs plan: ${vergelijking.conclusion}`);
    } else {
      const ridden = detectIntervals(streams);
      if (ridden.length > 0) {
        onderdelen.push(
          `herkende werkblokken: ${ridden.length} (gem. ${Math.round(ridden.reduce((a, b) => a + b.avgW, 0) / ridden.length)}W)`,
        );
      }
    }
    if (onderdelen.length > 0) {
      lines.push(`  - [${s.sessionDate}] ${s.title ?? "rit"}: ${onderdelen.join("; ")}`);
    }
  }

  // Powercurve: dit 42-daagse blok vs het vorige — uit de opgeslagen bests.
  const { recentStart, previousStart } = powerBestPeriods(localDateStr());
  const recent: Record<string, number> = {};
  const previous: Record<string, number> = {};
  for (const row of bestRows) {
    const bests = row.powerBests;
    if (!bests || typeof bests !== "object") continue;
    for (const [win, watts] of Object.entries(bests)) {
      if (typeof watts !== "number" || !Number.isFinite(watts)) continue;
      if (row.sessionDate >= recentStart) {
        if (!recent[win] || watts > recent[win]) recent[win] = watts;
      } else if (row.sessionDate >= previousStart) {
        if (!previous[win] || watts > previous[win]) previous[win] = watts;
      }
    }
  }
  const curveDelen: string[] = [];
  for (const win of ["60", "300", "1200"]) {
    const nu = recent[win];
    const vorig = previous[win];
    if (nu != null && vorig != null) {
      const delta = Math.round(((nu - vorig) / vorig) * 100);
      curveDelen.push(`${win}s: ${nu}W vs ${vorig}W (${delta >= 0 ? "+" : ""}${delta}%)`);
    } else if (nu != null) {
      curveDelen.push(`${win}s: ${nu}W (geen vergelijk met vorig blok)`);
    }
  }
  if (curveDelen.length > 0) {
    lines.push(`  - powercurve dit blok (42d) vs vorige blok: ${curveDelen.join(", ")}`);
  }

  if (lines.length === 0) return null;
  return `DEEP RIDE ANALYSIS (uit de opgeslagen streams en power-bests — zelfde berekeningen als het Analyse-scherm, alleen uitkomsten):\n${lines.join("\n")}`;
}
