import { eq, sql } from "drizzle-orm";
import {
  db,
  healthCheckResultsTable,
  healthCheckRunsTable,
  healthCheckBatchesTable,
  type HealthStatusColor,
  type HealthRunMode,
} from "@workspace/db";
import { healthCheckDefinitions, getCheckDefinition } from "./checks";
import type { CheckDefinition, ProbeResult, RunOptions } from "./types";

export interface CheckOutcome {
  key: string;
  category: string;
  title: string;
  responsibleModule: string;
  statusColor: HealthStatusColor;
  passed: boolean;
  responseTimeMs: number;
  message: string | null;
  technicalDetails: string | null;
}

// Run a single definition's probe defensively — a throwing probe becomes a red
// result rather than crashing the whole run.
async function runProbe(def: CheckDefinition): Promise<ProbeResult> {
  try {
    return await def.probe();
  } catch (err) {
    return {
      status: "red",
      passed: false,
      responseTimeMs: 0,
      message: "Deze controle kon niet worden uitgevoerd.",
      technicalDetails: err instanceof Error ? err.message : String(err),
      urgency: "high",
    };
  }
}

// "Worst" status for the batch headline. Grey is informational, never the worst.
const SEVERITY: Record<HealthStatusColor, number> = {
  green: 0,
  grey: 0,
  orange: 1,
  red: 2,
};

function worst(a: HealthStatusColor, b: HealthStatusColor): HealthStatusColor {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

// Persist one check's outcome: upsert the latest-result row + append history.
async function persistResult(
  def: CheckDefinition,
  result: ProbeResult,
  mode: HealthRunMode,
  batchId: number | null,
): Promise<void> {
  const now = new Date();
  const urgency = result.urgency ?? def.urgency;
  const remediation = result.remediation ?? def.remediation;

  await db
    .insert(healthCheckResultsTable)
    .values({
      checkKey: def.key,
      category: def.category,
      title: def.title,
      description: def.description,
      responsibleModule: def.responsibleModule,
      statusColor: result.status,
      passed: result.passed,
      responseTimeMs: result.responseTimeMs,
      lastRunAt: now,
      lastSuccessAt: result.passed ? now : null,
      errorMessage: result.message ?? null,
      technicalDetails: result.technicalDetails ?? null,
      userImpact: def.userImpact,
      urgency,
      remediation,
    })
    .onConflictDoUpdate({
      target: healthCheckResultsTable.checkKey,
      set: {
        category: def.category,
        title: def.title,
        description: def.description,
        responsibleModule: def.responsibleModule,
        statusColor: result.status,
        passed: result.passed,
        responseTimeMs: result.responseTimeMs,
        lastRunAt: now,
        // Only advance lastSuccessAt on a pass; keep the previous one otherwise.
        ...(result.passed ? { lastSuccessAt: now } : {}),
        errorMessage: result.message ?? null,
        technicalDetails: result.technicalDetails ?? null,
        userImpact: def.userImpact,
        urgency,
        remediation,
        // A fresh pass clears any earlier "resolved" acknowledgement so a later
        // regression shows up as a new open failure.
        ...(result.passed ? { resolvedAt: null, resolvedBy: null } : {}),
        updatedAt: now,
      },
    });

  await db.insert(healthCheckRunsTable).values({
    checkKey: def.key,
    batchId,
    runMode: mode,
    statusColor: result.status,
    passed: result.passed,
    responseTimeMs: result.responseTimeMs,
    errorMessage: result.message ?? null,
    technicalDetails: result.technicalDetails ?? null,
  });
}

// Run all checks (or a single one) and persist everything as one batch.
export async function runHealthChecks(
  opts: RunOptions,
): Promise<{ batchId: number; outcomes: CheckOutcome[] }> {
  const defs = opts.onlyKey
    ? healthCheckDefinitions.filter((d) => d.key === opts.onlyKey)
    : healthCheckDefinitions;

  if (defs.length === 0) {
    throw new Error(`Onbekende controle: ${opts.onlyKey}`);
  }

  const mode: HealthRunMode = opts.mode;

  // Open the batch first so history rows can reference it.
  const [batch] = await db
    .insert(healthCheckBatchesTable)
    .values({
      runMode: mode,
      overallStatus: "green",
      totalChecks: defs.length,
      triggeredBy: opts.triggeredBy,
    })
    .returning({ id: healthCheckBatchesTable.id });
  const batchId = batch!.id;

  // Run probes in parallel (bounded by how few we have). Each probe times out
  // internally, so the run cannot hang.
  const results = await Promise.all(
    defs.map(async (def) => ({ def, result: await runProbe(def) })),
  );

  let overall: HealthStatusColor = "green";
  const counts = { green: 0, orange: 0, red: 0, grey: 0 };
  const outcomes: CheckOutcome[] = [];

  for (const { def, result } of results) {
    await persistResult(def, result, mode, batchId);
    counts[result.status]++;
    overall = worst(overall, result.status);
    outcomes.push({
      key: def.key,
      category: def.category,
      title: def.title,
      responsibleModule: def.responsibleModule,
      statusColor: result.status,
      passed: result.passed,
      responseTimeMs: result.responseTimeMs,
      message: result.message ?? null,
      technicalDetails: result.technicalDetails ?? null,
    });
  }

  await db
    .update(healthCheckBatchesTable)
    .set({
      overallStatus: overall,
      greenCount: counts.green,
      orangeCount: counts.orange,
      redCount: counts.red,
      greyCount: counts.grey,
      finishedAt: new Date(),
    })
    .where(eq(healthCheckBatchesTable.id, batchId));

  return { batchId, outcomes };
}

// Re-run a single check by key (used by the "Opnieuw testen" button + scheduler
// single mode). Throws if the key is unknown.
export async function runSingleCheck(
  key: string,
  triggeredBy: string,
): Promise<CheckOutcome> {
  if (!getCheckDefinition(key)) {
    throw new Error(`Onbekende controle: ${key}`);
  }
  const { outcomes } = await runHealthChecks({
    mode: "single",
    triggeredBy,
    onlyKey: key,
  });
  return outcomes[0]!;
}

// True if any persisted result is currently a hard failure (red) that hasn't
// been acknowledged. Used by the pre-release gate to exit non-zero.
export async function hasCriticalFailures(): Promise<boolean> {
  const r = await db.execute(
    sql`SELECT count(*)::int AS n FROM health_check_results
        WHERE status_color = 'red' AND resolved_at IS NULL`,
  );
  return Number((r.rows[0] as { n?: number } | undefined)?.n ?? 0) > 0;
}
