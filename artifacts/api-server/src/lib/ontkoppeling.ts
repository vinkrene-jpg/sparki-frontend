// ANALYSE_UITBREIDING §2 — ontkoppeling (HR:Power) + efficiëntie per rit.
// Eén implementatie voor de route én de analyse-op-verzoek-engine (§3):
// berekend met de gedeelde analysefuncties uit @workspace/analysis
// (verplaatst uit de sparki-client, niet herimplementeerd).

import { db, trainingSessionsTable, activityImportsTable } from "@workspace/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { hrDrift, pacing, type SessionStreams } from "@workspace/analysis";

export type OntkoppelingRit = {
  sessionId: number;
  date: string;
  title: string | null;
  durationMin: number | null;
  /** % drift eerste → tweede helft; null bij ongeschikte rit. */
  ontkoppelingPct: number | null;
  /** Vermogen per hartslag (W/slag) over de hele rit; null bij ongeschikt. */
  efficientieWPerSlag: number | null;
  /** Eerlijke reden waarom er geen getal is (alleen bij null). */
  reden: string | null;
};

export async function computeOntkoppelingRitten(
  clerkId: string,
  days: number,
): Promise<OntkoppelingRit[]> {
  const vanaf = new Date();
  vanaf.setDate(vanaf.getDate() - days);
  const vanafIso = `${vanaf.getFullYear()}-${String(vanaf.getMonth() + 1).padStart(2, "0")}-${String(vanaf.getDate()).padStart(2, "0")}`;

  const sessions = await db
    .select({
      id: trainingSessionsTable.id,
      sessionDate: trainingSessionsTable.sessionDate,
      title: trainingSessionsTable.title,
      durationMin: trainingSessionsTable.durationMin,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        gte(trainingSessionsTable.sessionDate, vanafIso),
      ),
    )
    .orderBy(trainingSessionsTable.sessionDate);

  if (sessions.length === 0) return [];

  const imports = await db
    .select({
      sessionId: activityImportsTable.linkedTrainingSessionId,
      streams: sql<unknown>`${activityImportsTable.parsedSummary} -> 'streams'`,
    })
    .from(activityImportsTable)
    .where(
      and(
        eq(activityImportsTable.clerkId, clerkId),
        inArray(
          activityImportsTable.linkedTrainingSessionId,
          sessions.map((s) => s.id),
        ),
      ),
    );
  const streamsBySession = new Map<string, unknown>();
  for (const imp of imports) {
    if (imp.sessionId) streamsBySession.set(String(imp.sessionId), imp.streams);
  }

  const ritten: OntkoppelingRit[] = [];
  for (const s of sessions) {
    const basis = {
      sessionId: s.id,
      date: s.sessionDate,
      title: s.title,
      durationMin: s.durationMin,
    };
    const streams = (streamsBySession.get(String(s.id)) ?? null) as SessionStreams | null;
    if (!streams || !streams.power || !streams.heartRate) {
      ritten.push({
        ...basis,
        ontkoppelingPct: null,
        efficientieWPerSlag: null,
        reden: "Geen vermogen én hartslag per sample voor deze rit.",
      });
      continue;
    }
    if (s.durationMin != null && s.durationMin < 60) {
      ritten.push({
        ...basis,
        ontkoppelingPct: null,
        efficientieWPerSlag: null,
        reden: "Te kort voor een betrouwbare ontkoppelingsmeting (minimaal een uur).",
      });
      continue;
    }
    const pace = pacing(streams);
    if (pace && pace.verdict === "zeer wisselend") {
      ritten.push({
        ...basis,
        ontkoppelingPct: null,
        efficientieWPerSlag: null,
        reden: "Te wisselend gereden (veel stops of pieken) — de verhouding zegt dan niets.",
      });
      continue;
    }
    const drift = hrDrift(streams);
    if (!drift) {
      ritten.push({
        ...basis,
        ontkoppelingPct: null,
        efficientieWPerSlag: null,
        reden: "Te weinig bruikbare samples met vermogen én hartslag.",
      });
      continue;
    }
    const eff =
      Math.round(((drift.firstHalfPwHr + drift.secondHalfPwHr) / 2) * 100) / 100;
    ritten.push({
      ...basis,
      ontkoppelingPct: drift.driftPct,
      efficientieWPerSlag: eff,
      reden: null,
    });
  }
  return ritten;
}
