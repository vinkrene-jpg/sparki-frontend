import { and, eq, inArray, isNull } from "drizzle-orm";
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
import { recordComputation } from "../data-origin";
import type { CanonicalActivity, NormalizedBatch } from "./types";
import { legacyTypeForSport } from "./sports";
import {
  computeActivityDedupeKey,
  candidateDedupeKeys,
  activitiesPlausiblyEqual,
  buildMergePatch,
  updateFieldSources,
  mergeSources,
  buildMergeLogEntry,
  appendMergeLog,
} from "./dedupe";
import { cleanActivity, cleanDailyMetric, cleanFtp } from "./validation";
import { autoLinkSession } from "../../lib/workout-execution";
import { deriveSessionSignals } from "../../lib/measurement-level";
import { deriveHrLoad } from "../../lib/hr-load";

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
  restingHr: number | null;
  maxHr: number | null;
}> {
  const [profile] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      estimated: athleteProfilesTable.ftpEstimated,
      restingHr: athleteProfilesTable.restingHr,
      maxHr: athleteProfilesTable.maxHr,
    })
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
  // DATA_TRUST_01: een GESCHATTE profiel-FTP telt niet als brondata voor de
  // afgeleide belastingscore — dan liever eerlijk geen score.
  const profileFtp =
    profile && profile.estimated !== true ? (profile.ftp ?? null) : null;
  return {
    profileFtp,
    history,
    restingHr: profile?.restingHr ?? null,
    maxHr: profile?.maxHr ?? null,
  };
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
    try {
      await persistOneActivity(clerkId, provider, a, rawActivity, ftpCtx, counts);
    } catch (err) {
      // Eén kapotte activiteit mag nooit de rest van de batch laten verdwijnen.
      // De transactie in persistOneActivity heeft alles van DEZE activiteit
      // teruggedraaid (geen halve rijen); we tellen de fout eerlijk mee zodat
      // de sync-run zichtbaar "partial" wordt in plaats van stil dataverlies.
      counts.errors = (counts.errors ?? 0) + 1;
      const msg = err instanceof Error ? err.message : String(err);
      const samples = (counts.errorSamples ??= []);
      if (samples.length < 5)
        samples.push(`${provider}:${a.externalId}: ${msg}`.slice(0, 300));
    }
  }
}

async function persistOneActivity(
  clerkId: string,
  provider: string,
  a: CanonicalActivity,
  rawActivity: CanonicalActivity,
  ftpCtx: Awaited<ReturnType<typeof loadFtpContext>>,
  counts: SyncRunCounts,
): Promise<void> {
  {
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
    // F3: sessies zonder vermogensbelasting krijgen — als hartslag, duur én
    // rust/max bekend zijn — een APARTE hartslagbelasting. Nooit optellen bij
    // tss; ontbreekt een ingrediënt, dan blijft dit eerlijk null.
    const hrLoad =
      tss == null
        ? deriveHrLoad({
            durationMin: a.durationMin,
            avgHR: a.avgHR,
            restingHr: ftpCtx.restingHr,
            maxHr: ftpCtx.maxHr,
          })
        : null;
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
    // Handmatig gelogde sessies hebben geen starttijd en dus geen dedupeKey.
    // Neem zelfde-dag handmatige sessies van hetzelfde type mee als merge-
    // kandidaat, zodat "eerst handmatig gelogd, daarna geïmporteerd" nooit
    // dubbel telt. De tolerantie-check hieronder bewaakt valse merges.
    const manualCandidates = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          eq(trainingSessionsTable.sessionDate, dateOf(a.startedAt)),
          isNull(trainingSessionsTable.dedupeKey),
          eq(trainingSessionsTable.type, legacyTypeForSport(a.sport)),
        ),
      );
    // Strengheidsregel voor handmatige kandidaten: die matchen alleen op dag
    // (geen tijd-bucket), dus zonder minstens één sterke vergelijker (duur of
    // afstand aan beide kanten) mergen we nooit — anders veegt een import een
    // losstaande handmatige training weg.
    const hasStrongComparator = (c: {
      durationMin: number | null;
      distanceKm: string | null;
    }) => {
      const candDur =
        typeof c.durationMin === "number" && Number.isFinite(c.durationMin)
          ? c.durationMin
          : null;
      const candDistRaw = c.distanceKm != null ? Number(c.distanceKm) : null;
      const candDist =
        candDistRaw != null && Number.isFinite(candDistRaw) ? candDistRaw : null;
      return (
        (a.durationMin != null && candDur != null) ||
        (a.distanceKm != null && candDist != null)
      );
    };
    const allCandidates = [
      ...candidates,
      ...manualCandidates.filter(
        (m) => !candidates.some((c) => c.id === m.id) && hasStrongComparator(m),
      ),
    ];
    const existing = allCandidates.find((c) =>
      activitiesPlausiblyEqual(c, {
        durationMin: a.durationMin,
        distanceKm: a.distanceKm,
      }),
    );

    // Alle schrijfacties voor DEZE activiteit (sessie + herkomstrij) vormen één
    // geheel: of alles staat er, of niets. Nooit een sessie zonder herkomst of
    // andersom (gedeeltelijk opgeslagen import).
    // Tellers pas NA een geslaagde commit bijwerken — bij een rollback mag de
    // mislukte activiteit niet als "nieuw"/"samengevoegd" meetellen.
    let outcome: "merged" | "created" | null = null;
    let createdSessionId: number | null = null;
    let createdTss: number | null = null;
    await db.transaction(async (tx) => {
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
        powerBests: a.powerBests ?? null,
        powerDurability: a.powerDurability ?? null,
        tss,
        intensityFactor: numStr(intensityFactor),
        title: a.title ?? null,
        notes: a.notes ?? null,
      };
      // Handmatige correcties van de sporter zijn onaantastbaar: die velden
      // worden nooit (opnieuw) gevuld door een connector-merge.
      // Velden die deze bron zélf eerder leverde mogen wel worden ververst —
      // een op het platform gewijzigde activiteit (titel, afstand) werkt dan
      // door zonder waarden van andere bronnen of de sporter te overschrijven.
      const ownFields = new Set(
        Object.entries(existing.fieldSources ?? {})
          .filter(([, src]) => src === provider)
          .map(([f]) => f),
      );
      const patch = buildMergePatch(
        existing as unknown as Record<string, unknown>,
        incoming,
        existing.manualFields ?? null,
        ownFields,
      );
      const sources = mergeSources(existing.sources ?? null, provider);
      const fieldSources = updateFieldSources(
        existing.fieldSources ?? null,
        patch,
        provider,
      );
      // Intern conflictlogboek: leg vast welke bron erbij kwam, welke velden
      // verschilden en waarom de behouden waarde won. Alleen intern zichtbaar
      // (beheer/ondersteuning) — de sporter ziet nooit een duplicaat.
      const mergeLog = appendMergeLog(
        existing.mergeLog ?? null,
        buildMergeLogEntry(
          existing as unknown as Record<string, unknown> & {
            fieldSources?: Record<string, string> | null;
            manualFields?: string[] | null;
          },
          incoming,
          patch,
          provider,
          sources,
        ),
      );
      await tx
        .update(trainingSessionsTable)
        .set({
          ...patch,
          sources,
          fieldSources,
          mergeLog,
          // F2: signalen groeien mee met wat de merge feitelijk aanvulde.
          signals: deriveSessionSignals({
            ...(existing as { avgPower?: number | null; normalizedPower?: number | null; avgHR?: number | null; durationMin?: number | null }),
            ...(patch as Record<string, unknown>),
          } as {
            avgPower?: number | null;
            normalizedPower?: number | null;
            avgHR?: number | null;
            durationMin?: number | null;
          }),
          // Een handmatige rij krijgt nu een echte starttijd-fingerprint en
          // sport van de import, zodat volgende imports haar wél via de
          // dedupeKey vinden.
          ...(existing.dedupeKey == null
            ? { dedupeKey, sport: existing.sport ?? a.sport }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(trainingSessionsTable.id, existing.id));
      sessionId = existing.id;
      sessionDedupeKey = existing.dedupeKey ?? dedupeKey;
      outcome = "merged";
    } else {
      const [inserted] = await tx
        .insert(trainingSessionsTable)
        .values({
          clerkId,
          sessionDate: dateOf(a.startedAt),
          type: legacyTypeForSport(a.sport),
          sport: a.sport,
          title: a.title ?? null,
          notes: a.notes ?? null,
          durationMin: a.durationMin,
          distanceKm: numStr(a.distanceKm),
          elevationM: a.elevationM,
          normalizedPower: a.normalizedPower,
          avgPower: a.avgPower,
          avgHR: a.avgHR,
          maxHR: a.maxHR,
          avgCadence: a.avgCadence,
          avgSpeedKph: numStr(a.avgSpeedKph),
          powerBests: a.powerBests ?? null,
          powerDurability: a.powerDurability ?? null,
          tss,
          intensityFactor: numStr(intensityFactor),
          hrLoad,
          // F2: welke signalen deze import feitelijk droeg — op ingest-moment.
          signals: deriveSessionSignals({
            avgPower: a.avgPower,
            normalizedPower: a.normalizedPower,
            avgHR: a.avgHR,
            durationMin: a.durationMin,
          }),
          source: provider,
          externalRef: `${provider}:${a.externalId}`,
          dedupeKey,
          sources: [provider],
          // Per-veld herkomst voor alle velden die deze bron echt leverde.
          fieldSources: updateFieldSources(
            null,
            {
              durationMin: a.durationMin,
              distanceKm: numStr(a.distanceKm),
              elevationM: a.elevationM,
              normalizedPower: a.normalizedPower,
              avgPower: a.avgPower,
              avgHR: a.avgHR,
              maxHR: a.maxHR,
              avgCadence: a.avgCadence,
              avgSpeedKph: numStr(a.avgSpeedKph),
              powerBests: a.powerBests ?? null,
              powerDurability: a.powerDurability ?? null,
              tss,
              intensityFactor: numStr(intensityFactor),
              title: a.title ?? null,
              notes: a.notes ?? null,
            },
            provider,
          ),
        })
        .returning({ id: trainingSessionsTable.id });
      sessionId = inserted!.id;
      createdSessionId = inserted!.id;
      createdTss = tss ?? null;
      outcome = "created";

      // Herleidbaarheid (Data Origin): registreer de afgeleide belastingscore
      // in dezelfde transactie als de sessie zelf.
      if (a.tss == null && tss != null && intensityFactor != null) {
        await recordComputation(
          {
            clerkId,
            subjectType: "derived_tss",
            subjectId: String(inserted!.id),
            engine: "deriveTss",
            engineVersion: "1",
            parameters: {
              durationMin: a.durationMin,
              normalizedPower: a.normalizedPower,
              avgPower: a.avgPower,
            },
            inputs: [
              {
                bron: provider,
                tabel: "training_sessions",
                recordId: inserted!.id,
                veld: "avgPower/normalizedPower/durationMin",
              },
              { bron: "derived", tabel: "ftp_history", veld: "ftp_watts" },
            ],
            reliability: "afgeleid",
          },
          tx,
        );
      }
    }

    // Raw provenance row (idempotent per provider activity id).
    await tx
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
    });
    if (outcome === "merged") counts.merged = (counts.merged ?? 0) + 1;
    if (outcome === "created") counts.activities = (counts.activities ?? 0) + 1;

    // Uitvoeringskoppeling: verbind de nieuwe activiteit met de geplande
    // training van die dag (Golf 23). Best-effort — een koppelfout mag een
    // geslaagde import nooit terugdraaien of laten mislukken.
    if (outcome === "created" && createdSessionId != null) {
      try {
        await autoLinkSession(clerkId, {
          id: createdSessionId,
          sessionDate: dateOf(a.startedAt),
          sport: a.sport,
          type: legacyTypeForSport(a.sport),
          durationMin: a.durationMin ?? null,
          tss: createdTss,
        });
      } catch {
        // Bewust stil: de import is geslaagd; koppeling probeert de volgende
        // lezer/lazy-selfheal opnieuw niet — handmatig koppelen blijft mogelijk.
      }
    }
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
