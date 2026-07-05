import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  athleteProfilesTable,
  ftpHistoryTable,
  equipmentTable,
  connectorActivitiesTable,
  type ConnectorDataType,
  type SyncRunCounts,
} from "@workspace/db";
import { deriveTss, ftpAtDate, type FtpEntry } from "../../lib/derived-load";
import type { NormalizedBatch } from "./types";
import { legacyTypeForSport } from "./sports";
import {
  computeActivityDedupeKey,
  candidateDedupeKeys,
  activitiesPlausiblyEqual,
  buildMergePatch,
  mergeSources,
} from "./dedupe";
import { cleanActivity, cleanDailyMetric, cleanFtp } from "./validation";

export interface IngestOptions {
  /** Data types the user has NOT revoked for this provider (default-grant). */
  allowed: Set<ConnectorDataType>;
}

// Activity payloads carry BOTH "activities" and "training_history" meaning and
// share one ingestion path. Revoking EITHER must block ingestion (AND, fails
// safe toward more privacy). This is the single source of truth for that gate.
export function activitiesIngestAllowed(
  allowed: Set<ConnectorDataType>,
): boolean {
  return allowed.has("activities") && allowed.has("training_history");
}

// The data types we may HONESTLY report as imported for a batch, given consent.
// A provider adapter may include "activities"/"training_history" when it fetched
// activities, but those must be dropped when consent blocked ingestion or no
// activity actually came back — so connection state never claims data it didn't
// persist.
export function effectiveImportedDataTypes(
  batch: NormalizedBatch,
  allowed: Set<ConnectorDataType>,
): ConnectorDataType[] {
  const set = new Set<ConnectorDataType>(batch.importedDataTypes);
  if (set.has("activities") || set.has("training_history")) {
    const persisted =
      (batch.activities?.length ?? 0) > 0 && activitiesIngestAllowed(allowed);
    if (!persisted) {
      set.delete("activities");
      set.delete("training_history");
    }
  }
  return [...set];
}

function dateOf(iso: string): string {
  return new Date(iso).toISOString().split("T")[0]!;
}

// numeric pg columns take strings via the driver.
function numStr(v: number | null | undefined): string | null {
  return v == null ? null : String(v);
}

// ── Activities ───────────────────────────────────────────────────────────────

// FTP knowledge for one athlete, loaded once per batch so every activity can
// derive its belastingscore against the FTP that applied on its date.
async function loadFtpContext(clerkId: string): Promise<{
  profileFtp: number | null;
  history: FtpEntry[];
}> {
  const [profile] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const history = await db
    .select({
      measuredAt: ftpHistoryTable.measuredAt,
      ftpWatts: ftpHistoryTable.ftpWatts,
    })
    .from(ftpHistoryTable)
    .where(eq(ftpHistoryTable.clerkId, clerkId));
  return { profileFtp: profile?.ftp ?? null, history };
}

async function ingestActivities(
  clerkId: string,
  provider: string,
  batch: NormalizedBatch,
  counts: SyncRunCounts,
): Promise<void> {
  if ((batch.activities?.length ?? 0) === 0) return;
  const ftpCtx = await loadFtpContext(clerkId);
  for (const rawActivity of batch.activities ?? []) {
    const a = cleanActivity(rawActivity);
    if (!a) {
      counts.skipped = (counts.skipped ?? 0) + 1;
      continue;
    }
    // Providers like Strava never send a belastingscore. Derive it from the
    // activity's own power and the FTP at that date (standard formula, see
    // lib/derived-load). Provider-supplied scores always win; when nothing is
    // derivable the score honestly stays null.
    let tss = a.tss;
    let intensityFactor: number | null = null;
    if (tss == null) {
      const derived = deriveTss({
        durationMin: a.durationMin,
        normalizedPower: a.normalizedPower,
        avgPower: a.avgPower,
        ftp: ftpAtDate(ftpCtx.history, dateOf(a.startedAt), ftpCtx.profileFtp),
      });
      if (derived) {
        tss = derived.tss;
        intensityFactor = derived.intensityFactor;
      }
    }
    const dedupeKey = computeActivityDedupeKey({
      sport: a.sport,
      startedAt: a.startedAt,
    });
    const candidateKeys = candidateDedupeKeys({
      sport: a.sport,
      startedAt: a.startedAt,
    });

    // Find a canonical session already produced from the same real activity:
    // coarse key match against neighbouring buckets, then a tolerance guard so
    // we don't merge two genuinely different activities that started close by.
    const candidates = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          inArray(trainingSessionsTable.dedupeKey, candidateKeys),
        ),
      );
    const existing = candidates.find((c) =>
      activitiesPlausiblyEqual(c, {
        durationMin: a.durationMin,
        distanceKm: a.distanceKm,
      }),
    );

    let sessionId: number;
    // Provenance rows share the canonical session's key so all sources for one
    // activity are queryable by a single dedupeKey.
    let sessionDedupeKey = dedupeKey;
    if (existing) {
      // Merge: fill gaps + record this source. Existing values win.
      const incoming = {
        durationMin: a.durationMin,
        distanceKm: numStr(a.distanceKm),
        elevationM: a.elevationM,
        normalizedPower: a.normalizedPower,
        avgPower: a.avgPower,
        avgHR: a.avgHR,
        maxHR: a.maxHR,
        avgCadence: a.avgCadence,
        avgSpeedKph: numStr(a.avgSpeedKph),
        tss,
        intensityFactor: numStr(intensityFactor),
        title: a.title ?? null,
      };
      const patch = buildMergePatch(
        existing as unknown as Record<string, unknown>,
        incoming,
      );
      const sources = mergeSources(existing.sources ?? null, provider);
      await db
        .update(trainingSessionsTable)
        .set({ ...patch, sources, updatedAt: new Date() })
        .where(eq(trainingSessionsTable.id, existing.id));
      sessionId = existing.id;
      sessionDedupeKey = existing.dedupeKey ?? dedupeKey;
      counts.merged = (counts.merged ?? 0) + 1;
    } else {
      const [inserted] = await db
        .insert(trainingSessionsTable)
        .values({
          clerkId,
          sessionDate: dateOf(a.startedAt),
          type: legacyTypeForSport(a.sport),
          sport: a.sport,
          title: a.title ?? null,
          durationMin: a.durationMin,
          distanceKm: numStr(a.distanceKm),
          elevationM: a.elevationM,
          normalizedPower: a.normalizedPower,
          avgPower: a.avgPower,
          avgHR: a.avgHR,
          maxHR: a.maxHR,
          avgCadence: a.avgCadence,
          avgSpeedKph: numStr(a.avgSpeedKph),
          tss,
          intensityFactor: numStr(intensityFactor),
          source: provider,
          externalRef: `${provider}:${a.externalId}`,
          dedupeKey,
          sources: [provider],
        })
        .returning({ id: trainingSessionsTable.id });
      sessionId = inserted!.id;
      counts.activities = (counts.activities ?? 0) + 1;
    }

    // Raw provenance row (idempotent per provider activity id).
    await db
      .insert(connectorActivitiesTable)
      .values({
        clerkId,
        provider,
        externalActivityId: a.externalId,
        sport: a.sport,
        startedAt: new Date(a.startedAt),
        dedupeKey: sessionDedupeKey,
        raw: (a.raw ?? rawActivity) as object,
        normalizedSessionId: sessionId,
      })
      .onConflictDoUpdate({
        target: [
          connectorActivitiesTable.clerkId,
          connectorActivitiesTable.provider,
          connectorActivitiesTable.externalActivityId,
        ],
        set: {
          dedupeKey: sessionDedupeKey,
          normalizedSessionId: sessionId,
          importedAt: new Date(),
        },
      });
  }
}

// ── Daily metrics ────────────────────────────────────────────────────────────
async function ingestDailyMetrics(
  clerkId: string,
  batch: NormalizedBatch,
  allowed: Set<ConnectorDataType>,
  counts: SyncRunCounts,
): Promise<void> {
  for (const raw of batch.dailyMetrics ?? []) {
    const m = cleanDailyMetric(raw);
    if (!m) {
      counts.skipped = (counts.skipped ?? 0) + 1;
      continue;
    }
    // Per-field consent gating: drop fields the user revoked for this provider.
    const fields: Record<string, unknown> = {};
    if (allowed.has("hrv") && m.hrv != null) fields.hrv = m.hrv;
    if (allowed.has("resting_hr") && m.restingHR != null)
      fields.restingHR = m.restingHR;
    if (allowed.has("sleep") && m.sleepHours != null)
      fields.sleepHours = numStr(m.sleepHours);
    if (allowed.has("sleep") && m.sleepQuality != null)
      fields.sleepQuality = m.sleepQuality;
    if (allowed.has("recovery") && m.fatigueScore != null)
      fields.fatigueScore = m.fatigueScore;
    if (allowed.has("weight") && m.weightKg != null)
      fields.weightKg = numStr(m.weightKg);

    if (Object.keys(fields).length === 0) continue;

    await db
      .insert(athleteDailyMetricsTable)
      .values({ clerkId, metricDate: m.date, ...fields })
      .onConflictDoUpdate({
        target: [
          athleteDailyMetricsTable.clerkId,
          athleteDailyMetricsTable.metricDate,
        ],
        set: { ...fields, updatedAt: new Date() },
      });
    counts.dailyMetrics = (counts.dailyMetrics ?? 0) + 1;
  }
}

// ── FTP ──────────────────────────────────────────────────────────────────────
async function ingestFtp(
  clerkId: string,
  provider: string,
  batch: NormalizedBatch,
  counts: SyncRunCounts,
): Promise<void> {
  for (const raw of batch.ftp ?? []) {
    const f = cleanFtp(raw);
    if (!f) {
      counts.skipped = (counts.skipped ?? 0) + 1;
      continue;
    }
    const testType = f.testType ?? provider;
    const [existing] = await db
      .select({ id: ftpHistoryTable.id })
      .from(ftpHistoryTable)
      .where(
        and(
          eq(ftpHistoryTable.clerkId, clerkId),
          eq(ftpHistoryTable.measuredAt, f.measuredAt),
          eq(ftpHistoryTable.testType, testType),
        ),
      );
    if (existing) continue; // idempotent — don't duplicate the same test
    await db.insert(ftpHistoryTable).values({
      clerkId,
      measuredAt: f.measuredAt,
      ftpWatts: f.ftpWatts,
      testType,
    });
    counts.ftp = (counts.ftp ?? 0) + 1;
  }
}

// ── Equipment ────────────────────────────────────────────────────────────────
async function ingestEquipment(
  clerkId: string,
  provider: string,
  batch: NormalizedBatch,
  counts: SyncRunCounts,
): Promise<void> {
  for (const e of batch.equipment ?? []) {
    if (!e.externalId || !e.name) {
      counts.skipped = (counts.skipped ?? 0) + 1;
      continue;
    }
    const [existing] = await db
      .select({ id: equipmentTable.id })
      .from(equipmentTable)
      .where(
        and(
          eq(equipmentTable.clerkId, clerkId),
          eq(equipmentTable.source, provider),
          eq(equipmentTable.externalId, e.externalId),
        ),
      );
    const values = {
      kind: e.kind,
      name: e.name,
      brand: e.brand ?? null,
      model: e.model ?? null,
      distanceKm: numStr(e.distanceKm),
    };
    if (existing) {
      await db
        .update(equipmentTable)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(equipmentTable.id, existing.id));
    } else {
      await db
        .insert(equipmentTable)
        .values({ clerkId, source: provider, externalId: e.externalId, ...values });
    }
    counts.equipment = (counts.equipment ?? 0) + 1;
  }
}

/**
 * Persist a normalized batch into Sparki's canonical tables, applying validation,
 * cross-source dedup/merge, per-data-type consent, and provenance. Returns the
 * per-type counts for the sync log. Never fabricates values.
 */
export async function ingestBatch(
  clerkId: string,
  provider: string,
  batch: NormalizedBatch,
  opts: IngestOptions,
): Promise<SyncRunCounts> {
  const counts: SyncRunCounts = {};
  const { allowed } = opts;

  // Strict per-datatype consent for activities (see activitiesIngestAllowed).
  if (activitiesIngestAllowed(allowed))
    await ingestActivities(clerkId, provider, batch, counts);

  await ingestDailyMetrics(clerkId, batch, allowed, counts);

  if (allowed.has("ftp")) await ingestFtp(clerkId, provider, batch, counts);

  await ingestEquipment(clerkId, provider, batch, counts);

  return counts;
}
