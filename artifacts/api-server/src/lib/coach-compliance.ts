// Naleving-overzicht voor de coach — gepland vs. werkelijk uitgevoerd.
//
// Hergebruikt de bestaande uitvoeringskoppeling (workout-execution.ts): de
// koppeling sessie↔geplande training is daar al gelegd (auto-link bij ingest,
// handmatig wint) en het oordeel (completed/partial/adjusted/missed) staat al
// als status op planned_workouts. Deze laag bouwt daar UITSLUITEND een
// dag-voor-dag-beeld bovenop — géén tweede koppel- of oordeelmechanisme.
//
// Statuskleuren (presentatie beslist de UI, dit is de betekenis):
//   groen  — uitgevoerd binnen de marge van het plan (status completed)
//   geel   — uitgevoerd maar duidelijk korter/lichter (partial) of
//            langer/zwaarder (adjusted) dan gepland, mét de reden
//   rood   — gepland maar geen rit binnengekomen (status missed)
//   open   — gepland, dag nog niet voorbij
//   grijs  — geannuleerd
// Ritten zonder geplande training tellen apart als "extra" — eerlijk zichtbaar,
// nooit stiekem aan een plan geplakt.

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, plannedWorkoutsTable, trainingSessionsTable } from "@workspace/db";
import { classifyExecution } from "./workout-execution";

export type ComplianceStatus = "groen" | "geel" | "rood" | "open" | "grijs";

export type ComplianceEntry = {
  date: string;
  status: ComplianceStatus;
  /** Eerlijke, korte reden — alleen gevuld bij geel/rood. */
  reason: string | null;
  planned: {
    id: number;
    title: string;
    source: string;
    targetDurationMin: number | null;
    targetTSS: number | null;
  } | null;
  executed: {
    sessionId: number;
    title: string | null;
    durationMin: number | null;
    /** Vermogensbelasting (tss); null als de rit geen vermogen had. */
    tss: number | null;
    /** Hartslagbelasting — apart benoemd, nooit met tss vermengd. */
    hrLoad: number | null;
  } | null;
  /** true = rit zonder geplande training die dag ("extra"). */
  extra: boolean;
};

export type ComplianceSummary = {
  groen: number;
  geel: number;
  rood: number;
  open: number;
  extra: number;
};

function summarize(entries: ComplianceEntry[]): ComplianceSummary {
  const s: ComplianceSummary = { groen: 0, geel: 0, rood: 0, open: 0, extra: 0 };
  for (const e of entries) {
    if (e.extra) s.extra += 1;
    else if (e.status === "groen") s.groen += 1;
    else if (e.status === "geel") s.geel += 1;
    else if (e.status === "rood") s.rood += 1;
    else if (e.status === "open") s.open += 1;
  }
  return s;
}

/**
 * Dag-voor-dag nalevingsbeeld voor één sporter over [from, to].
 * Leest uitsluitend wat er al staat; de aanroeper draait vooraf
 * markOverdueAsMissed zodat verstreken dagen eerlijk "missed" zijn.
 */
export async function buildCompliance(
  athleteClerkId: string,
  from: string,
  to: string,
  today: string,
): Promise<{ entries: ComplianceEntry[]; summary: ComplianceSummary }> {
  const [workouts, sessions] = await Promise.all([
    db
      .select({
        id: plannedWorkoutsTable.id,
        scheduledDate: plannedWorkoutsTable.scheduledDate,
        title: plannedWorkoutsTable.title,
        source: plannedWorkoutsTable.source,
        status: plannedWorkoutsTable.status,
        sessionId: plannedWorkoutsTable.sessionId,
        targetDurationMin: plannedWorkoutsTable.targetDurationMin,
        targetTSS: plannedWorkoutsTable.targetTSS,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, athleteClerkId),
          gte(plannedWorkoutsTable.scheduledDate, from),
          lte(plannedWorkoutsTable.scheduledDate, to),
        ),
      )
      .orderBy(asc(plannedWorkoutsTable.scheduledDate), asc(plannedWorkoutsTable.id)),
    db
      .select({
        id: trainingSessionsTable.id,
        sessionDate: trainingSessionsTable.sessionDate,
        title: trainingSessionsTable.title,
        durationMin: trainingSessionsTable.durationMin,
        tss: trainingSessionsTable.tss,
        hrLoad: trainingSessionsTable.hrLoad,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, athleteClerkId),
          gte(trainingSessionsTable.sessionDate, from),
          lte(trainingSessionsTable.sessionDate, to),
        ),
      )
      .orderBy(desc(trainingSessionsTable.sessionDate), desc(trainingSessionsTable.id)),
  ]);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const linkedSessionIds = new Set(
    workouts.map((w) => w.sessionId).filter((x): x is number => x != null),
  );

  const entries: ComplianceEntry[] = [];

  for (const w of workouts) {
    const linked = w.sessionId != null ? (sessionById.get(w.sessionId) ?? null) : null;
    let status: ComplianceStatus;
    let reason: string | null = null;

    if (w.status === "cancelled") {
      status = "grijs";
    } else if (w.status === "completed") {
      status = "groen";
    } else if (w.status === "partial" || w.status === "adjusted") {
      status = "geel";
      // Zelfde deterministische oordeel als bij de koppeling — de reden wordt
      // herberekend uit de echte cijfers, nooit opnieuw "beslist".
      reason = linked
        ? classifyExecution(
            {
              id: linked.id,
              sessionDate: w.scheduledDate,
              durationMin: linked.durationMin,
              tss: linked.tss,
            },
            w,
          ).reason
        : w.status === "partial"
          ? "Duidelijk korter of lichter uitgevoerd dan gepland."
          : "Duidelijk langer of zwaarder uitgevoerd dan gepland.";
    } else if (w.status === "missed") {
      status = "rood";
      reason = "Geen rit binnengekomen op deze dag.";
    } else if (w.scheduledDate >= today) {
      status = "open";
    } else {
      // Verleden maar nog planned/modified: de lazy zelfheling draait vóór dit
      // leespad; komt dit toch voor, dan tonen we het eerlijk als rood.
      status = "rood";
      reason = "Geen rit binnengekomen op deze dag.";
    }

    entries.push({
      date: w.scheduledDate,
      status,
      reason,
      planned: {
        id: w.id,
        title: w.title,
        source: w.source,
        targetDurationMin: w.targetDurationMin,
        targetTSS: w.targetTSS,
      },
      executed: linked
        ? {
            sessionId: linked.id,
            title: linked.title,
            durationMin: linked.durationMin,
            tss: linked.tss,
            hrLoad: linked.hrLoad,
          }
        : null,
      extra: false,
    });
  }

  // Ongeplande ritten: eerlijk als "extra" erbij, nooit aan een plan geplakt.
  for (const s of sessions) {
    if (linkedSessionIds.has(s.id)) continue;
    entries.push({
      date: s.sessionDate,
      status: "groen",
      reason: null,
      planned: null,
      executed: {
        sessionId: s.id,
        title: s.title,
        durationMin: s.durationMin,
        tss: s.tss,
        hrLoad: s.hrLoad,
      },
      extra: true,
    });
  }

  entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  return { entries, summary: summarize(entries) };
}
