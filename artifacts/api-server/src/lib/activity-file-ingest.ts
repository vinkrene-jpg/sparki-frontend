// Uploaded activity files (GPX / FIT / TCX) are a first-class Data Hub source.
//
// A manual export from ANY platform — including TrainingPeaks, whose partner API
// Sparki does not use — becomes a canonical training session through the exact
// same pipeline as Strava: the parsed file is mapped to a CanonicalActivity and
// handed to `ingestBatch` under the "file" provider. That means cross-source
// dedupe/merge, TSS derivation, and provenance all apply for free, and every
// downstream engine (analysis, readiness, coach dashboard, planned-vs-executed)
// consumes an uploaded file identically to a connector sync — zero engine
// changes. This is the source-neutrality contract made real.
//
// Nothing is fabricated: a file with no real start time is NOT turned into a
// dated session (a bare route GPX is a route, not an activity), and every metric
// the file omits stays null.

import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  type ConnectorDataType,
  type SyncRunCounts,
} from "@workspace/db";
import type { GpxSummary } from "./gpx-parse";
import type { FitSummary } from "./fit-parse";
import type { TcxSummary } from "./tcx-parse";
import { ingestBatch } from "../engines/data-hub/ingest";
import { normalizeSport } from "../engines/data-hub/sports";
import {
  computeActivityDedupeKey,
  candidateDedupeKeys,
  activitiesPlausiblyEqual,
} from "../engines/data-hub/dedupe";
import type { CanonicalActivity, NormalizedBatch } from "../engines/data-hub/types";

// The canonical source id for any manually-uploaded activity file. One neutral
// id keeps provenance honest — the file's ORIGINAL platform is unknown, so we
// don't pretend to know it.
export const FILE_PROVIDER = "file";

export type ParsedFileKind = "gpx" | "fit" | "tcx";

export type ActivityFileIngestResult = {
  /** Canonical session the file created or merged into, or null when the file */
  /** had no real start time (kept as a parsed route, not a dated activity). */
  sessionId: number | null;
  counts: SyncRunCounts;
};

// Stable per-file id so a re-upload of the SAME bytes is idempotent (provenance
// upserts, no duplicate session). Identity is the file CONTENT only — a byte-
// identical export renamed on disk is the same activity, so the filename is
// deliberately excluded. Content hash — never a random id.
export function fileExternalId(
  content: string | Buffer,
  _fileName?: string,
): string {
  const h = crypto.createHash("sha1");
  h.update(typeof content === "string" ? Buffer.from(content, "utf8") : content);
  return h.digest("hex");
}

// File types that produce a real parsed summary today. When such a file is
// unlinked from its session it returns to the honest "parsed" state; a format
// with no parser (CSV/unknown) falls back to the "uploaded" placeholder.
export const PARSEABLE_FILE_TYPES = new Set(["gpx", "fit", "tcx"]);

// The honest status to restore when an import is unlinked from its session.
export function unlinkedImportStatus(
  fileType: string,
  hasParsedSummary: boolean,
): "parsed" | "uploaded" {
  return hasParsedSummary && PARSEABLE_FILE_TYPES.has(fileType)
    ? "parsed"
    : "uploaded";
}

// Average speed is real arithmetic on real distance + duration (not an estimate),
// mirroring what connectors report directly. Only computed when both exist.
function avgSpeedKph(
  distanceKm: number | null | undefined,
  durationSec: number | null | undefined,
): number | null {
  if (
    distanceKm == null ||
    durationSec == null ||
    !(durationSec > 0) ||
    !(distanceKm > 0)
  )
    return null;
  return Math.round((distanceKm / (durationSec / 3600)) * 10) / 10;
}

function durationMinFromSec(sec: number | null | undefined): number | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  return Math.round(sec / 60);
}

/**
 * Map a parsed file summary to a CanonicalActivity, or null when it cannot be
 * an activity honestly (no real start time). `sportHint` from the file wins;
 * GPX (a bare GPS track) has no sport and falls back to the hub default.
 */
export function summaryToCanonicalActivity(
  kind: ParsedFileKind,
  summary: GpxSummary | FitSummary | TcxSummary,
  externalId: string,
): CanonicalActivity | null {
  const startedAt = summary.startTime;
  if (!startedAt) return null;

  const durationSec = summary.durationSec ?? null;
  const durationMin = durationMinFromSec(durationSec);
  const distanceKm = summary.distanceKm ?? null;

  if (kind === "gpx") {
    const g = summary as GpxSummary;
    return {
      externalId,
      sport: "cycling", // a bare GPX track carries no sport; hub default
      startedAt,
      title: g.trackName ?? null,
      durationMin,
      distanceKm,
      elevationM: g.elevationGainM ?? null,
      avgSpeedKph: avgSpeedKph(distanceKm, durationSec),
      raw: g,
    };
  }

  const s = summary as FitSummary | TcxSummary;
  return {
    externalId,
    sport: normalizeSport(s.sport),
    startedAt,
    title: null,
    durationMin,
    distanceKm,
    elevationM: s.elevationGainM ?? null,
    avgPower: s.avgPower ?? null,
    avgHR: s.avgHeartRate ?? null,
    maxHR: s.maxHeartRate ?? null,
    avgCadence: s.avgCadence ?? null,
    avgSpeedKph: avgSpeedKph(distanceKm, durationSec),
    raw: s,
  };
}

/**
 * Ingest a parsed activity file into the canonical Data Hub and return the
 * session it created or merged into. Activities-only (files never carry daily
 * metrics / FTP / equipment), so consent is the user's own upload — granted.
 */
export async function ingestActivityFile(
  clerkId: string,
  kind: ParsedFileKind,
  summary: GpxSummary | FitSummary | TcxSummary,
  externalId: string,
): Promise<ActivityFileIngestResult> {
  const activity = summaryToCanonicalActivity(kind, summary, externalId);
  if (!activity) return { sessionId: null, counts: {} };

  const batch: NormalizedBatch = {
    importedDataTypes: ["activities", "training_history"],
    activities: [activity],
  };
  // A manual upload is the user's own explicit action — grant the activity
  // types it needs. Files carry no other data types.
  const allowed = new Set<ConnectorDataType>(["activities", "training_history"]);

  const counts = await ingestBatch(clerkId, FILE_PROVIDER, batch, { allowed });

  // Resolve the canonical session ingest just created or merged into, so the
  // import row can link to it. Uses the SAME dedupe logic ingest used.
  const sessionId = await resolveSessionId(clerkId, activity);
  return { sessionId, counts };
}

async function resolveSessionId(
  clerkId: string,
  activity: CanonicalActivity,
): Promise<number | null> {
  const keys = candidateDedupeKeys({
    sport: activity.sport,
    startedAt: activity.startedAt,
  });
  const rows = await db
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        inArray(trainingSessionsTable.dedupeKey, keys),
      ),
    );
  const match = rows.find((r) =>
    activitiesPlausiblyEqual(r, {
      durationMin: activity.durationMin ?? null,
      distanceKm: activity.distanceKm ?? null,
    }),
  );
  if (match) return match.id;
  // Fall back to an exact key match (defensive; ingest always sets dedupeKey).
  const exact = computeActivityDedupeKey({
    sport: activity.sport,
    startedAt: activity.startedAt,
  });
  return rows.find((r) => r.dedupeKey === exact)?.id ?? null;
}
