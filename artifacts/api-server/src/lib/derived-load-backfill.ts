// Self-healing derived-load pass.
//
// Two honest repairs over data that already exists:
//   1. Sessions imported WITHOUT a belastingscore (providers like Strava never
//      send one) get it derived from their own power + the athlete's FTP at
//      that date — the standard deterministic formula in lib/derived-load.
//      A session without power or without a known FTP stays honestly empty.
//   2. Athletes whose weekly hour target is still an ESTIMATE
//      (weeklyHourTargetEstimated = true) get it re-derived from what they
//      actually ride (median over recent complete weeks), so advice stops
//      comparing reality against a stale guess. A user-set target is never
//      touched.
//
// Runs fire-and-forget at server start (covers the production rows that were
// imported before this derivation existed) and per-athlete after every sync.
// Idempotent: only rows with tss IS NULL are considered, and the target is
// only written when the derived value actually differs.

import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import {
  db,
  pool,
  trainingSessionsTable,
  athleteProfilesTable,
  ftpHistoryTable,
} from "@workspace/db";
import {
  deriveTss,
  estimateFtpFloor,
  ftpAtDate,
  medianWeeklyHours,
  type FtpEntry,
} from "./derived-load";

// Advisory lock so overlapping instances (autoscale) don't do the same work
// twice. Distinct from the world-seed lock id.
const ADVISORY_LOCK_ID = 727401002;

export type DerivedBackfillSummary = {
  ran: boolean;
  sessionsUpdated: number;
  sessionsSkipped: number;
  targetsRecalibrated: number;
  ftpFloorsRaised: number;
};

type Log = (msg: string) => void;

/** Derive + persist belastingscore for one athlete's score-less sessions. */
export async function backfillTssForAthlete(clerkId: string): Promise<{
  updated: number;
  skipped: number;
}> {
  const rows = await db
    .select({
      id: trainingSessionsTable.id,
      sessionDate: trainingSessionsTable.sessionDate,
      durationMin: trainingSessionsTable.durationMin,
      normalizedPower: trainingSessionsTable.normalizedPower,
      avgPower: trainingSessionsTable.avgPower,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        isNull(trainingSessionsTable.tss),
        isNotNull(trainingSessionsTable.durationMin),
        or(
          isNotNull(trainingSessionsTable.normalizedPower),
          isNotNull(trainingSessionsTable.avgPower),
        ),
      ),
    );
  if (rows.length === 0) return { updated: 0, skipped: 0 };

  const [profile] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const history: FtpEntry[] = (
    await db
      .select({
        measuredAt: ftpHistoryTable.measuredAt,
        ftpWatts: ftpHistoryTable.ftpWatts,
      })
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, clerkId))
  ).map((e) => ({ measuredAt: e.measuredAt, ftpWatts: e.ftpWatts }));

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const ftp = ftpAtDate(history, row.sessionDate, profile?.ftp ?? null);
    const derived = deriveTss({
      durationMin: row.durationMin,
      normalizedPower: row.normalizedPower,
      avgPower: row.avgPower,
      ftp,
    });
    if (!derived) {
      skipped++;
      continue;
    }
    await db
      .update(trainingSessionsTable)
      .set({
        tss: derived.tss,
        intensityFactor: String(derived.intensityFactor),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trainingSessionsTable.id, row.id),
          // Guard against a concurrent writer having filled it meanwhile —
          // a real (provider- or user-supplied) score always wins.
          isNull(trainingSessionsTable.tss),
        ),
      );
    updated++;
  }
  return { updated, skipped };
}

/**
 * Raise an ESTIMATED FTP to the honest floor proven by real efforts in the
 * last `windowDays`. Only ever RAISES (a floor can't lower anything), only
 * touches profiles with ftpEstimated=true, and records the correction in
 * ftp_history so belastingscores use the right FTP from that date on.
 * A user-measured FTP is never touched.
 */
export async function recalibrateEstimatedFtp(
  clerkId: string,
  windowDays = 120,
): Promise<{ changed: boolean; ftp: number | null }> {
  const [profile] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      estimated: athleteProfilesTable.ftpEstimated,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile || !profile.estimated) return { changed: false, ftp: null };

  const sessions = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      durationMin: trainingSessionsTable.durationMin,
      normalizedPower: trainingSessionsTable.normalizedPower,
      avgPower: trainingSessionsTable.avgPower,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        sql`${trainingSessionsTable.sessionDate} >= (CURRENT_DATE - make_interval(days => ${windowDays}))::date`,
      ),
    );
  const floor = estimateFtpFloor(sessions);
  if (!floor) return { changed: false, ftp: profile.ftp };
  if (profile.ftp != null && floor.floorWatts <= profile.ftp) {
    return { changed: false, ftp: profile.ftp };
  }

  await db
    .update(athleteProfilesTable)
    .set({
      ftp: floor.floorWatts,
      // Still a derived value (a lower bound, not a measurement) — the flag
      // stays true so a stronger real effort keeps raising it.
      ftpEstimated: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(athleteProfilesTable.clerkId, clerkId),
        eq(athleteProfilesTable.ftpEstimated, true),
      ),
    );

  // Record in ftp_history so ftpAtDate applies the corrected value to rides
  // from the proof date on. Idempotent PER DAY: at most one derived row per
  // clerkId+measuredAt — a re-derivation for the same proof date UPDATES that
  // row instead of stacking same-day duplicates (which would make FTP-at-date
  // selection order-dependent).
  const notes =
    floor.basis.kind === "sustained"
      ? `Ondergrens: ${floor.basis.watts} watt volgehouden over ${floor.basis.durationMin} min`
      : `Ondergrens: 95% van ${floor.basis.watts} watt over ${floor.basis.durationMin} min`;
  const [existing] = await db
    .select({ id: ftpHistoryTable.id, ftpWatts: ftpHistoryTable.ftpWatts })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.clerkId, clerkId),
        eq(ftpHistoryTable.measuredAt, floor.basis.sessionDate),
        eq(ftpHistoryTable.testType, "derived"),
      ),
    )
    .limit(1);
  if (!existing) {
    await db.insert(ftpHistoryTable).values({
      clerkId,
      measuredAt: floor.basis.sessionDate,
      ftpWatts: floor.floorWatts,
      testType: "derived",
      notes,
    });
  } else if (existing.ftpWatts !== floor.floorWatts) {
    await db
      .update(ftpHistoryTable)
      .set({ ftpWatts: floor.floorWatts, notes })
      .where(eq(ftpHistoryTable.id, existing.id));
  }
  return { changed: true, ftp: floor.floorWatts };
}

/**
 * Re-derive an ESTIMATED weekly hour target from real riding. No-op when the
 * target was set by the user, when there aren't enough complete riding weeks,
 * or when the derived value equals the current one.
 */
export async function recalibrateWeeklyTarget(
  clerkId: string,
  now = new Date(),
): Promise<{ changed: boolean; hours: number | null }> {
  const [profile] = await db
    .select({
      weeklyHourTarget: athleteProfilesTable.weeklyHourTarget,
      estimated: athleteProfilesTable.weeklyHourTargetEstimated,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile || !profile.estimated) return { changed: false, hours: null };

  const sessions = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      durationMin: trainingSessionsTable.durationMin,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        sql`${trainingSessionsTable.sessionDate} >= (CURRENT_DATE - INTERVAL '70 days')::date`,
      ),
    );
  const { medianHours } = medianWeeklyHours(sessions, now);
  if (medianHours == null) return { changed: false, hours: null };
  if (medianHours === profile.weeklyHourTarget) {
    return { changed: false, hours: medianHours };
  }
  await db
    .update(athleteProfilesTable)
    .set({
      weeklyHourTarget: medianHours,
      // It stays a derived value (not user-set), so the flag stays true and a
      // later change in real riding keeps recalibrating it.
      weeklyHourTargetEstimated: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(athleteProfilesTable.clerkId, clerkId),
        eq(athleteProfilesTable.weeklyHourTargetEstimated, true),
      ),
    );
  return { changed: true, hours: medianHours };
}

/** Post-sync hook: repair this athlete's derived numbers. Never throws. */
export async function refreshDerivedLoadForAthlete(
  clerkId: string,
): Promise<void> {
  try {
    // FTP first: the corrected value must feed the score derivation below.
    await recalibrateEstimatedFtp(clerkId);
    await backfillTssForAthlete(clerkId);
    await recalibrateWeeklyTarget(clerkId);
  } catch {
    // Best-effort: a failed derivation must never break a successful sync.
  }
}

/**
 * Server-start pass over ALL athletes with derivable-but-missing scores or a
 * stale estimated target. Skips silently when another instance holds the lock.
 */
export async function backfillDerivedLoad(
  opts: { log?: Log } = {},
): Promise<DerivedBackfillSummary> {
  const log = opts.log ?? (() => {});
  const summary: DerivedBackfillSummary = {
    ran: false,
    sessionsUpdated: 0,
    sessionsSkipped: 0,
    targetsRecalibrated: 0,
    ftpFloorsRaised: 0,
  };

  // Advisory locks are SESSION-bound: acquire and release MUST happen on the
  // same connection, so hold a dedicated client for the whole pass. Pool-level
  // queries could unlock on a different session and leave the lock stuck.
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [ADVISORY_LOCK_ID],
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) return summary; // another instance is on it
    summary.ran = true;

    // FTP floors first: score derivation below must use the corrected FTP.
    const estimatedFtp = await db
      .select({ clerkId: athleteProfilesTable.clerkId })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.ftpEstimated, true));
    for (const p of estimatedFtp) {
      const r = await recalibrateEstimatedFtp(p.clerkId);
      if (r.changed) summary.ftpFloorsRaised++;
    }

    // Athletes with at least one derivable session missing a score.
    const candidates = await db
      .selectDistinct({ clerkId: trainingSessionsTable.clerkId })
      .from(trainingSessionsTable)
      .where(
        and(
          isNull(trainingSessionsTable.tss),
          isNotNull(trainingSessionsTable.durationMin),
          or(
            isNotNull(trainingSessionsTable.normalizedPower),
            isNotNull(trainingSessionsTable.avgPower),
          ),
        ),
      );
    for (const c of candidates) {
      const r = await backfillTssForAthlete(c.clerkId);
      summary.sessionsUpdated += r.updated;
      summary.sessionsSkipped += r.skipped;
    }

    // Everyone whose weekly target is still an estimate.
    const estimated = await db
      .select({ clerkId: athleteProfilesTable.clerkId })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.weeklyHourTargetEstimated, true));
    for (const p of estimated) {
      const r = await recalibrateWeeklyTarget(p.clerkId);
      if (r.changed) summary.targetsRecalibrated++;
    }

    if (
      summary.sessionsUpdated > 0 ||
      summary.targetsRecalibrated > 0 ||
      summary.ftpFloorsRaised > 0
    ) {
      log(
        `belastingscores afgeleid: ${summary.sessionsUpdated} ritten bijgewerkt, ` +
          `${summary.sessionsSkipped} eerlijk overgeslagen; ` +
          `${summary.targetsRecalibrated} weekdoelen geijkt op echt rijgedrag; ` +
          `${summary.ftpFloorsRaised} FTP-schattingen opgetrokken naar bewezen ondergrens`,
      );
    }
  } finally {
    if (locked) {
      await client
        .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID])
        .catch(() => {});
    }
    client.release();
  }
  return summary;
}
