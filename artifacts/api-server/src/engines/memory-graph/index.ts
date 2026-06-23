import { and, eq, inArray } from "drizzle-orm";
import { db, aiObservationsTable } from "@workspace/db";
import { persistObservation } from "../../lib/ai-memory";
import { gatherSignals } from "./gather";
import { deriveConnections } from "./correlations";
import type { Connection } from "./types";

export type { Connection } from "./types";
export { gatherSignals } from "./gather";
export { deriveConnections } from "./correlations";

export type ConnectionAnalysisResult = {
  windowDays: number;
  derived: number;
  // newly written rows
  created: number;
  // an equivalent observation already existed (active or in dismiss cooldown)
  deduped: number;
  // dropped by the privacy gate (memory disabled)
  gated: number;
  connections: Connection[];
};

// Run Sparki's deterministic cross-domain connection analysis for one athlete:
// gather real signals → derive explainable connections → persist each through the
// privacy-gated memory store (so a disabled memory drops them honestly). Returns
// an honest breakdown of what was newly created, what already existed (deduped),
// and what the privacy gate dropped — without fabricating anything.
export async function runConnectionAnalysis(
  clerkId: string,
  windowDays = 45,
): Promise<ConnectionAnalysisResult> {
  const bundle = await gatherSignals(clerkId, windowDays);
  const connections = deriveConnections(bundle);

  // Snapshot the ids that already exist for these dedupeKeys so we can tell a
  // freshly-inserted row apart from a deduped/returned existing one.
  const dedupeKeys = connections.map((c) => c.dedupeKey);
  const priorIds = new Set<number>();
  if (dedupeKeys.length > 0) {
    const prior = await db
      .select({ id: aiObservationsTable.id })
      .from(aiObservationsTable)
      .where(
        and(
          eq(aiObservationsTable.clerkId, clerkId),
          inArray(aiObservationsTable.dedupeKey, dedupeKeys),
        ),
      );
    for (const r of prior) priorIds.add(r.id);
  }

  let created = 0;
  let deduped = 0;
  let gated = 0;
  for (const c of connections) {
    const row = await persistObservation({
      clerkId,
      sourceType: "connection_analysis",
      title: c.title,
      summary: c.summary,
      observationText: c.observationText,
      confidence: c.confidence,
      category: c.category,
      severity: c.severity,
      detectedPattern: c.detectedPattern,
      signals: c.signals,
      alternativeExplanations: c.alternativeExplanations,
      confidenceScore: c.confidenceScore,
      recommendedAction: c.recommendedAction ?? null,
      dedupeKey: c.dedupeKey,
    });
    if (!row) gated++;
    else if (priorIds.has(row.id)) deduped++;
    else created++;
  }

  return {
    windowDays: bundle.windowDays,
    derived: connections.length,
    created,
    deduped,
    gated,
    connections,
  };
}
